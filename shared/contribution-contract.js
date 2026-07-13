export const CONTRIBUTION_SCHEMA = 'argument-chain-contribution';
export const CONTRIBUTION_VERSION = 1;
export const CONSENT_VERSION = 1;
export const CANDIDATE_RECORD_SCHEMA = 'argument-chain-candidate-record';
export const COMMUNITY_BANK_SCHEMA = 'argument-chain-community-bank';
export const MAX_CONTRIBUTION_BYTES = 64 * 1024;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DIRECTIONS = new Set(['support', 'oppose', 'undirected']);
const TARGET_KINDS = new Set(['policy', 'bridge']);
const FACT_KINDS = new Set(['stipulated', 'empirical', 'descriptive']);
const BRIDGE_KINDS = new Set(['bridge', 'terminal']);
const STRESS_RESPONSES = new Set(['applies', 'relevant_distinction']);
const FORBIDDEN_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const RESERVED_PLACEHOLDERS = new Set(['未命名结论', '未命名事实', '未命名原则', '未命名规范原则', '未命名当前基本价值']);

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const issue = (issues, path, code) => issues.push({ path, code });

function checkObject(value, path, allowedKeys, requiredKeys, issues) {
  if (!isPlainObject(value)) {
    issue(issues, path, 'expected_object');
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) issue(issues, `${path}.${key}`, 'unknown_field');
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) issue(issues, `${path}.${key}`, 'required');
  }
  return true;
}

function checkString(value, path, issues, { min = 1, max = 2000, pattern } = {}) {
  if (typeof value !== 'string') {
    issue(issues, path, 'expected_string');
    return false;
  }
  if (value.length < min) issue(issues, path, 'too_short');
  if (value.length > max) issue(issues, path, 'too_long');
  if (pattern && !pattern.test(value)) issue(issues, path, 'invalid_format');
  if (FORBIDDEN_TEXT_CONTROLS.test(value)) issue(issues, path, 'unsafe_text_control');
  if (RESERVED_PLACEHOLDERS.has(value.trim())) issue(issues, path, 'placeholder_content');
  return true;
}

function checkExact(value, expected, path, issues) {
  if (value !== expected) issue(issues, path, 'invalid_value');
}

function validateTarget(value, path, issues) {
  if (!checkObject(value, path, ['kind', 'text'], ['kind', 'text'], issues)) return;
  if (!TARGET_KINDS.has(value.kind)) issue(issues, `${path}.kind`, 'invalid_value');
  checkString(value.text, `${path}.text`, issues, { max: 1200 });
}

function validateFact(value, path, issues) {
  const keys = [
    'kind',
    'statement',
    'plainExplanation',
    'plainTruthConditions',
    'plainFalsifier',
    'truthConditions',
    'falsifier',
    'response',
  ];
  if (!checkObject(value, path, keys, keys, issues)) return;
  if (!FACT_KINDS.has(value.kind)) issue(issues, `${path}.kind`, 'invalid_value');
  checkString(value.statement, `${path}.statement`, issues, { max: 1200 });
  checkString(value.plainExplanation, `${path}.plainExplanation`, issues, { max: 2000 });
  checkString(value.plainTruthConditions, `${path}.plainTruthConditions`, issues, { max: 2400 });
  checkString(value.plainFalsifier, `${path}.plainFalsifier`, issues, { max: 2400 });
  checkString(value.truthConditions, `${path}.truthConditions`, issues, { max: 2400 });
  checkString(value.falsifier, `${path}.falsifier`, issues, { max: 2400 });
  checkExact(value.response, 'true', `${path}.response`, issues);
}

