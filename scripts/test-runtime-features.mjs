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

import { manifest, model, benchmark } from './current-bank.mjs';

assert.equal(validateBankManifest(manifest).version, model.meta.version);
assert.equal(validateEntertainmentBenchmark(benchmark, model.meta.version).profiles.length, 75);
const index = configureModelV4(model);
assert.deepEqual(index, { version: '1.3.0', policyCount: 13, claimCount: 199, reasonCount: 306 });
assert(!getReasonsForClaimV4('c_speech_support_root').some(reason => reason.id === 'r_speech_support_participation'));
assert(getReasonsForClaimV4('c_speech_support_root').some(reason => reason.id === 'r_speech_support_participation__v130'));
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
  stressTest: {
    scenario: '某市为了减少深夜噪声，准备拘留第一次在住宅区大声播放音乐的人，但罚款已经能达到相同效果。',
    question: '在这个具体案例里，你仍认为拘留造成的负担超过了实现目标所需的程度吗？',
  },
};
assert.equal(validateArgumentCandidate(candidate, 'current_target', 'oppose').ok, true);
assert.equal(validateArgumentCandidate({ ...candidate, direction: 'support' }, 'current_target', 'oppose').ok, false);
assert.equal(validateArgumentCandidate({
  ...candidate,
  stressTest: { scenario: '换成一个对象不同、但关键结构相同的案例。', question: '仍然适用吗？' },
}, 'current_target', 'oppose').ok, false);
assert.equal(validateArgumentCandidate({
  ...candidate,
  stressTest: { ...candidate.stressTest, question: '适用吗？' },
}, 'current_target', 'oppose').ok, false);
console.log('Runtime feature tests passed.');
