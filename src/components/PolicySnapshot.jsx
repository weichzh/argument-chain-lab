import React from 'react';
import { summarizePolicyResult } from '../lib/decisionEngine.js';
import { resultStatus, reasonStatusLabel, counterImpactLabel } from '../lib/resultPresentation.js';

export default function PolicySnapshot({ model, result }) {
  if (!result) return null;
  const summary = summarizePolicyResult(model, result);
  const status = resultStatus(result);
  const changed = result.finalRootAnswer && result.finalRootAnswer !== result.rootAnswer;
  return <section className="policy-snapshot" aria-label="本题小结">
    <span className={`decision-badge ${status.id}`}>{status.label}</span>
    <p>{changed ? '初始记录：' : ''}{summary.summary}</p>
    {summary.acceptedRevision ? <p><b>{changed ? '当时接受的修改：' : '可接受的修改：'}</b>{summary.acceptedRevision}</p> : null}
    {summary.mainReasonTitle ? <p><b>{reasonStatusLabel(summary.pathStatus)}：</b>{summary.mainReasonTitle}</p> : null}
    {summary.unresolvedRevision ? <p><b>还没确定：</b>{summary.unresolvedRevision}</p> : null}
    {result.counterImpact ? <p>{counterImpactLabel(result)}</p> : null}
    {summary.acceptedRevision ? <small>这项修改足以改变本轮判断；未确认它是必要条件、最小组合或最佳方案。</small> : null}
  </section>;
}
