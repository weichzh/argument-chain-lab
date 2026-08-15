export { diffFrames, resolveFrame, validateModel } from './decisionEngine.js';

export const validateReasonPath = (model, path) => {
  if (path?.customReason) {
    return { ok: false, status: 'custom_unverified', errors: ['自定义理由尚未经过题库形式校验。'] };
  }
  const errors = [];
  const allowedStatuses = new Set([
    'in_progress', 'accepted', 'qualified', 'retracted', 'uncertain', 'unchecked',
  ]);
  if (!allowedStatuses.has(path?.status)) errors.push('理由路径状态无效。');
  let targetClaimId = path?.rootClaimId;
  for (const step of path?.steps || []) {
    const reason = model.reasons[step.reasonId];
    if (!reason || reason.targetClaimId !== targetClaimId || step.claimId !== targetClaimId) {
      errors.push('理由没有指向当前正在判断的命题。');
      break;
    }
    if (step.bridgeClaimId !== reason.bridgeClaimId || step.ruleAnswer !== 'accept') {
      errors.push('理由依据与题库中的形式结构不一致。');
    }
    if (reason.premises.some((premise) => step.premiseAnswers?.[premise.id] !== 'accept')) {
      errors.push('理由仍有未接受的题设假设。');
    }
    targetClaimId = reason.bridgeClaimId;
  }
  if (!path?.steps?.length) errors.push('理由路径为空。');
  if (path?.stress) {
    const statusByResponse = {
      apply: 'accepted',
      qualified: 'qualified',
      retract: 'retracted',
      uncertain: 'uncertain',
    };
    if (statusByResponse[path.stress.response] !== path.status) {
      errors.push('相似案例回答与理由路径状态不一致。');
    }
    if (path.stress.claimId !== targetClaimId) {
      errors.push('相似案例没有检查理由路径的实际停止点。');
    }
  }
  return {
    ok: errors.length === 0,
    status: errors.length ? 'invalid' : path.status,
    errors,
  };
};

const finalAnswerFor = (rootAnswer, counterImpact) => {
  if (counterImpact === 'offset') return 'uncertain';
  if (counterImpact !== 'reverse') return rootAnswer;
  if (rootAnswer === 'yes') return 'no';
  if (rootAnswer === 'no') return 'yes';
  return 'uncertain';
};

export const validatePolicyResult = (model, result) => {
  const errors = [];
  const warnings = [];
  const policy = model.policies.find((item) => item.id === result?.policyId);
  if (!policy) return { ok: false, errors: ['政策结果引用了不存在的政策。'], warnings };
  if (!['yes', 'no', 'uncertain', 'skipped'].includes(result.rootAnswer)) {
    errors.push('根判断不是允许的值。');
  }
  if (result.counterImpact != null
    && !['no_change', 'weaken', 'offset', 'reverse', 'uncertain'].includes(result.counterImpact)) {
    errors.push('相反理由影响不是允许的值。');
  }
  if (result.rootFrameId && result.rootFrameId !== policy.rootFrameId) {
    errors.push('根判断引用的完整方案不正确。');
  }
  const expectedFinalAnswer = finalAnswerFor(result.rootAnswer, result.counterImpact);
  if (result.finalRootAnswer !== expectedFinalAnswer) {
    errors.push('最终判断与根判断及相反理由影响不一致。');
  }
  const expectedConditional = result.rootAnswer === 'no' && Boolean(result.acceptedRevisionFrameId);
  if (Boolean(result.derivedConditionalAcceptance) !== expectedConditional) {
    errors.push('派生条件接受与根判断及已接受修改不一致。');
  }
  if (['uncertain', 'skipped'].includes(result.rootAnswer) && (
    result.acceptedRevisionFrameId
    || (result.mainPaths || []).length
    || result.counterClaimId
    || result.counterPath
    || result.counterImpact
  )) {
    errors.push('不确定或跳过的根判断不应附带理由、修改或相反理由结论。');
  }

  let expectedDiagnosisClaimId = null;
  let expectedCounterClaimId = null;
  if (result.rootAnswer === 'yes') {
    expectedDiagnosisClaimId = policy.entry.supportClaimId;
    expectedCounterClaimId = policy.counterClaims.whenSupportingRoot;
    if (result.acceptedRevisionFrameId) errors.push('支持原方案的结果不应同时接受修改方案。');
  } else if (result.rootAnswer === 'no') {
    if (result.acceptedRevisionFrameId) {
      const diagnostic = policy.diagnostics.find((item) => (
        item.candidateFrameId === result.acceptedRevisionFrameId
      ));
      if (!diagnostic) errors.push('接受的修改方案不属于这项政策的诊断序列。');
      else {
        expectedDiagnosisClaimId = diagnostic.acceptedClaimId;
        expectedCounterClaimId = diagnostic.counterClaimId;
      }
    } else {
      expectedDiagnosisClaimId = policy.fallbackOpposeClaimId;
      expectedCounterClaimId = policy.counterClaims.whenOpposingWithoutAcceptedRevision;
    }
  }
  if (expectedDiagnosisClaimId && result.diagnosisClaimId !== expectedDiagnosisClaimId) {
    errors.push('理由路径的判断目标与根判断或修改方案不一致。');
  }
  if (!expectedDiagnosisClaimId && result.diagnosisClaimId) {
    errors.push('未形成明确根判断的结果不应附带判断目标。');
  }

  for (const path of result.mainPaths || []) {
    if (path.rootClaimId !== result.diagnosisClaimId) {
      errors.push('主要理由路径没有从当前判断目标开始。');
    }
    const report = validateReasonPath(model, path);
    if (!report.ok && report.status !== 'custom_unverified') errors.push(...report.errors);
  }
  if (['yes', 'no'].includes(result.rootAnswer) && !(result.mainPaths || []).length) {
    warnings.push('这项政策记录了根判断，但没有已校验的主要理由路径。');
  }
  if (expectedCounterClaimId && result.counterClaimId !== expectedCounterClaimId) {
    errors.push('相反理由没有指向当前判断对应的反方命题。');
  }
  if (result.counterPath) {
    if (result.counterPath.rootClaimId !== result.counterClaimId) {
      errors.push('相反理由路径没有从记录的反方命题开始。');
    }
    const report = validateReasonPath(model, result.counterPath);
    if (!report.ok && report.status !== 'custom_unverified') errors.push(...report.errors);
  }
  if (['yes', 'no'].includes(result.rootAnswer) && result.counterImpact == null) {
    warnings.push('这项政策尚未记录相反理由对判断的影响。');
  }
  if (!result.counterPath && ![null, 'no_change'].includes(result.counterImpact)) {
    errors.push('没有相反理由路径时，不应记录它改变或削弱了判断。');
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
};

export const validatePolicyResults = (model, policyResults) => {
  const reports = Object.fromEntries(Object.entries(policyResults || {}).map(([policyId, result]) => [
    policyId,
    validatePolicyResult(model, result),
  ]));
  const errors = Object.entries(reports).flatMap(([policyId, report]) => (
    report.errors.map((message) => `${policyId}: ${message}`)
  ));
  Object.entries(policyResults || {}).forEach(([policyId, result]) => {
    if (result?.policyId !== policyId) errors.push(`${policyId}: 政策结果的键与 policyId 不一致。`);
  });
  const warnings = Object.entries(reports).flatMap(([policyId, report]) => (
    report.warnings.map((message) => `${policyId}: ${message}`)
  ));
  return { ok: errors.length === 0, errors, warnings, reports };
};
