const EMPTY_MODEL_META = Object.freeze({
  id: 'argument-chain-bank',
  version: 'unloaded',
  title: '论证链实验室',
  subtitle: '逐层检查事实、规范原则与当前基本价值',
});

const EMPTY_OVERLAY = Object.freeze({
  facts: {},
  claims: {},
  arguments: {},
  policies: [],
  dilemmas: [],
});

let formalModel = null;
let activeOverlay = EMPTY_OVERLAY;

export let MODEL_META = EMPTY_MODEL_META;
export let typeRules = {};
export let claims = {};
export let facts = {};
export let argumentsById = {};
export let policies = [];
export let dilemmas = [];
export let sources = [];

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isLocalId = (value) => typeof value === 'string' && value.startsWith('local_');

const assertRecord = (value, label) => {
  if (!isRecord(value)) throw new Error(`题库字段 ${label} 必须是对象。`);
};

const assertArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`题库字段 ${label} 必须是数组。`);
};

export const validateFormalModel = (model) => {
  if (!isRecord(model)) throw new Error('题库文件不是有效对象。');
  if (model.schema !== 'minimal-bridge-dialogue-model') throw new Error('题库 schema 不受支持。');
  if (model.schemaVersion !== 3) throw new Error(`题库 schemaVersion ${model.schemaVersion} 不受支持。`);
  assertRecord(model.meta, 'meta');
  if (!model.meta.version) throw new Error('题库缺少版本号。');
  assertRecord(model.typeRules, 'typeRules');
  assertRecord(model.facts, 'facts');
  assertRecord(model.claims, 'claims');
  assertRecord(model.arguments, 'arguments');
  assertArray(model.policies, 'policies');
  assertArray(model.dilemmas, 'dilemmas');
  assertArray(model.sources, 'sources');
  return model;
};

const normalizeLocalRecord = (value) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, item]) => (
    isLocalId(id) && isRecord(item) && item.id === id
  )));
};

const normalizeLocalList = (value) => (
  Array.isArray(value)
    ? value.filter((item) => isRecord(item) && isLocalId(item.id))
    : []
);

export const normalizeSessionOverlay = (overlay = EMPTY_OVERLAY) => ({
  facts: normalizeLocalRecord(overlay.facts),
  claims: normalizeLocalRecord(overlay.claims),
  arguments: normalizeLocalRecord(overlay.arguments),
  policies: normalizeLocalList(overlay.policies),
  dilemmas: normalizeLocalList(overlay.dilemmas),
});

const mergeById = (formalItems, overlayItems) => {
  const merged = new Map(formalItems.map((item) => [item.id, item]));
  overlayItems.forEach((item) => {
    if (item?.id) merged.set(item.id, item);
  });
  return [...merged.values()];
};

const applyModel = () => {
  if (!formalModel) return;
  const overlay = normalizeSessionOverlay(activeOverlay);

  MODEL_META = formalModel.meta;
  typeRules = formalModel.typeRules;
  facts = { ...formalModel.facts, ...overlay.facts };
  claims = { ...formalModel.claims, ...overlay.claims };
  argumentsById = { ...formalModel.arguments, ...overlay.arguments };
  policies = mergeById(formalModel.policies, overlay.policies);
  dilemmas = mergeById(formalModel.dilemmas, overlay.dilemmas);
  sources = formalModel.sources;
};

export const configureFormalModel = (model, overlay = EMPTY_OVERLAY) => {
  formalModel = validateFormalModel(model);
  activeOverlay = normalizeSessionOverlay(overlay);
  applyModel();
  return getModelSnapshot();
};

export const applySessionOverlay = (overlay) => {
  if (!formalModel) throw new Error('正式题库尚未加载。');
  activeOverlay = normalizeSessionOverlay(overlay);
  applyModel();
  return getModelSnapshot();
};

export const getFormalModel = () => formalModel;

export const getSessionOverlay = () => activeOverlay;

export const getModelSnapshot = () => ({
  meta: MODEL_META,
  typeRules,
  facts,
  claims,
  argumentsById,
  policies,
  dilemmas,
  sources,
});

export const getArgumentsForClaim = (claimId) =>
  Object.values(argumentsById).filter((argument) => argument.targetClaimId === claimId);

export const getPolicy = (policyId) => policies.find((policy) => policy.id === policyId);

export const getTerminalClaims = () =>
  Object.values(claims).filter((claim) => claim.kind === 'terminal');

export const getRelevantDilemmas = (terminalIds) => {
  const set = new Set(terminalIds);
  return dilemmas.filter((item) => set.has(item.left) && set.has(item.right));
};
