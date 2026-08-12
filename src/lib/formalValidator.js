export { diffFrames, resolveFrame, validateModel } from './decisionEngine.js';

export const validateReasonPath = (model, path) => {
  if (path?.customReason) {
    return { ok: false, status: 'custom_unverified', errors: ['自定义理由尚未经过题库形式校验。'] };
  }
  const errors = [];
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
  return {
    ok: errors.length === 0,
    status: errors.length ? 'invalid' : path.status,
    errors,
  };
};
