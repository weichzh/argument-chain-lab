import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  applySessionOverlay,
  argumentsById,
  claims,
  configureFormalModel,
  facts,
  normalizeSessionOverlay,
  policies,
} from '../src/data/model.js';
import {
  communityBankToExtension,
  validateBankManifest,
} from '../src/data/bank.js';
import { loadPiCatalog } from '../src/lib/aiAgent.js';
import {
  AI_CONFIG_SCHEMA,
  AI_CONFIG_VERSION,
  parseAiConfig,
  serializeAiConfig,
  validateAiConfig,
} from '../src/lib/aiConfig.js';
import { HttpBankClient } from '../src/lib/bankClient.js';
import { buildContributionPackage } from '../src/lib/contribution.js';
import { createInitialState, PHASES, reducer } from '../src/lib/engine.js';
import {
  candidateRequestMatchesState,
  mergeCandidateIntoOverlay,
  validateArgumentCandidate,
} from '../src/lib/sessionOverlay.js';
import { validateContributionPackage } from '../shared/contribution-contract.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { manifest, model } = await loadCurrentFormalModel();
assert.equal(validateBankManifest(manifest).version, manifest.current);
configureFormalModel(model);

const config = {
  schema: AI_CONFIG_SCHEMA,
  version: AI_CONFIG_VERSION,
  provider: 'openai',
  model: 'gpt-5-mini',
  apiKey: 'test-key-that-must-stay-local',
  baseUrl: 'https://example.invalid/v1',
  providerOptions: { temperature: 0.2 },
};
const serializedConfig = serializeAiConfig(config);
assert.equal(serializedConfig.ok, true);
assert.deepEqual(parseAiConfig(serializedConfig.value).value, config);
assert.equal(validateAiConfig({ ...config, accountId: 'forbidden' }).ok, false);

const catalog = await loadPiCatalog();
assert(catalog.length > 10, 'pi-ai should expose its built-in provider catalog.');
assert(catalog.some((provider) => provider.id === 'openai' && provider.models.length > 0));

const rawDraft = 'RAW_DRAFT_MUST_NOT_BE_PERSISTED_OR_CONTRIBUTED';
const candidate = {
  scope: 'new_root',
  direction: 'support',
  target: {
    shortLabel: '优先修复危险路口',
    text: '城市应当优先修复事故风险明确偏高的路口。',
  },
  argument: {
    title: '先处理可核查的高风险点',
    summary: '事故记录和可行改造共同构成优先处理的理由。',
  },
  facts: [
    {
      kind: 'empirical',
      statement: '这些路口的严重事故率持续高于同类路口。',
      plainExplanation: '这里只比较同类路口的严重事故率。',
      truthConditions: '连续多个统计周期的可比记录显示事故率更高。',
      falsifier: '可比记录显示差异不存在或来自统计口径错误。',
    },
    {
      kind: 'descriptive',
      statement: '已有工程方案能够在现有预算内降低主要风险。',
      plainExplanation: '这里只判断方案是否可执行并能降低风险。',
      truthConditions: '工程评估给出明确措施、预算和风险降低依据。',
      falsifier: '评估显示措施不可执行、超出预算或不能降低风险。',
    },
  ],
  bridge: {
    kind: 'terminal',
    shortLabel: '优先避免可预防的严重伤害',
    text: '公共资源应当优先用于避免已有可靠方案可以预防的严重伤害。',
    explanation: '这条原则说明可核查风险和可行方案为何形成优先理由。',
    example: '同样预算下，应先修复有明确坍塌风险的公共设施。',
  },
  stressTest: {
    scenario: '另一个社区也存在同等严重、同样可预防的公共安全风险。',
    question: '即使社区立场与你不同，你仍接受相同的优先原则吗？',
  },
};

assert.equal(validateArgumentCandidate(candidate, 'new_root').ok, true);
assert.equal(validateArgumentCandidate({ ...candidate, direction: 'oppose' }, 'new_root', 'support').ok, false);
const installed = mergeCandidateIntoOverlay(normalizeSessionOverlay(), candidate);
assert(installed.policyId.startsWith('local_policy_'));
assert(Object.keys(installed.overlay.facts).every((id) => id.startsWith('local_fact_')));
assert(!JSON.stringify(installed.overlay).includes(rawDraft));

const protectedFactId = Object.keys(model.facts)[0];
const protectedStatement = facts[protectedFactId].statement;
applySessionOverlay({
  facts: {
    [protectedFactId]: { id: protectedFactId, statement: 'attempted overwrite' },
  },
});
assert.equal(facts[protectedFactId].statement, protectedStatement, 'Session overlay must not replace formal bank ids.');

applySessionOverlay(installed.overlay);
assert.equal(policies.find((policy) => policy.id === installed.policyId)?.origin, 'session_overlay');
assert.equal(claims[installed.targetClaimId].text, candidate.target.text);
assert.equal(argumentsById[installed.argumentId].factIds.length, candidate.facts.length);

