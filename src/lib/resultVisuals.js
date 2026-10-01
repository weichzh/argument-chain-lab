import { policyForRecord, proposalItemsFor, revisionChangesFor, summarizePolicyResult } from './decisionEngine.js';
import { ANSWER_LABELS, attemptLabel, counterImpactLabel } from './resultPresentation.js';

export const VISUAL_STATES = Object.freeze({
  accepted: { label: '接受原方案', mark: '✓' },
  conditional: { label: '接受修改方案', mark: '→' },
  rejected: { label: '不接受原方案', mark: '×' },
  uncertain: { label: '仍有待确定处', mark: '?' },
  skipped: { label: '已跳过', mark: '−' },
  ongoing: { label: '进行中', mark: '…' },
  untouched: { label: '未开始', mark: '○' },
});

const finalAnswer = result => result?.finalRootAnswer ?? result?.rootAnswer;
export const overviewState = result => {
  if (!result) return 'untouched';
  const final = finalAnswer(result);
  if (final === 'skipped') return 'skipped';
  if (final === 'uncertain') return 'uncertain';
  if (final === 'yes') return 'accepted';
  if (result.acceptedRevisionFrameId) return 'conditional';
  if (result.unresolvedRevisionFrameId) return 'uncertain';
  return final === 'no' ? 'rejected' : 'ongoing';
};

// Counts describe saved answers, never a person's political strength or ability.
export const buildResultAtlas = (model, state) => {
  const coreIds = model.product.defaultPolicyIds;
  const ids = [...new Set([...coreIds, ...(state.policyIds || []), ...Object.keys(state.policyResults || {}), ...Object.keys(state.policyDrafts || {})])];
  const rows = ids.flatMap(id => {
    const policy = model.policies.find(item => item.id === id);
    if (!policy) return [];
    const result = state.policyResults?.[id];
    const draft = state.currentPolicyId === id && state.startedAt ? state : state.policyDrafts?.[id];
    const status = result ? overviewState(result) : draft ? 'ongoing' : 'untouched';
    return [{ id, title: policy.shortTitle, core: coreIds.includes(id), result, status,
      label: VISUAL_STATES[status].label, changed: Boolean(result && finalAnswer(result) !== result.rootAnswer),
      reviewPending: Boolean(draft?.reviewCheckpoint),
      summary: result ? summarizePolicyResult(model, result) : null }];
  });
  const counts = Object.fromEntries(Object.keys(VISUAL_STATES).map(key => [key, 0]));
  rows.filter(row => row.core).forEach(row => { counts[row.status] += 1; });
  return { rows, counts, coreTotal: coreIds.length,
    completed: rows.filter(row => row.core && row.result && row.status !== 'skipped').length,
    optionalCompleted: rows.filter(row => !row.core && row.result && row.status !== 'skipped').length };
};

export const FRAME_STATES = Object.freeze({
  yes: { label: '接受', mark: '✓' }, accept: { label: '接受', mark: '✓' },
  no: { label: '不接受', mark: '×' }, reject: { label: '不接受', mark: '×' },
  uncertain: { label: '不确定', mark: '?' }, skipped: { label: '已跳过', mark: '−' },
  untested: { label: '未测试', mark: '○' }, unrecorded: { label: '未记录', mark: '−' },
});

export const boundaryFrames = (model, result) => {
  const policy = policyForRecord(model, result.policyId, result.sourceModelVersion);
  if (!policy) return [];
  const currentSource = !result.sourceModelVersion || result.sourceModelVersion === model.meta.version;
  const responses = result.revisionAnswers || {};
  return [{ id: policy.rootFrameId, title: '完整原方案', step: '原方案',
    response: result.rootAnswer || 'unrecorded', items: proposalItemsFor(policy), changes: [] },
  ...policy.diagnostics.map((diagnostic, index) => {
    const id = diagnostic.candidateFrameId;
    // Historical explicit acceptance is evidence; absence is not a rejection.
    const response = responses[id] || (result.acceptedRevisionFrameId === id ? 'accept'
      : result.unresolvedRevisionFrameId === id ? 'uncertain' : currentSource ? 'untested' : 'unrecorded');
    return { id, step: `修改 ${index + 1}`, title: policy.frames[id].label, response,
      changes: revisionChangesFor(policy, id), items: proposalItemsFor(policy, id) };
  })];
};