function validateBridge(value, path, issues) {
  const keys = ['kind', 'shortLabel', 'text', 'explanation', 'example', 'response'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  if (!BRIDGE_KINDS.has(value.kind)) issue(issues, `${path}.kind`, 'invalid_value');
  checkString(value.shortLabel, `${path}.shortLabel`, issues, { max: 160 });
  checkString(value.text, `${path}.text`, issues, { max: 1600 });
  checkString(value.explanation, `${path}.explanation`, issues, { max: 2400 });
  checkString(value.example, `${path}.example`, issues, { max: 2400 });
  checkExact(value.response, 'accept', `${path}.response`, issues);
}

function validateStep(value, path, issues) {
  const keys = ['target', 'facts', 'bridge', 'inference'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  validateTarget(value.target, `${path}.target`, issues);
  if (!Array.isArray(value.facts)) {
    issue(issues, `${path}.facts`, 'expected_array');
  } else {
    if (value.facts.length < 1) issue(issues, `${path}.facts`, 'too_few_items');
    if (value.facts.length > 12) issue(issues, `${path}.facts`, 'too_many_items');
    value.facts.forEach((fact, index) => validateFact(fact, `${path}.facts[${index}]`, issues));
  }
  validateBridge(value.bridge, `${path}.bridge`, issues);
  checkExact(value.inference, 'defeasible_support', `${path}.inference`, issues);
}

function validateFixedPoint(value, path, issues) {
  const keys = ['claimText', 'confirmation'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  checkString(value.claimText, `${path}.claimText`, issues, { max: 1600 });
  checkExact(value.confirmation, 'independently_accepted', `${path}.confirmation`, issues);
}

function validateStressTest(value, path, issues) {
  const keys = ['scenario', 'question', 'response', 'distinction'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  checkString(value.scenario, `${path}.scenario`, issues, { max: 3200 });
  checkString(value.question, `${path}.question`, issues, { max: 1600 });
  if (!STRESS_RESPONSES.has(value.response)) issue(issues, `${path}.response`, 'invalid_value');
  if (value.response === 'applies') {
    if (value.distinction !== null) issue(issues, `${path}.distinction`, 'must_be_null');
  } else {
    checkString(value.distinction, `${path}.distinction`, issues, { max: 2400 });
  }
}

function validateChecks(value, path, issues) {
  const keys = ['noUnresolvedConflicts', 'noModelGaps'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  checkExact(value.noUnresolvedConflicts, true, `${path}.noUnresolvedConflicts`, issues);
  checkExact(value.noModelGaps, true, `${path}.noModelGaps`, issues);
}

function validateArgument(value, path, issues) {
  const keys = ['direction', 'target', 'steps', 'fixedPoint', 'stressTest'];
  if (!checkObject(value, path, keys, keys, issues)) return;
  if (!DIRECTIONS.has(value.direction)) issue(issues, `${path}.direction`, 'invalid_value');
  validateTarget(value.target, `${path}.target`, issues);
  if (!Array.isArray(value.steps)) {
    issue(issues, `${path}.steps`, 'expected_array');
  } else {
    if (value.steps.length < 1) issue(issues, `${path}.steps`, 'too_few_items');
    if (value.steps.length > 12) issue(issues, `${path}.steps`, 'too_many_items');
    value.steps.forEach((step, index) => validateStep(step, `${path}.steps[${index}]`, issues));
  }
  validateFixedPoint(value.fixedPoint, `${path}.fixedPoint`, issues);
  validateStressTest(value.stressTest, `${path}.stressTest`, issues);

  if (!Array.isArray(value.steps) || !value.steps.length) return;
  const firstTarget = value.steps[0]?.target?.text;
  if (typeof firstTarget === 'string' && firstTarget !== value.target?.text) {
    issue(issues, `${path}.steps[0].target.text`, 'chain_target_mismatch');
  }
  if (value.steps[0]?.target?.kind !== value.target?.kind) {
    issue(issues, `${path}.steps[0].target.kind`, 'chain_target_mismatch');
  }
  const seenTargets = new Set();
  for (let index = 1; index < value.steps.length; index += 1) {
    const expectedTarget = value.steps[index - 1]?.bridge?.text;
    const actualTarget = value.steps[index]?.target?.text;
    if (typeof expectedTarget === 'string' && typeof actualTarget === 'string' && expectedTarget !== actualTarget) {
      issue(issues, `${path}.steps[${index}].target.text`, 'chain_link_mismatch');
    }
    if (value.steps[index]?.target?.kind !== 'bridge') {
      issue(issues, `${path}.steps[${index}].target.kind`, 'recursive_target_must_be_bridge');
    }
  }
  for (const [index, step] of value.steps.entries()) {
    if (seenTargets.has(step?.target?.text)) issue(issues, `${path}.steps[${index}].target.text`, 'argument_cycle');
    seenTargets.add(step?.target?.text);
    if (index < value.steps.length - 1 && step?.bridge?.kind !== 'bridge') {
      issue(issues, `${path}.steps[${index}].bridge.kind`, 'nonfinal_bridge_must_be_bridge');
    }
  }
  const finalBridge = value.steps.at(-1)?.bridge;
  if (finalBridge?.kind !== 'terminal') {
    issue(issues, `${path}.steps[${value.steps.length - 1}].bridge.kind`, 'final_bridge_must_be_terminal');
  }
  if (typeof finalBridge?.text === 'string' && finalBridge.text !== value.fixedPoint?.claimText) {
    issue(issues, `${path}.fixedPoint.claimText`, 'fixed_point_mismatch');
  }
}

export function validateContributionPackage(value) {
  const issues = [];
  const keys = [
    'schema',
    'version',
    'bankVersion',
    'consentVersion',
    'status',
    'checks',
    'argument',
  ];
  if (!checkObject(value, '$', keys, keys, issues)) return { ok: false, issues };
  checkExact(value.schema, CONTRIBUTION_SCHEMA, '$.schema', issues);
  checkExact(value.version, CONTRIBUTION_VERSION, '$.version', issues);
  checkString(value.bankVersion, '$.bankVersion', issues, { max: 64, pattern: VERSION_PATTERN });
  checkExact(value.consentVersion, CONSENT_VERSION, '$.consentVersion', issues);
  checkExact(value.status, 'complete', '$.status', issues);
  validateChecks(value.checks, '$.checks', issues);
  validateArgument(value.argument, '$.argument', issues);
  return { ok: issues.length === 0, issues };
}

const normalizeText = (value) => value
  .normalize('NFC')
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.trim())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n');

function normalizeValue(value) {
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]));
}

export function normalizeContributionPackage(value) {
  const before = validateContributionPackage(value);
  if (!before.ok) return before;
  const normalized = normalizeValue(value);
  const after = validateContributionPackage(normalized);
  return after.ok ? { ok: true, value: normalized } : after;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function canonicalizeContributionPackage(value) {
  const normalized = normalizeContributionPackage(value);
  if (!normalized.ok) return normalized;
  return { ok: true, value: JSON.stringify(stableValue(normalized.value)) };
}

export async function hashContributionPackage(value) {
  const canonical = canonicalizeContributionPackage(value);
  if (!canonical.ok) return canonical;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical.value));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ok: true, value: `sha256:${hex}` };
}

