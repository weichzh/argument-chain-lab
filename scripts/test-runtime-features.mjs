import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateBankManifest, validateEntertainmentBenchmark } from '../src/data/bank.js';
import {
  AI_CONFIG_SCHEMA,
  AI_CONFIG_VERSION,
  parseAiConfig,
  serializeAiConfig,
  validateAiConfig,
} from '../src/lib/aiConfig.js';
import {
  configureModelV4,
  getPolicyV4,
  getReasonsForClaimV4,
  getResolvedFrameV4,
} from '../src/lib/modelV4.js';
import { validateArgumentCandidate } from '../src/lib/sessionOverlay.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../public/bank/manifest.json', import.meta.url), 'utf8'));
const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.1.0.json', import.meta.url), 'utf8'));
const benchmark = JSON.parse(fs.readFileSync(new URL('../public/bank/ideology-benchmark-1.1.0.json', import.meta.url), 'utf8'));

assert.equal(validateBankManifest(manifest).version, '1.1.0');
assert.equal(validateEntertainmentBenchmark(benchmark, '1.1.0').profiles.length, 52);
const index = configureModelV4(model);
assert.deepEqual(index, { version: '1.1.0', policyCount: 13, claimCount: 197, reasonCount: 302 });
assert.equal(getPolicyV4('speech_restriction').rootFrameId, 'speech_root');
assert.equal(getResolvedFrameV4('speech_restriction', 'speech_civil_only').sanction, 'civil_only');
assert(getReasonsForClaimV4('c_speech_reject_sanction').length >= 2);

const aiConfig = {
  schema: AI_CONFIG_SCHEMA,
  version: AI_CONFIG_VERSION,
  provider: 'openai',
  model: 'gpt-5',
  apiKey: 'test-only-placeholder',
  baseUrl: null,
  providerOptions: {},
};
assert.equal(validateAiConfig(aiConfig).ok, true);
const serialized = serializeAiConfig(aiConfig);
assert.equal(serialized.ok, true);
assert.equal(parseAiConfig(serialized.value).value.apiKey, 'test-only-placeholder');

const candidate = {
  scope: 'current_target',
  direction: 'oppose',
  schemeId: 'proportionality',
  target: { shortLabel: '反对较强处罚', text: model.claims.c_speech_reject_sanction.text },
  argument: { title: '负担过重', summary: '处罚强度超过题设目标所需程度。' },
  facts: [{
    kind: 'stipulated',
    statement: '存在负担更小的办法。',
    plainExplanation: '比较替代办法。',
    truthConditions: '替代办法达到相近目标。',
    falsifier: '替代办法明显无效。',
  }],
  bridge: {
    kind: 'terminal',
    shortLabel: '负担相称',
    text: '公共手段造成的负担应当与目标相称。',
    explanation: '把政策负担纳入判断。',
    example: '同样目标下优先选择负担更小的办法。',
  },
  stressTest: { scenario: '换成对象不同但负担相同的政策。', question: '你仍接受这条理由吗？' },
};
assert.equal(validateArgumentCandidate(candidate, 'current_target', 'oppose').ok, true);
assert.equal(validateArgumentCandidate({ ...candidate, direction: 'support' }, 'current_target', 'oppose').ok, false);
console.log('Runtime feature tests passed.');
