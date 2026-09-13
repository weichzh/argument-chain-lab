import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASES, answer, back, createSession, getQuestion, getReasonDirection,
  getReasonTargetId, startSession, summarizePolicyResult,
} from '../src/lib/decisionEngine.js';
import { validatePolicyResult, validateReasonPath } from '../src/lib/formalValidator.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.2.json', import.meta.url)));
const start = () => startSession(model, createSession(model, { policyIds: ['speech_restriction'] }));
const confirmFirstReason = (state) => {
  const reasonId = getQuestion(model, state).options.find((item) => model.reasons[item.id])?.id;
  assert(reasonId);
  let next = answer(model, state, reasonId);
  while (next.phase === PHASES.PREMISE_CHECK) next = answer(model, next, 'accept');
  next = answer(model, next, 'accept');
  assert.equal(next.phase, PHASES.WHY_OR_STOP);
  return next;
};
const mainPrinciple = () => confirmFirstReason(answer(model, answer(model, start(), 'no'), 'accept'));

for (const mode of ['main', 'counter']) {
  let state = mainPrinciple();
  if (mode === 'counter') {
    state = answer(model, answer(model, state, 'stop_here'), 'apply');
    state = confirmFirstReason(state);
  }
  const expectedTarget = state.currentBridgeClaimId;
  const prefix = structuredClone(state.currentPath.steps);
  state = answer(model, state, 'custom');
  assert.equal(state.activeClaimId, expectedTarget);
  assert.equal(getReasonTargetId(state), expectedTarget);
  assert.equal(getQuestion(model, state).statement, model.claims[expectedTarget].text);
  assert.equal(getReasonDirection(model, state), 'support');
  assert.equal(back(state).phase, PHASES.WHY_OR_STOP);
  const restored = { ...structuredClone(state), activeClaimId: state.currentPath.rootClaimId };
  assert.equal(getReasonTargetId(restored), expectedTarget, 'old in-progress targets must recover');
  assert.throws(() => answer(model, state, 'save_custom', {
    candidate: { target: { text: 'A different claim' } },
  }), /不能改写/);
  const text = `Continuation for ${mode}`;
  const saved = answer(model, restored, 'save_custom', { text });
  const path = mode === 'main' ? saved.mainPaths[0] : saved.counterPath;
  assert.deepEqual(path.steps, prefix);
  assert.equal(path.customTargetClaimId, expectedTarget);
  assert.equal(path.customReason.text, text);
  assert.equal(validateReasonPath(model, path).status, 'custom_unverified');
  const broken = structuredClone(path);
  broken.steps[0].claimId = 'wrong-target';
  assert.equal(validateReasonPath(model, broken).status, 'invalid');
  const wrongAttachment = structuredClone(path);
  wrongAttachment.customTargetClaimId = path.rootClaimId;
  assert.equal(validateReasonPath(model, wrongAttachment).status, 'invalid');
  if (mode === 'main') {
    const done = answer(model, saved, 'none').policyResults.speech_restriction;
    const summary = summarizePolicyResult(model, done);
    assert.equal(summary.deeperReason, text);
    assert.equal(summary.mainReasonTitle, model.reasons[prefix[0].reasonId].title);
    assert.equal(summary.customUnverified, true);
    assert.equal(validatePolicyResult(model, done).ok, true);
    delete done.mainPaths[0].customTargetClaimId;
    assert.equal(summarizePolicyResult(model, done).customTargetUnrecorded, true);
    assert.equal(summarizePolicyResult(model, done).deeperReason, null);
  }
}

{
  let state = answer(model, mainPrinciple(), 'custom');
  const prefix = structuredClone(state.currentPath.steps);
  state = answer(model, state, 'leave_unresolved');
  const result = state.policyResults.speech_restriction;
  assert.deepEqual(result.mainPaths[0].steps, prefix);
  assert.equal(result.mainPaths[0].status, 'unresolved');
  assert.equal(summarizePolicyResult(model, result).reasonUnresolved, true);
  assert.equal(validatePolicyResult(model, result).ok, true);
}

{
  const state = answer(model, answer(model, start(), 'no'), 'uncertain');
  const result = state.policyResults.speech_restriction;
  assert.equal(result.unresolvedRevisionFrameId, 'speech_civil_only');
  assert.equal(result.diagnosisClaimId, null);
  const summary = summarizePolicyResult(model, result);
  assert.equal(summary.unresolvedRevision, '只允许民事责任');
  assert(!summary.summary.includes('修改都不足以'));
  assert.equal(validatePolicyResult(model, result).ok, true);
  const legacy = { ...result };
  delete legacy.unresolvedRevisionFrameId;
  assert(!summarizePolicyResult(model, legacy).summary.includes('修改都不足以'));
}
console.log('Reason continuation and honest incomplete-result regressions passed.');
