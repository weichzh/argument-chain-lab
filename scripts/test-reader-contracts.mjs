import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHASES, answer, createSession, startSession, getQuestion, resolveFrame } from '../src/lib/decisionEngine.js';
import { comparableStressResponse } from '../src/lib/entertainmentMatcher.js';
import { validatePolicyResult } from '../src/lib/formalValidator.js';
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/bank/${name}`, import.meta.url)));
const model = read('model-1.2.2.json');
const previous = read('model-1.2.0.json');
const step = (state, id) => answer(model, { ...state, history: [] }, id);
const start = (policyId) => startSession(model, createSession(model, { policyIds: [policyId] }));
const firstReason = (state) => getQuestion(model, state).options.find((item) => model.reasons[item.id]);
const confirm = (state, id = firstReason(state).id) => {
  let current = step(state, id);
  while (current.phase === PHASES.PREMISE_CHECK) current = step(current, 'accept');
  return step(current, 'accept');
};
// This edition changes explanations, not the assigned policy choices or paths.
assert.deepEqual(model.reasons, previous.reasons);
assert.deepEqual(Object.keys(model.claims), Object.keys(previous.claims));
let comparisons = 0;
let rejectionBranches = 0;
for (const policy of model.policies) {
  const old = previous.policies.find((item) => item.id === policy.id);
  assert.deepEqual(policy.dimensions, old.dimensions);
  assert.deepEqual(policy.frames, old.frames);
  let state = step(start(policy.id), 'no');
  for (const diagnostic of policy.diagnostics) {
    const question = getQuestion(model, state);
    const dimensions = [...question.changes.map((item) => item.dimensionId), ...question.unchangedItems.map((item) => item.dimensionId)];
    assert.deepEqual(dimensions.sort(), Object.keys(policy.dimensions).sort());
    assert.equal(new Set(dimensions).size, dimensions.length);
    assert.equal(question.revisionNumber, policy.diagnostics.indexOf(diagnostic) + 1);
    assert.equal(question.revisionCount, policy.diagnostics.length);
    const root = resolveFrame(policy, policy.rootFrameId);
    for (const change of question.changes) {
      const originalLabel = policy.dimensions[change.dimensionId].values[root[change.dimensionId]].label;
      assert(model.claims[diagnostic.counterClaimId].text.includes(originalLabel));
    }
    assert(!diagnostic.explanation.includes('主要反对'));
    assert(!model.claims[diagnostic.acceptedClaimId].text.includes('关键在于'));
    state = step(state, 'reject');
    comparisons += 1;
  }
  assert(getQuestion(model, state).statement.includes('不等于你反对所有其他可能的方案'));
  for (const rootAnswer of ['yes', 'no']) {
    let rootState = step(start(policy.id), rootAnswer);
    if (rootAnswer === 'no') rootState = step(rootState, 'accept');
    const main = confirm(rootState);
    const counter = confirm(step(step(main, 'stop_here'), 'apply'));
    for (const initial of [main, counter]) {
      const deeper = getQuestion(model, initial).options.filter((item) => model.reasons[item.id]);
      for (const option of deeper) {
        for (const part of ['premise', 'rule']) {
          for (const response of ['reject', 'uncertain']) {
            let branch = step(initial, option.id);
            if (part === 'rule') {
              while (branch.phase === PHASES.PREMISE_CHECK) branch = step(branch, 'accept');
            }
            branch = step(branch, response);
            assert.equal(branch.phase, PHASES.WHY_OR_STOP);
            assert.equal(branch.currentBridgeClaimId, initial.currentBridgeClaimId);
            assert.deepEqual(branch.currentPath.steps, initial.currentPath.steps);
            const next = getQuestion(model, branch);
            assert(next.options.some((item) => item.id === 'stop_here'));
            assert(!next.options.some((item) => item.id === option.id));
            for (const alternative of next.options.filter((item) => model.reasons[item.id])) {
              assert.equal(model.reasons[alternative.id].targetClaimId, initial.currentBridgeClaimId);
              assert.doesNotThrow(() => step(branch, alternative.id));
            }
            assert.equal(step(branch, 'stop_here').phase, PHASES.STRESS_TEST);
            rejectionBranches += 1;
          }
        }
      }
    }
  }
}
assert.equal(comparisons, 50);
assert(rejectionBranches > 100);
assert(!model.policies[0].scenario.fixedConditions.some((item) => item.id === 'speech_public_context'));
assert(!model.policies[1].scenario.fixedConditions.some((item) => item.id === 'metadata_security_use'));
// Old confirmed text remains evidence from its original edition, not a new claim.
let customState = step(step(start('speech_restriction'), 'no'), 'accept');
customState = step(customState, 'no_match');
customState = answer(model, customState, 'save_custom', { text: 'A recorded personal reason.' });
const result = step(customState, 'none').policyResults.speech_restriction;
const oldResult = structuredClone(result);
oldResult.sourceModelVersion = '1.2.0';
oldResult.mainPaths[0].customReason = { target: { text: previous.claims.c_speech_reject_sanction.text }, argument: { title: 'A recorded personal reason.' } };
assert.equal(validatePolicyResult(model, oldResult).ok, true);
const forgedTarget = structuredClone(oldResult);
forgedTarget.mainPaths[0].customTargetClaimId = 'c_speech_support_root';
assert.equal(validatePolicyResult(model, forgedTarget).ok, false);
assert.equal(validatePolicyResult(model, { ...oldResult, sourceModelVersion: '1.2.2' }).ok, false);
console.log(JSON.stringify({ comparisons, rejectionBranches, unchangedPolicies: model.policies.length, unchangedReasons: Object.keys(model.reasons).length, legacyCandidatePreserved: true }));

for (const claimId of ['n_hierarchical_authority', 'v_hierarchical_order', 'n_sacred_public_order', 'n_expertise_can_delay', 'n_institutional_learning', 'n_emergency_power_strictly_limited']) {
  const path = { stress: { claimId, response: 'apply' } };
  assert.equal(comparableStressResponse(model, { sourceModelVersion: '1.2.0' }, path), null);
  assert.equal(comparableStressResponse(model, { sourceModelVersion: '1.2.2' }, path), 'apply');
}
assert(!model.claims.n_hierarchical_authority.stressTest.question.includes('等级本身足以'));
assert(!model.claims.n_sacred_public_order.stressTest.question.includes('神圣秩序本身足以'));
for (const initialAnswer of ['yes', 'no']) {
  let state = step(start('speech_restriction'), initialAnswer);
  if (initialAnswer === 'no') state = step(state, 'accept');
  state = confirm(state);
  const principle = state.currentBridgeClaimId;
  state = step(state, 'stop_here');
  assert.equal(getQuestion(model, state).principle, model.claims[principle].text);
  state = step(state, 'apply');
  assert.equal(state.mainPaths[0].stress.scenario, model.claims[principle].stressTest.scenario);
  state = confirm(state); state = step(step(state, 'stop_here'), 'apply');
  const question = getQuestion(model, state);
  assert(question.title.includes('完整原方案'));
  assert.equal(question.options.find((item) => item.id === 'reverse').label, initialAnswer === 'yes' ? '改为不接受完整原方案' : '改为接受完整原方案');
}