const pathTone = status => ({
  accepted: 'confirmed', qualified: 'qualified', retracted: 'retracted',
  uncertain: 'uncertain', unchecked: 'pending', custom_unverified: 'pending', unresolved: 'pending',
}[status] || 'pending');
const pathLabel = status => ({
  accepted: '已核对', qualified: '保留重要区别', retracted: '已撤回',
  uncertain: '适用性未确定', unchecked: '尚未检验', custom_unverified: '自填，尚未校验', unresolved: '尚未补全',
}[status] || '尚未核对');

export const reasonBranch = (model, result, mode = 'main') => {
  const paths = mode === 'main' ? result.mainPaths || [] : result.counterPath ? [result.counterPath] : [];
  const attempts = (result.rejectedReasonAttempts || []).filter(attempt => attempt.chainMode === mode);
  const nodes = [];
  paths.forEach((path, pathIndex) => {
    const prefix = `${mode}-${pathIndex}`;
    let confirmedPrefix = Boolean(path.steps?.length);
    let targetId = path.rootClaimId;
    (path.steps || []).forEach((step, index) => {
      const reason = model.reasons[step.reasonId];
      const checked = confirmedPrefix && reason && reason.targetClaimId === targetId && step.claimId === targetId
        && step.bridgeClaimId === reason.bridgeClaimId && step.ruleAnswer === 'accept'
        && reason.premises.every(premise => step.premiseAnswers?.[premise.id] === 'accept');
      confirmedPrefix = Boolean(checked);
      targetId = step.bridgeClaimId;
      nodes.push({ id: `${prefix}-reason-${index}`, kind: index ? '更深理由' : '所选理由',
        title: reason?.title || '旧记录中的理由', body: model.claims[step.bridgeClaimId]?.text || '',
        tone: path.status === 'retracted' ? 'retracted' : checked ? 'confirmed' : 'pending',
        label: path.status === 'retracted' ? checked ? '曾核对，现已撤回' : '已撤回，核对记录不完整' : checked ? '前提与原则已核对' : '核对记录不完整',
        connected: Boolean(checked && path.status !== 'retracted' && !(pathIndex > 0 && index === 0)) });
    });
    if (path.selectedReasonId) nodes.push({ id: `${prefix}-selected`, kind: '所选理由',
      title: model.reasons[path.selectedReasonId]?.title || '已保存的所选理由',
      label: '尚未检验', tone: 'pending', connected: false });
    if (path.customReason) nodes.push({ id: `${prefix}-custom`, kind: path.steps?.length ? '自填的更深理由' : '自填理由',
      title: path.customReason.argument?.title || path.customReason.text || '已保存自填内容',
      body: path.customReason.argument?.summary || '', label: '尚未校验', tone: 'pending', connected: false });
    if (path.stress) {
      const stress = path.stress;
      nodes.push({ id: `${prefix}-case`, kind: '相似案例',
        title: ({ apply: '在这个案例中仍然适用', qualified: '这个案例有重要区别', retract: '这个案例让我撤回理由', uncertain: '这个案例是否适用，仍不确定' })[stress.response] || '旧记录未保存回答',
        body: stress.distinction || stress.question || '展开原始记录查看案例。',
        label: confirmedPrefix ? pathLabel(path.status) : '案例回答已保存，前序核对不完整',
        tone: confirmedPrefix ? pathTone(path.status) : 'pending',
        connected: confirmedPrefix && stress.response === 'apply' && path.status === 'accepted' });
    } else nodes.push({ id: `${prefix}-case-pending`, kind: '相似案例', title: '尚未记录案例检查',
      label: '没有默认通过', tone: 'missing', connected: false });
  });
  attempts.forEach((attempt, index) => nodes.push({ id: `${mode}-attempt-${index}`, kind: '未确认的尝试',
    title: model.reasons[attempt.reasonId]?.title || '已保存的理由尝试',
    body: attemptLabel(attempt), label: attemptLabel(attempt), tone: 'disputed', connected: false }));
  return { mode, title: mode === 'main' ? '主要理由' : '相反理由', nodes,
    empty: mode === 'main' ? '尚未记录主要理由；这不代表你没有理由。'
      : result.counterImpact === 'no_change' ? '没有选择相反理由，不表示所有反对意见都已检验。' : '尚未记录相反理由。',
    impact: mode === 'counter' ? counterImpactLabel(result) : null,
    source: result.sourceModelVersion || null };
};

export const decisionJourney = result => ({
  initial: ANSWER_LABELS[result.rootAnswer] || '尚未记录',
  final: ANSWER_LABELS[finalAnswer(result)] || '尚未记录',
  changed: finalAnswer(result) !== result.rootAnswer,
  impact: counterImpactLabel(result),
});