let state = createInitialState();
state = reducer(state, { type: 'SET_SESSION_OVERLAY', overlay: installed.overlay });
state = reducer(state, {
  type: 'START_FROM_CANDIDATE',
  policyId: installed.policyId,
  argumentId: installed.argumentId,
  direction: installed.direction,
});
assert.equal(state.phase, PHASES.FACT);
for (const _fact of candidate.facts) state = reducer(state, { type: 'ANSWER_FACT', response: 'true' });
assert.equal(state.phase, PHASES.BRIDGE);
state = reducer(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
assert.equal(state.phase, PHASES.TERMINAL_CONFIRM);
state = reducer(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
state = reducer(state, { type: 'ANSWER_STRESS', response: 'apply' });
assert.equal(state.currentChain.status, 'complete');

const staleContext = {
  updatedAt: state.updatedAt,
  policyIndex: state.policyIndex,
  phase: state.phase,
  chainId: state.currentChain.id,
  targetClaimId: state.currentTargetClaimId,
  argumentId: state.currentArgumentId,
  factIndex: state.currentFactIndex,
  stepCount: state.currentChain.steps.length,
};
assert.equal(candidateRequestMatchesState(state, staleContext), true);
assert.equal(candidateRequestMatchesState({ ...state, phase: PHASES.RESULTS }, staleContext), false);

configureFormalModel(model);
let recursiveState = reducer(reducer(createInitialState(), { type: 'START' }), { type: 'SET_STANCE', stance: 'support' });
const recursiveCandidate = {
  ...candidate,
  scope: 'current_target',
  target: {
    shortLabel: claims[recursiveState.currentTargetClaimId].shortLabel,
    text: claims[recursiveState.currentTargetClaimId].text,
  },
  bridge: { ...candidate.bridge, kind: 'bridge' },
};
const recursiveInstalled = mergeCandidateIntoOverlay(
  normalizeSessionOverlay(),
  recursiveCandidate,
  { currentTargetClaimId: recursiveState.currentTargetClaimId },
);
applySessionOverlay(recursiveInstalled.overlay);
recursiveState = reducer(recursiveState, { type: 'SET_SESSION_OVERLAY', overlay: recursiveInstalled.overlay });
recursiveState = reducer(recursiveState, { type: 'USE_CANDIDATE_ARGUMENT', argumentId: recursiveInstalled.argumentId });
for (const _fact of recursiveCandidate.facts) recursiveState = reducer(recursiveState, { type: 'ANSWER_FACT', response: 'true' });
recursiveState = reducer(recursiveState, { type: 'ANSWER_BRIDGE', response: 'accept' });
recursiveState = reducer(recursiveState, { type: 'SET_DEPTH', decision: 'deeper' });
assert.equal(recursiveState.phase, PHASES.ARGUMENT);
assert.equal(recursiveState.currentTargetClaimId, recursiveInstalled.overlay.arguments[recursiveInstalled.argumentId].bridgeClaimId);
applySessionOverlay(installed.overlay);

const contribution = buildContributionPackage(state, state.currentChain);
assert.equal(contribution.ok, true, contribution.reasons?.join('; '));
assert.equal(validateContributionPackage(contribution.value).ok, true);
const contributionText = JSON.stringify(contribution.value);
assert(!contributionText.includes(rawDraft));
assert(!contributionText.includes(config.apiKey));
assert.deepEqual(Object.keys(contribution.value).sort(), [
  'argument',
  'bankVersion',
  'checks',
  'consentVersion',
  'schema',
  'status',
  'version',
]);

let capturedRequest;
const bankClient = new HttpBankClient({
  endpoint: 'https://bank.example.invalid/',
  fetchImpl: async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ accepted: true, duplicate: false, contentHash: `sha256:${'a'.repeat(64)}` }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
await bankClient.contribute(contribution.value);
assert.equal(capturedRequest.url, 'https://bank.example.invalid/v1/contributions');
assert.equal(capturedRequest.options.credentials, 'omit');
assert.equal(capturedRequest.options.referrerPolicy, 'no-referrer');
assert.deepEqual(JSON.parse(capturedRequest.options.body), contribution.value);

const fixture = JSON.parse(await fs.readFile(
  new URL('../shared/fixtures/minimal-complete-contribution.json', import.meta.url),
  'utf8',
));
const contentHash = `sha256:${'b'.repeat(64)}`;
const extension = communityBankToExtension({
  schema: 'argument-chain-community-bank',
  version: 1,
  entries: [{ contentHash, contribution: fixture }],
});
assert.equal(extension.policies.length, 1);
assert.equal(Object.keys(extension.arguments).length, fixture.argument.steps.length);
const communityArguments = Object.values(extension.arguments);
for (let index = 1; index < communityArguments.length; index += 1) {
  assert.equal(communityArguments[index].targetClaimId, communityArguments[index - 1].bridgeClaimId);
}

console.log('Runtime feature tests passed: formal-bank protection, pi-ai catalog, memory-only config contract, confirmed session overlay, strict contribution, and community-bank links.');
