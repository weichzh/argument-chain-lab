import React, { useState } from 'react';
import { ArrowRight, BookOpen, LockKeyhole, PenLine, Sparkles } from 'lucide-react';
import { sessionDraftKey } from '../hooks/useSession.js';

const CUSTOM_DRAFT_KEY = sessionDraftKey('landing-custom');

const readDraft = () => {
  try {
    return window.sessionStorage.getItem(CUSTOM_DRAFT_KEY) || '';
  } catch {
    return '';
  }
};

export default function Landing({ onStartBank, onStartCustom, aiLoading, hasSavedProgress }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState(readDraft);

  const updateDraft = (value) => {
    setDraft(value);
    try {
      if (value) window.sessionStorage.setItem(CUSTOM_DRAFT_KEY, value);
      else window.sessionStorage.removeItem(CUSTOM_DRAFT_KEY);
    } catch {
      // The input remains available in memory when session storage is blocked.
    }
  };

  const submitCustom = () => {
    const text = draft.trim();
    if (!text || aiLoading) return;
    onStartCustom({ text, scope: 'new_root', draftKey: CUSTOM_DRAFT_KEY });
  };

  return (
    <main className="landing">
      <section className="landing-intro">
        <h1>从一个判断开始，<br />把理由走完整。</h1>
        <p>自由选择题目，逐步确认事实、原则与价值。随时离开，下次接着做。</p>
      </section>

      <section className="entry-paths" aria-label="选择起点">
        <div className="argument-branch" aria-hidden="true"><span /><i /><i /></div>
        <article className="entry-row">
          <BookOpen className="entry-icon" size={36} aria-hidden="true" />
          <div>
            <h2>{hasSavedProgress ? '继续上次进度' : '从题库开始'}</h2>
            <p>{hasSavedProgress ? '回到题目列表，选择要继续或新开始的题目。' : '自由选择公开议题，按自己的顺序逐项核对。'}</p>
          </div>
          <button className="button primary entry-action" type="button" onClick={onStartBank}>
            {hasSavedProgress ? '继续上次进度' : '从题库开始'} <ArrowRight size={18} />
          </button>
        </article>

        <article className={`entry-row custom${customOpen ? ' open' : ''}`}>
          <PenLine className="entry-icon" size={36} aria-hidden="true" />
          <div>
            <h2>从我的观点开始</h2>
            <p>你的模型把观点整理为候选；只有你确认后，候选才进入本轮论证。</p>
          </div>
          <button
            className="button secondary entry-action"
            type="button"
            onClick={() => setCustomOpen((value) => !value)}
            aria-expanded={customOpen}
          >
            写下我的观点 <ArrowRight size={18} />
          </button>
          {customOpen ? (
            <div className="custom-entry-form">
              <label htmlFor="root-viewpoint">我的判断</label>
              <textarea
                id="root-viewpoint"
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                placeholder="例如：城市应当优先把道路空间留给公共交通，但需要给紧急车辆保留例外。"
                rows={4}
              />
              <div className="form-actions">
                <p>内容由浏览器直接发送到你配置的模型服务商，不经过本站服务器。未确认草稿最多保留在当前标签页。</p>
                <button className="button primary" type="button" disabled={!draft.trim() || aiLoading} onClick={submitCustom}>
                  <Sparkles size={17} /> {aiLoading ? '正在生成候选…' : '交给 AI 结构化'}
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <aside className="privacy-boundary">
        <LockKeyhole size={22} aria-hidden="true" />
        <p>
          默认只保存在此浏览器。只有你在完整预览后明确点击
          <strong>“贡献到公开题库”</strong>
          ，结构化论证才会离开本地并进入公开审核。
        </p>
      </aside>

      <div className="landing-status">无需注册 · AI 由你自行配置</div>
    </main>
  );
}
