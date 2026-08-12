import { resolveFrame, validateModel } from './decisionEngine.js';

let activeModel = null;
let policyById = new Map();
let reasonsByClaim = new Map();

export const configureModelV4 = (model) => {
  const report = validateModel(model);
  if (!report.ok) throw new Error(`Invalid v4 model:\n${report.errors.join('\n')}`);
  activeModel = model;
  policyById = new Map(model.policies.map((policy) => [policy.id, policy]));
  reasonsByClaim = new Map();
  Object.values(model.reasons).forEach((reason) => {
    const list = reasonsByClaim.get(reason.targetClaimId) || [];
    list.push(reason);
    reasonsByClaim.set(reason.targetClaimId, list);
  });
  return {
    version: model.meta.version,
    policyCount: model.policies.length,
    claimCount: Object.keys(model.claims).length,
    reasonCount: Object.keys(model.reasons).length,
  };
};

const requireModel = () => {
  if (!activeModel) throw new Error('Model v4 has not been configured.');
  return activeModel;
};

export const getModelV4 = () => requireModel();
export const getPoliciesV4 = () => [...requireModel().policies].sort((left, right) => left.order - right.order);
export const getPolicyV4 = (policyId) => policyById.get(policyId) || null;
export const getClaimV4 = (claimId) => requireModel().claims[claimId] || null;
export const getReasonV4 = (reasonId) => requireModel().reasons[reasonId] || null;
export const getReasonsForClaimV4 = (claimId) => [...(reasonsByClaim.get(claimId) || [])];
export const getResolvedFrameV4 = (policyId, frameId) => {
  const policy = getPolicyV4(policyId);
  return policy ? resolveFrame(policy, frameId) : null;
};
export const getTermExplanationV4 = (term) => requireModel().terms[term] || null;
export const getArgumentSchemesV4 = () => Object.values(requireModel().argumentSchemes || {});