const SENSITIVE_PATTERNS = [
  ['email_address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu],
  ['api_key', /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/u],
  ['secret_assignment', /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[^\s,;]+/iu],
  ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/iu],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u],
  ['private_key', /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u],
  ['unique_identifier', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu],
  ['china_identity_number', /(?<!\d)\d{17}[\dXx](?!\d)/u],
  ['phone_number', /(?<!\d)(?:(?:\+?86[- ]?)?1[3-9]\d{9}|\+\d{1,3}(?:[ ()-]?\d){7,14}|(?:\(\d{2,4}\)|\d{2,4})[- ]\d{3,4}[- ]\d{4})(?!\d)/u],
  ['secret_in_url', /https?:\/\/\S+[?&](?:api[_-]?key|token|secret|password)=/iu],
  ['external_url', /\bhttps?:\/\/[^\s]+/iu],
  ['active_content', /(?:<\s*script\b|javascript\s*:)/iu],
];

export function findSensitiveContent(value) {
  const findings = [];
  const visit = (current, path) => {
    if (typeof current === 'string') {
      for (const [code, pattern] of SENSITIVE_PATTERNS) {
        if (pattern.test(current)) findings.push({ path, code });
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (isPlainObject(current)) {
      Object.entries(current).forEach(([key, child]) => visit(child, `${path}.${key}`));
    }
  };
  visit(value, '$');
  return findings;
}

export function validateCandidateRecord(value) {
  const issues = [];
  const keys = ['schema', 'version', 'contentHash', 'contribution'];
  if (!checkObject(value, '$', keys, keys, issues)) return { ok: false, issues };
  checkExact(value.schema, CANDIDATE_RECORD_SCHEMA, '$.schema', issues);
  checkExact(value.version, 1, '$.version', issues);
  checkString(value.contentHash, '$.contentHash', issues, { min: 71, max: 71, pattern: HASH_PATTERN });
  const contribution = validateContributionPackage(value.contribution);
  issues.push(...contribution.issues.map((entry) => ({ ...entry, path: `$.contribution${entry.path.slice(1)}` })));
  return { ok: issues.length === 0, issues };
}

export function validateCommunityBank(value) {
  const issues = [];
  const keys = ['schema', 'version', 'entries'];
  if (!checkObject(value, '$', keys, keys, issues)) return { ok: false, issues };
  checkExact(value.schema, COMMUNITY_BANK_SCHEMA, '$.schema', issues);
  checkExact(value.version, 1, '$.version', issues);
  if (!Array.isArray(value.entries)) {
    issue(issues, '$.entries', 'expected_array');
  } else {
    const hashes = new Set();
    value.entries.forEach((entry, index) => {
      const path = `$.entries[${index}]`;
      if (!checkObject(entry, path, ['contentHash', 'contribution'], ['contentHash', 'contribution'], issues)) return;
      checkString(entry.contentHash, `${path}.contentHash`, issues, { min: 71, max: 71, pattern: HASH_PATTERN });
      if (hashes.has(entry.contentHash)) issue(issues, `${path}.contentHash`, 'duplicate_hash');
      hashes.add(entry.contentHash);
      const contribution = validateContributionPackage(entry.contribution);
      issues.push(...contribution.issues.map((item) => ({ ...item, path: `${path}.contribution${item.path.slice(1)}` })));
    });
  }
  return { ok: issues.length === 0, issues };
}

export function createEmptyCommunityBank() {
  return {
    schema: COMMUNITY_BANK_SCHEMA,
    version: 1,
    entries: [],
  };
}
