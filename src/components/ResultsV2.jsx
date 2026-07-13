import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  RotateCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { argumentsById, claims, facts, policies } from '../data/model.js';
import {
  buildContributionPackage,
  contributionEligibility,
} from '../lib/contribution.js';

const statusCopy = {
  complete: '严格完整',
  conditional: '事实未完全确认',
  tension: '仍有张力',
  unresolved: '尚未完成',
};

const factResponseCopy = {
  true: '成立',
  false: '不成立',
  unknown: '不能判断',
};

const downloadJson = (filename, value) => {
  const url = URL.createObjectURL(new Blob(
    [`${JSON.stringify(value, null, 2)}\n`],
    { type: 'application/json;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function ArgumentPreview({ chain }) {
  if (!chain) return <p className="empty-state">本轮还没有可预览的论证。</p>;
  return (
    <div className="argument-preview">
      {chain.steps.map((step, index) => {
        const argument = argumentsById[step.argumentId];
        return (
          <section className="preview-step" key={step.id}>
            <header><span>第 {index + 1} 层</span><h2>{claims[step.targetClaimId]?.text}</h2></header>
            <div className="preview-premises">
              {(argument?.factIds || []).map((factId) => (
                <div className="preview-node fact" key={factId}>
                  <span>F</span>
                  <p>{facts[factId]?.statement}</p>
                  <em>{factResponseCopy[step.factResponses?.[factId]]}</em>
                </div>
              ))}
              <div className="preview-operator">＋</div>
              <div className="preview-node bridge">
                <span>B</span>
                <p>{claims[step.bridgeClaimId]?.text}</p>
                <em>{step.bridgeResponse === 'accept' ? '接受' : '未接受'}</em>
              </div>
            </div>
            <div className="preview-support">这些前提为上面的结论增加一项可反驳的理由</div>
          </section>
        );
      })}
      {chain.terminal ? (
        <section className="preview-fixed-point">
          <span>G · 当前基本价值</span>
          <h2>{claims[chain.terminal.claimId]?.text}</h2>
          <p>{claims[chain.terminal.claimId]?.explanation}</p>
          <div><strong>压力测试</strong><span>{chain.stress?.response === 'apply' ? '在结构相似案例中仍然适用' : chain.stress?.distinction || '已完成检验'}</span></div>
        </section>
      ) : null}
    </div>
  );
}

export default function ResultsV2({ state, dispatch, bankClient, onReset }) {
  const chains = useMemo(() => Object.values(state.records).flatMap((record) => record.chains || []), [state.records]);
  const [selectedId, setSelectedId] = useState(() => (
    chains.find((chain) => chain.status === 'complete')?.id || chains[0]?.id || null
  ));
  const [resetArmed, setResetArmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState({ loading: false, success: null, error: null });
  const selected = chains.find((chain) => chain.id === selectedId) || chains[0] || null;
  const eligibility = contributionEligibility(state, selected);
  const contribution = buildContributionPackage(state, selected);
  const selectedPolicy = policies.find((policy) => policy.id === selected?.policyId);

  const submit = async () => {
    if (!consent || !contribution.ok || !bankClient.configured) return;
    setSubmitState({ loading: true, success: null, error: null });
    try {
      const result = await bankClient.contribute(contribution.value);
      setSubmitState({
        loading: false,
        success: result.duplicate ? '这份论证已经在候选区中，无需重复提交。' : '已进入公开审核候选区。',
        error: null,
      });
      setConsent(false);
    } catch (error) {
      setSubmitState({ loading: false, success: null, error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <main className="results-page">
      <header className="results-header">
        <div>
          <span>完整论证预览</span>
          <h1>先检查将要保留的论证，<br />再单独决定是否公开贡献。</h1>
          <p>预览只展示你明确确认的结构。未完成、条件式和有张力的论证仍可本地下载，但不能进入候选区。</p>
        </div>
        <div className="results-header-actions">
          <button className="button secondary" type="button" onClick={() => downloadJson('argument-chain-local-progress.json', {
            schema: 'argument-chain-local-progress-export',
            version: 1,
            progress: state,
          })}><Download size={17} />下载本地进度</button>
          {resetArmed ? <p className="destructive-warning" role="alert">这会清除本轮进度和当前页面的 AI 配置。</p> : null}
          <button className={`button ${resetArmed ? 'danger-outline' : 'quiet'}`} type="button" onClick={() => {
            if (!resetArmed) {
              setResetArmed(true);
              return;
            }
            onReset();
          }}><RotateCcw size={17} />{resetArmed ? '确认重新开始' : '重新开始'}</button>
          {resetArmed ? <button className="button quiet" type="button" onClick={() => setResetArmed(false)}>取消</button> : null}
        </div>
      </header>

      {chains.length > 1 ? (
        <label className="chain-selector">
          <span>选择论证</span>
          <select value={selected?.id || ''} onChange={(event) => {
            setSelectedId(event.target.value);
            setConsent(false);
            setSubmitState({ loading: false, success: null, error: null });
          }}>
            {chains.map((chain, index) => (
              <option key={chain.id} value={chain.id}>论证 {index + 1} · {statusCopy[chain.status] || chain.status}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="preview-status">
        <span className={`status-dot ${selected?.status || 'unresolved'}`} />
        <strong>{statusCopy[selected?.status] || '没有完整论证'}</strong>
        <p>{selectedPolicy?.title}</p>
      </div>

      <ArgumentPreview chain={selected} />

      <section className="contribution-zone">
        <header>
          <ShieldCheck size={27} />
          <div><h2>贡献到公开题库</h2><p>这是独立于本地保存的公开动作。</p></div>
        </header>

        {eligibility.eligible ? (
          <>
            <p className="contribution-disclosure">
              确认后，这份<strong>规范化结构论证</strong>会离开浏览器，进入私有候选区；定期审核会把它放入公开 GitHub PR。
              人工合并后，它会成为公开正式题库的一部分。不会上传原始输入、AI 对话、API 配置、时间、设备或会话标识。
            </p>
            <label className="consent-check">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>我已检查完整预览，并明确同意这份结构化论证进入公开审核记录和正式题库。</span>
            </label>
            <div className="contribution-actions">
              <button className="button primary" type="button" disabled={!consent || submitState.loading || !bankClient.configured} onClick={submit}>
                <Send size={17} /> {submitState.loading ? '正在提交…' : '贡献到公开题库'}
              </button>
              {contribution.ok ? <button className="button secondary" type="button" onClick={() => downloadJson('argument-chain-contribution.json', contribution.value)}><Download size={17} />下载贡献包</button> : null}
            </div>
            {!bankClient.configured ? <p className="service-note">这个部署尚未配置候选区服务地址，因此当前只能下载贡献包，不会上传。</p> : null}
            {submitState.success ? <p className="submit-success" role="status"><Check size={17} />{submitState.success}</p> : null}
            {submitState.error ? <p className="field-error" role="alert">{submitState.error}</p> : null}
            {contribution.ok ? (
              <details className="contribution-json">
                <summary>查看将要公开的全部结构化数据</summary>
                <pre>{JSON.stringify(contribution.value, null, 2)}</pre>
              </details>
            ) : null}
          </>
        ) : (
          <div className="ineligible-message">
            <h3>这条论证不会进入候选区</h3>
            <ul>{eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        )}
      </section>

      <footer className="results-footer">
        {state.policyIndex < policies.length - 1 ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'NEXT_POLICY' })}>继续下一项题库判断</button> : null}
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'RETRY_POLICY' })}>回到当前判断继续补充</button>
      </footer>
    </main>
  );
}
