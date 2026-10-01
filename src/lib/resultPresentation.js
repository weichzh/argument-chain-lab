import { summarizePolicyResult } from './decisionEngine.js';

export const ANSWER_LABELS = Object.freeze({ yes: '接受原方案', no: '不接受原方案', uncertain: '暂不能判断', skipped: '已跳过' });
export const UNCERTAINTY_LABELS = Object.freeze({ evidence: '还缺证据', definition: '条件或权限不清楚', tradeoff: '取舍尚未确定', other: '其他原因' });

export const resultStatus = result => {
  const final = result.finalRootAnswer ?? result.rootAnswer;
  if (final === 'skipped') return { id: 'skipped', label: '已跳过' };
  if (final !== result.rootAnswer) return { id: final === 'uncertain' ? 'uncertain' : 'changed', label: `复核后${ANSWER_LABELS[final]}` };
  if (final === 'uncertain') return { id: 'uncertain', label: '暂不能判断' };
  if (final === 'yes') return { id: 'accepted', label: '接受原方案' };
  if (result.acceptedRevisionFrameId) return { id: 'conditional', label: '接受一个修改方案' };
  if (result.unresolvedRevisionFrameId) return { id: 'boundary-uncertain', label: '修改边界待确定' };
  return { id: 'rejected', label: '不接受原方案' };
};

export const reasonStatusLabel = (status, counter = false) => ({
  accepted: counter ? '已核对的相反理由' : '已核对的主要理由',
  qualified: '经检验仍有保留的理由',
  retracted: '已撤回的理由',
  uncertain: '尚未确认的理由',
  unresolved: '尚未补全的理由',
  unchecked: '已选择、尚未检验的理由',
  custom_unverified: '你补充的理由（未校验）',
}[status] || '理由记录');

export const counterImpactLabel = (result) => ({
  no_change: result.counterPath ? '记录的相反理由没有改变判断' : '未选择会改变判断的相反理由',
  weaken: '相反理由带来犹豫，未改变判断',
  offset: '两边暂时抵消，最终不能确定',
  reverse: '复核后改变了对原方案的判断',
  uncertain: '相反理由的影响未确定',
}[result.counterImpact] || '尚未检查相反理由');

export const attemptLabel = attempt => attempt.response === 'not_applicable'
  ? '保留担忧，但未认可原则在这里的适用'
  : `${attempt.part === 'premise' ? '前提' : '原则适用'}${attempt.response === 'uncertain' ? '尚不确定' : '未获认可'}`;

export const orderedResults = (model, results) => Object.values(results || {})
  .filter(result => model.policies.some(policy => policy.id === result.policyId))
  .sort((a, b) => model.policies.find(policy => policy.id === a.policyId).order - model.policies.find(policy => policy.id === b.policyId).order);

export const resultSentence = (model, result) => {
  const summary = summarizePolicyResult(model, result);
  const status = resultStatus(result);
  return `${summary.title}：${status.label}${summary.acceptedRevision ? `——${summary.acceptedRevision}` : ''}。`;
};

// This is an export of what was recorded, not generated psychological inference.
// It deliberately excludes credentials, drafts, AI messages and browser metadata.
export const readableResults = (model, policyResults) => {
  const lines = ['# 本轮判断记录', '', `题库版本：${model.meta.version}`, '', '只描述这次记录，不推断政治身份。没有核对的前提、理由和反例不算通过。', ''];
  for (const result of orderedResults(model, policyResults)) {
    const summary = summarizePolicyResult(model, result);
    lines.push(`## ${summary.title}`, '', resultSentence(model, result), '', `原方案初始判断：${ANSWER_LABELS[result.rootAnswer]}`, `复核后的判断：${ANSWER_LABELS[result.finalRootAnswer ?? result.rootAnswer]}`, `作答来源题库：${result.sourceModelVersion || '未记录'}`, '');
    if (summary.acceptedRevision) lines.push(`可接受的修改：${summary.acceptedRevision}`, '这是已确认的充分修改，不表示必要条件、最小组合或最佳方案。', '');
    for (const change of summary.changes || []) lines.push(`${change.label}：${change.from} → ${change.to}`);
    if (summary.unresolvedRevision) lines.push(`尚未确定的修改：${summary.unresolvedRevision}`);
    if (summary.mainReasonTitle) lines.push(`${reasonStatusLabel(summary.pathStatus)}：${summary.mainReasonTitle}`);
    if (summary.deeperReason) lines.push(`更深理由：${summary.deeperReason}`);
    if (summary.counterReasonTitle) lines.push(`${reasonStatusLabel(summary.counterPathStatus, true)}：${summary.counterReasonTitle}`);
    lines.push(counterImpactLabel(result));
    for (const [frameId, note] of Object.entries(result.uncertaintyByFrame || {})) {
      const policy = model.policies.find(item => item.id === result.policyId);
      lines.push(`未确定处（${policy.frames[frameId]?.label || frameId}）：${UNCERTAINTY_LABELS[note.category] || '未分类'}${note.text ? `；${note.text}` : ''}`);
    }
    for (const attempt of result.rejectedReasonAttempts || []) lines.push(`未确认的尝试：${model.reasons[attempt.reasonId]?.title || attempt.reasonId}；${attemptLabel(attempt)}`);
    for (const [name, path] of [['主要理由路径', result.mainPaths?.[0]], ['相反理由路径', result.counterPath]]) {
      if (!path) continue;
      lines.push('', `### ${name}`, '');
      for (const step of path.steps || []) lines.push(`${model.reasons[step.reasonId]?.title || step.reasonId} → ${model.claims[step.bridgeClaimId]?.text || step.bridgeClaimId}`);
      if (path.customReason) lines.push(path.customReason.text || path.customReason.argument?.summary || path.customReason.argument?.title || '已保存自定义理由');
      if (path.stress) lines.push(`相似案例：${path.stress.scenario || '旧记录未保留案例文字'}`, `回答：${({ apply: '仍然适用', qualified: '存在重要区别', retract: '撤回理由', uncertain: '尚不确定' })[path.stress.response] || '未记录'}`, ...(path.stress.distinction ? [`区别：${path.stress.distinction}`] : []));
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
};
