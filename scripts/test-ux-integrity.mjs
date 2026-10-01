#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as engine from '../src/lib/decisionEngine.js';
import { matchEntertainment } from '../src/lib/entertainmentMatcher.js';
import { normalizeCurrentState } from '../src/hooks/useSession.js';
import { validatePolicyResult } from '../src/lib/formalValidator.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../public/bank/manifest.json');
const model = read(`../public/bank/${manifest.models.find(item => item.version === manifest.default).path}`);
const benchmark = read(`../public/bank/${manifest.entertainmentBenchmark.path}`);
const start = policyId => engine.startSession(model, engine.createSession(model, { policyIds: [policyId] }));
const answer = (state, id, extra) => engine.answer(model, state, id, extra);
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };

check('opening the current policy resumes its exact position', () => {
  const state = answer(start('speech_restriction'), 'no');
  const resumed = engine.openPolicy(model, state, state.currentPolicyId);
  assert.equal(resumed.phase, state.phase);
  assert.deepEqual(resumed.answerLog, state.answerLog);
  assert.deepEqual(resumed.history, state.history);
});
check('switching policies keeps independent unfinished checkpoints', () => {
  const a = answer(start('speech_restriction'), 'no');
  const b = engine.openPolicy(model, a, 'metadata_surveillance');
  const c = answer(b, 'no');
  const restored = engine.openPolicy(model, c, 'speech_restriction');
  assert.equal(restored.phase, a.phase);
  assert.equal(restored.rootAnswer, a.rootAnswer);
  assert.equal(restored.history.length, a.history.length);
  assert.equal(engine.openPolicy(model, restored, 'metadata_surveillance').phase, c.phase);
});
for (const policy of model.policies) {
  check(`supporting user is not described as opposing: ${policy.id}`, () => {
    let state = answer(start(policy.id), 'yes');
    for (let n = 0; n < 40 && state.phase !== engine.PHASES.COUNTER_REASON_CHOICE; n++) {
      const q = engine.getQuestion(model, state);
      const id = ({ reason_choice: q.options[0]?.id, assumption_check: 'accept', rule_check: 'accept', why_or_stop: 'stop_here', stress_test: 'apply', stress_test_unavailable: 'continue_unchecked' })[q.kind];
      assert(id, `unexpected phase ${q.kind}`);
      state = answer(state, id);
    }
    assert.equal(state.phase, engine.PHASES.COUNTER_REASON_CHOICE);
    assert.doesNotMatch(engine.getQuestion(model, state).statement, /你仍不接受|已列出的修改也没有改变/);
  });
}
check('uncertain modification can be left unresolved while testing later ones', () => {
  let state = answer(start('speech_restriction'), 'no');
  state = answer(state, 'uncertain');
  assert(engine.getQuestion(model, state).options.some(option => option.id === 'continue_revisions'));
  state = answer(state, 'continue_revisions');
  state = answer(state, 'reject');
  state = answer(state, 'reject');
  assert.equal(state.policyResults.speech_restriction.diagnosisClaimId, null);
  const firstRevision = model.policies.find(policy => policy.id === 'speech_restriction').diagnostics[0].candidateFrameId;
  assert.equal(state.policyResults.speech_restriction.revisionAnswers[firstRevision], 'uncertain');
});
check('disputed applicability is preserved as an unconfirmed reason attempt', () => {
  let state = answer(start('carbon_fee'), 'yes');
  state = answer(state, engine.getQuestion(model, state).options[0].id);
  while (state.phase === engine.PHASES.PREMISE_CHECK) state = answer(state, 'accept');
  const reasonId = state.currentReasonId;
  state = answer(state, 'not_applicable');
  assert(state.rejectedReasonAttempts.some(attempt => attempt.reasonId === reasonId && attempt.response === 'not_applicable'));
});
check('optional review records a selection, never invents checked premises', () => {
  let state = answer(start('carbon_fee'), 'yes');
  state = answer(state, engine.getQuestion(model, state).options[0].id);
  state = answer(state, 'save_unchecked');
  const result = state.policyResults.carbon_fee;
  assert.equal(result.mainPaths[0].status, 'unchecked');
  assert.equal(result.mainPaths[0].steps.length, 0);
  assert(result.mainPaths[0].selectedReasonId);
  assert.equal(result.counterImpact, null);
  state = answer(state, 'continue_review');
  assert.equal(state.phase, engine.PHASES.PREMISE_CHECK);
});
const rootOnly = Object.fromEntries(model.product.defaultPolicyIds.map(policyId => [policyId, { policyId, rootAnswer: 'uncertain' }]));
const left = await matchEntertainment(model, benchmark, rootOnly);
const right = await matchEntertainment(model, { ...benchmark, profiles: benchmark.profiles.slice(0, 3) }, rootOnly);
check('user record completeness does not depend on the reference set', () => {
  assert.equal(left.reasoningDepthPercent, right.reasoningDepthPercent);
  assert(left.recordCompleteness);
  assert.deepEqual(left.recordCompleteness, right.recordCompleteness);
});
check('unconfirmed/test references do not appear in ordinary comparisons', () => {
  assert(left.ranked.every(item => !['synthetic_stress_fixture', 'site_label_provisional'].includes(item.sourceStatus)));
});
check('mutual uncertainty is not positive similarity evidence', () => {
  assert.equal(left.decisiveSimilarities.length, 0);
  assert(left.ranked.every(item => item.similarityPercent === 0));
});
check('a completed checkpoint cannot be replaced by its older unfinished draft', () => {
  let state = answer(start('speech_restriction'), 'no');
  state = engine.openPolicy(model, state, 'metadata_surveillance');
  state = answer(state, 'uncertain');
  state = engine.openPolicy(model, state, 'speech_restriction');
  state = answer(state, 'uncertain');
  const completed = structuredClone(state.policyResults.speech_restriction);
  state = engine.openPolicy(model, state, 'metadata_surveillance');
  state = engine.openPolicy(model, state, 'speech_restriction');
  assert.deepEqual(state.policyResults.speech_restriction, completed);
  assert.equal(state.phase, engine.PHASES.POLICY_DONE);
});
check('paused review survives the results view and a second policy', () => {
  let state = answer(start('carbon_fee'), 'yes');
  state = answer(state, engine.getQuestion(model, state).options[0].id);
  const originalReason = state.currentReasonId;
  state = answer(state, 'save_unchecked');
  state = answer(state, 'results');
  state = engine.openPolicy(model, state, 'carbon_fee');
  state = engine.openPolicy(model, state, 'speech_restriction');
  state = answer(state, 'uncertain');
  state = engine.openPolicy(model, state, 'carbon_fee');
  state = answer(state, 'continue_review');
  assert.equal(state.currentReasonId, originalReason);
  assert.equal(state.phase, engine.PHASES.PREMISE_CHECK);
  assert.equal(state.policyResults.speech_restriction.rootAnswer, 'uncertain');
});
check('back within one policy leaves subsequently completed policies untouched', () => {
  let state = answer(start('speech_restriction'), 'no');
  state = engine.openPolicy(model, state, 'carbon_fee');
  state = answer(state, 'uncertain');
  const carbon = structuredClone(state.policyResults.carbon_fee);
  state = engine.openPolicy(model, state, 'speech_restriction');
  state = engine.back(state);
  assert.deepEqual(state.policyResults.carbon_fee, carbon);
  assert.equal(state.phase, engine.PHASES.POLICY_DECISION);
});
check('old sequential progress recovers only the revisions it necessarily recorded', () => {
  const oldModel = read('../public/bank/model-1.2.2.json');
  let old = engine.startSession(oldModel, engine.createSession(oldModel, { policyIds: ['speech_restriction'] }));
  old = engine.answer(oldModel, old, 'no');
  old = engine.answer(oldModel, old, 'reject');
  delete old.revisionAnswers;
  let state = normalizeCurrentState({ ...old, storageVersion: 10 }, model);
  state = answer(state, 'reject'); state = answer(state, 'reject');
  state = answer(state, 'no_match'); state = answer(state, 'leave_unresolved');
  assert.equal(validatePolicyResult(model, state.policyResults.speech_restriction).ok, true);
  assert.equal(Object.values(state.policyResults.speech_restriction.revisionAnswers).filter(value => value === 'reject').length, 3);
});
check('old expert modification labels are not rewritten as newly granted powers', () => {
  const oldModel = read('../public/bank/model-1.2.2.json');
  let old = engine.startSession(oldModel, engine.createSession(oldModel, { policyIds: ['expert_referendum_delay'] }));
  old = engine.answer(oldModel, old, 'no');
  old = engine.answer(oldModel, old, 'accept');
  old = engine.answer(oldModel, old, 'no_match');
  old = engine.answer(oldModel, old, 'leave_unresolved');
  const result = old.policyResults.expert_referendum_delay;
  const summary = engine.summarizePolicyResult(model, result);
  assert(summary.changes.some(change => change.to.includes('只能建议暂停，并最多延迟三十天')));
  assert(summary.changes.every(change => !change.to.includes('由议会决定是否暂停')));
});
check('unconfirmed reason selections are validated but cannot claim a passed path', () => {
  let state = answer(start('carbon_fee'), 'yes');
  state = answer(state, engine.getQuestion(model, state).options[0].id);
  state = answer(state, 'save_unchecked');
  const result = state.policyResults.carbon_fee;
  assert.equal(validatePolicyResult(model, result).ok, true);
  const forged = structuredClone(result); forged.mainPaths[0].status = 'accepted';
  assert.equal(validatePolicyResult(model, forged).ok, false);
});
const optionalPolicyId = model.policies.find(policy => !model.product.defaultPolicyIds.includes(policy.id)).id;
const withOptional = await matchEntertainment(model, benchmark, {
  ...rootOnly, [optionalPolicyId]: { policyId: optionalPolicyId, rootAnswer: 'uncertain' },
});
check('optional answers remain in user record counts without inflating core coverage', () => {
  assert.equal(withOptional.policyCoveragePercent, 100);
  assert.equal(withOptional.recordCompleteness.policyCount, model.product.defaultPolicyIds.length + 1);
  assert.equal(withOptional.reasoningDepthPercent, 10);
});
console.log(`UX integrity regressions passed: ${checks} assertions/groups.`);
