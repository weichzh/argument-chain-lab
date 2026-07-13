import React, { useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  Download,
  Eye,
  EyeOff,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { loadPiCatalog } from '../lib/aiAgent.js';
import {
  AI_CONFIG_SCHEMA,
  AI_CONFIG_VERSION,
  parseAiConfig,
  serializeAiConfig,
  validateAiConfig,
} from '../lib/aiConfig.js';

const blankForm = () => ({
  provider: '',
  model: '',
  apiKey: '',
  baseUrl: '',
  providerOptions: '{}',
});

const formFromConfig = (value) => value ? {
  provider: value.provider,
  model: value.model,
  apiKey: value.apiKey,
  baseUrl: value.baseUrl || '',
  providerOptions: JSON.stringify(value.providerOptions || {}, null, 2),
} : blankForm();

const downloadText = (text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'argument-chain-ai-config.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function AIConfigPanel({ open, value, onApply, onClear, onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [form, setForm] = useState(() => formFromConfig(value));
  const [showKey, setShowKey] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(formFromConfig(value));
  }, [value]);

  useEffect(() => {
    if (!open || catalog.length || catalogLoading) return;
    setCatalogLoading(true);
    loadPiCatalog()
      .then((items) => {
        setCatalog(items);
        setCatalogLoading(false);
      })
      .catch((loadError) => {
        setCatalogError(loadError instanceof Error ? loadError.message : String(loadError));
        setCatalogLoading(false);
      });
  }, [catalog.length, catalogLoading, open]);

  const provider = catalog.find((item) => item.id === form.provider);
  const models = useMemo(() => {
    const query = modelSearch.trim().toLocaleLowerCase();
    const items = provider?.models || [];
    if (!query) return items;
    return items.filter((model) => `${model.name} ${model.id}`.toLocaleLowerCase().includes(query));
  }, [modelSearch, provider]);

  if (!open) return null;

  const update = (field, nextValue) => {
    setForm((current) => ({ ...current, [field]: nextValue }));
    setError(null);
    setGeneratedText('');
  };

  const readForm = () => {
    let providerOptions;
    try {
      providerOptions = JSON.parse(form.providerOptions || '{}');
    } catch {
      return { ok: false, error: 'providerOptions 不是有效 JSON。' };
    }
    return validateAiConfig({
      schema: AI_CONFIG_SCHEMA,
      version: AI_CONFIG_VERSION,
      provider: form.provider,
      model: form.model,
      apiKey: form.apiKey,
      baseUrl: form.baseUrl || null,
      providerOptions,
    });
  };

  const apply = () => {
    const parsed = readForm();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onApply(parsed.value);
  };

  const generate = () => {
    const parsed = readForm();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const serialized = serializeAiConfig(parsed.value);
    if (!serialized.ok) {
      setError(serialized.error);
      return;
    }
    setGeneratedText(serialized.value);
  };

  const paste = () => {
    const parsed = parseAiConfig(pasteText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setForm(formFromConfig(parsed.value));
    setPasteText('');
    setError(null);
    onApply(parsed.value);
  };

  return (
    <div className="side-panel-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="side-panel ai-config-panel" role="dialog" aria-modal="true" aria-labelledby="ai-config-title">
        <header className="panel-header">
          <div><h2 id="ai-config-title">AI 配置</h2><p>由浏览器直接调用你选择的模型服务商。</p></div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭"><X /></button>
        </header>

        <div className="panel-scroll">
          <div className="field">
            <label htmlFor="ai-provider">服务商</label>
            <select
              id="ai-provider"
              value={form.provider}
              onChange={(event) => {
                update('provider', event.target.value);
                update('model', '');
              }}
              disabled={catalogLoading}
            >
              <option value="">{catalogLoading ? '正在读取 pi-ai 目录…' : '选择服务商'}</option>
              {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ai-model">模型</label>
            <div className="search-input"><Search size={16} /><input aria-label="搜索模型" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="搜索模型" /></div>
            <select id="ai-model" value={form.model} onChange={(event) => update('model', event.target.value)} disabled={!form.provider}>
              <option value="">选择模型</option>
              {form.model && !models.some((model) => model.id === form.model)
                ? <option value={form.model}>{form.model}</option>
                : null}
              {models.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}
            </select>
          </div>

          <label className="field">
            <span>API Key</span>
            <div className="secret-input">
              <input type={showKey ? 'text' : 'password'} value={form.apiKey} onChange={(event) => update('apiKey', event.target.value)} autoComplete="off" />
              <button className="icon-button" type="button" onClick={() => setShowKey((current) => !current)} title={showKey ? '隐藏密钥' : '显示密钥'}>
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Base URL（可选）</span>
            <input value={form.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" />
          </label>

          <details className="config-details">
            <summary>providerOptions</summary>
            <label className="field"><span>JSON 对象</span><textarea rows={4} value={form.providerOptions} onChange={(event) => update('providerOptions', event.target.value)} /></label>
          </details>

          {catalogError ? <p className="field-error" role="alert">{catalogError}</p> : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}

          <button className="button primary full" type="button" onClick={apply}>应用到当前页面</button>

          <section className="config-transfer">
            <h3>配置文本</h3>
            <p className="danger-copy">明文配置可能包含密钥。本站不保存它；请只在你信任的位置保管。</p>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={generate}><Download size={17} />生成配置文本</button>
              {value ? <button className="button quiet" type="button" onClick={onClear}><Trash2 size={17} />移除当前配置</button> : null}
            </div>
            {generatedText ? (
              <div className="generated-config">
                <textarea value={generatedText} readOnly rows={9} aria-label="生成的 AI 配置文本" />
                <div className="button-row">
                  <button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(generatedText)}><Clipboard size={17} />复制</button>
                  <button className="button secondary" type="button" onClick={() => downloadText(generatedText)}><Download size={17} />下载</button>
                </div>
              </div>
            ) : null}

            <label className="field"><span>粘贴配置文本</span><textarea rows={6} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'{\n  "schema": "argument-chain-ai-config",\n  "version": 1\n}'} /></label>
            <button className="button secondary full" type="button" onClick={paste} disabled={!pasteText.trim()}>解析并应用</button>
          </section>
        </div>
      </aside>
    </div>
  );
}
