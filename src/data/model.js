import { validateArgument } from '../lib/formalValidator.js';

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
export let assessmentModes = { default: 'real_world_belief' };
export let ideologyBenchmarks = { profiles: [] };
export let adaptiveAssessment = {};
export let arglogicCatalog = null;
export let formalEntities = {};
export let formalIndex = null;
export let formalCertificates = {};

export const POLICY_ELEMENT_GROUPS = Object.freeze({
  scenario_condition: 'scenarioConditions',
  policy_choice: 'policyChoices',
  safeguard: 'safeguards',
  parameter: 'parameters',
});

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
  if (Object.values(model.arguments).some((argument) => argument.formalization)) {
    assertRecord(model.formalEntities, 'formalEntities');
    assertRecord(model.arglogicCatalog, 'arglogicCatalog');
    if (model.arglogicCatalog?.languageVersion === 'arglogic-0.2') {
      assertRecord(model.formalIndex, 'formalIndex');
    }
  }
  assertArray(model.policies, 'policies');
  model.policies.forEach((policy) => {
    if (policy.origin === 'community' || policy.origin === 'session_overlay') return;
    const elementIds = new Set();
    Object.entries(POLICY_ELEMENT_GROUPS).forEach(([kind, group]) => {
      assertArray(policy[group], `policies.${policy.id}.${group}`);
      policy[group].forEach((element) => {
        assertRecord(element, `policies.${policy.id}.${group}[]`);
        if (!element.id || elementIds.has(element.id)) throw new Error(`政策 ${policy.id} 的元素 ID 缺失或重复。`);
        if (element.kind !== kind) throw new Error(`政策元素 ${element.id} 的 kind 与所在分组不一致。`);
        if (!element.label || !element.plainExplanation || !element.whyItMatters) {
          throw new Error(`政策元素 ${element.id} 缺少通俗说明。`);
        }
        elementIds.add(element.id);
      });
    });
  });
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
  assessmentModes = formalModel.assessmentModes || { default: 'real_world_belief' };
  ideologyBenchmarks = formalModel.ideologyBenchmarks || { profiles: [] };
  adaptiveAssessment = formalModel.adaptiveAssessment || {};
  arglogicCatalog = formalModel.arglogicCatalog || null;
  formalEntities = formalModel.formalEntities || {};
  formalIndex = formalModel.formalIndex || null;
  formalCertificates = arglogicCatalog
    ? Object.fromEntries(Object.values(formalModel.arguments)
      .filter((argument) => argument.formalization)
      .map((argument) => [
        argument.id,
        validateArgument(argument.formalization, { entities: formalEntities, formalIndex }, arglogicCatalog),
      ]))
    : {};
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
  assessmentModes,
  ideologyBenchmarks,
  adaptiveAssessment,
  arglogicCatalog,
  formalEntities,
  formalIndex,
  formalCertificates,
});

export const getArgumentsForClaim = (claimId) =>
  Object.values(argumentsById).filter((argument) => argument.targetClaimId === claimId);

export const getPolicy = (policyId) => policies.find((policy) => policy.id === policyId);

export const getPolicyElements = (policy, kinds = Object.keys(POLICY_ELEMENT_GROUPS)) => {
  if (!policy) return [];
  const typed = kinds.flatMap((kind) => (
    policy[POLICY_ELEMENT_GROUPS[kind]] || []
  ));
  if (typed.length || !kinds.includes('policy_choice')) return typed;
  return (policy.components || []).map((item) => ({ ...item, kind: 'policy_choice' }));
};

export const getTerminalClaims = () =>
  Object.values(claims).filter((claim) => claim.kind === 'terminal');

export const getRelevantDilemmas = (terminalIds) => {
  const set = new Set(terminalIds);
  return dilemmas.filter((item) => set.has(item.left) && set.has(item.right));
};
