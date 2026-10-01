import React, { useState } from 'react';
import { UNCERTAINTY_LABELS } from '../lib/resultPresentation.js';

export default function UncertaintyNote({ result, dispatch }) {
  const frameId = result.unresolvedRevisionFrameId || result.rootFrameId;
  const saved = result.uncertaintyByFrame?.[frameId] || {};
  const [category, setCategory] = useState(saved.category || '');
  const [text, setText] = useState(saved.text || '');
  const [confirmed, setConfirmed] = useState(false);
  return <details className="uncertainty-note">
    <summary>补充不确定的原因（可选）</summary>
    <label htmlFor="uncertainty-category">目前卡在哪里？</label>
    <select id="uncertainty-category" value={category} onChange={event => { setCategory(event.target.value); setConfirmed(false); }}>
      <option value="">暂不分类</option>
      {Object.entries(UNCERTAINTY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    <label htmlFor="uncertainty-text">还需要明确什么？</label>
    <textarea id="uncertainty-text" value={text} rows={3} maxLength={1000} onChange={event => { setText(event.target.value); setConfirmed(false); }} />
    <button className="button secondary" type="button" onClick={() => {
      dispatch({ type: 'RECORD_UNCERTAINTY', extra: { category, text } });
      setConfirmed(true);
    }}>保存未确定处</button>
    {confirmed ? <p role="status">已保存到这道题的本地记录。</p> : null}
  </details>;
}
