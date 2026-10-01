import React, { useState } from 'react';
import { boundaryFrames, FRAME_STATES } from '../lib/resultVisuals.js';
import { UNCERTAINTY_LABELS } from '../lib/resultPresentation.js';

export default function BoundaryTrack({ model, result }) {
  const frames = boundaryFrames(model, result);
  const [selectedId, setSelectedId] = useState(result.acceptedRevisionFrameId || result.unresolvedRevisionFrameId || frames[0]?.id);
  const selected = frames.find(frame => frame.id === selectedId) || frames[0];
  if (!selected) return null;
  const panelId = `boundary-${result.policyId}`;
  const note = result.uncertaintyByFrame?.[selected.id];
  return <section className="boundary-chart" aria-label={`${model.policies.find(policy => policy.id === result.policyId)?.shortTitle}的方案比较`}>
    <div className="boundary-caption"><strong>方案边界</strong><span>各修改独立与原方案比较，不累加</span></div>
    <ol className="boundary-track">{frames.map((frame, index) => {
      const status = FRAME_STATES[frame.response] || FRAME_STATES.unrecorded;
      return <li key={frame.id} data-response={frame.response}>
        <button type="button" aria-pressed={frame.id === selected.id} aria-controls={panelId}
          aria-label={`${frame.step}：${frame.title}，${status.label}`} onClick={() => setSelectedId(frame.id)}>
          <span className="boundary-step-label">{index === 0 ? '原方案' : frame.step}</span>
          <span className={`boundary-mark response-${frame.response}`} aria-hidden="true">{status.mark}</span>
          <strong>{status.label}</strong>
        </button>
      </li>;
    })}</ol>
    <div className="boundary-selection" id={panelId} aria-live="polite" aria-atomic="true">
      <span>{selected.step}</span><h3>{selected.title}</h3>
      {selected.response === 'accept' ? <p>{(result.finalRootAnswer ?? result.rootAnswer) !== result.rootAnswer ? '这是当时接受的修改；之后的原方案改判另行保留。' : '这个修改已足以改变本轮判断；不表示它是唯一、必要或最佳方案。'}</p>
        : selected.response === 'untested' ? <p>本轮没有测试这个方案，不能从其他回答推断是否接受。</p>
          : selected.response === 'unrecorded' ? <p>旧记录没有保存这个方案的回答，不将空缺解释为拒绝。</p>
            : selected.response === 'uncertain' ? <p>暂未形成判断，与明确拒绝分开记录。</p> : null}
      {note ? <p className="boundary-note">{UNCERTAINTY_LABELS[note.category] || '未分类'}{note.text ? `：${note.text}` : ''}</p> : null}
      <details className="revision-diff-detail" key={selected.id}>
        <summary>{selected.changes.length ? `查看修改差异（${selected.changes.length} 项）` : '查看完整原方案'}</summary>
        {selected.changes.length ? <dl className="v4-result-changes">{selected.changes.map(change => <React.Fragment key={change.dimensionId}>
          <dt>{change.dimensionLabel}</dt><dd><span className="before-change">{change.fromLabel}</span> → <strong>{change.toLabel}</strong></dd>
        </React.Fragment>)}</dl> : <dl className="v4-result-changes">{selected.items.map(item => <React.Fragment key={item.dimensionId}>
          <dt>{item.dimensionLabel}</dt><dd>{item.valueLabel}</dd>
        </React.Fragment>)}</dl>}
        {selected.changes.length ? <p className="boundary-unchanged">未列出的安排与完整原方案相同。上面的顺序是比较顺序，不是修改叠加顺序。</p> : null}
      </details>
    </div>
  </section>;
}
