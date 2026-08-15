import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASES,
  answer,
  back,
  backToAnswer,
  createSession,
  diffFrames,
  getQuestion,
  openPolicy,
  resolveFrame,
  skipPolicy,
  startSession,
  summarizePolicyResult,
  validateModel,
} from '../src/lib/decisionEngine.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.0.json', import.meta.url), 'utf8'));
const validation = validateModel(model);
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(model.policies.length, 13);
assert.deepEqual(createSession(model).policyIds, model.product.defaultPolicyIds);
assert.deepEqual(model.product.entryAnswers.map((item) => item.id), ['yes', 'no', 'uncertain']);
assert.equal(JSON.stringify(model).includes('"conditional"'), false);

for (const policy of model.policies) {
  const root = resolveFrame(policy, policy.rootFrameId);
  assert.deepEqual(Object.keys(root).sort(), Object.keys(policy.dimensions).sort());
  for (const diagnostic of policy.diagnostics) {
    assert.deepEqual(
      diffFrames(policy, policy.rootFrameId, diagnostic.candidateFrameId).sort(),
      [...diagnostic.changedDimensionIds].sort(),
    );
  }
}

const newSpeechSession = () => startSession(model, createSession(model, { policyIds: ['speech_restriction'] }));

{
  const question = getQuestion(model, newSpeechSession());
  assert.equal(question.kind, 'policy_decision');
  assert.match(question.scenarioSummary, /这道题已经排除了/);
  assert.equal(question.proposalItems.length, Object.keys(model.policies[0].dimensions).length);
  assert(question.proposalItems.some((item) => (
    item.dimensionLabel === '处罚方式' && item.valueLabel === '可以罚款或拘留'
  )));
}

{
  let state = answer(model, newSpeechSession(), 'yes');
  assert.equal(state.phase, PHASES.REASON_CHOICE);
  assert.equal(state.activeClaimId, 'c_speech_support_root');
  assert.equal(state.answerLog.at(-1).answer, '应当');
}

{
  let state = answer(model, newSpeechSession(), 'no');
  assert.equal(state.phase, PHASES.REVISION_TEST);
  const question = getQuestion(model, state);
  assert.equal(question.candidateFrameId, 'speech_civil_only');
  assert.equal(question.title, '这样修改以后，你可以接受吗？');
  assert.deepEqual(question.changes, [{
    dimensionId: 'sanction',
    dimensionLabel: '处罚方式',
    fromId: 'fine_or_detention',
    fromLabel: '可以罚款或拘留',
    toId: 'civil_only',
    toLabel: '只允许较轻的民事责任',
  }]);
  state = answer(model, state, 'accept');
  assert.equal(state.acceptedRevisionFrameId, 'speech_civil_only');
  assert.equal(state.activeClaimId, 'c_speech_reject_sanction');
  assert.equal(back(state).phase, PHASES.REVISION_TEST);
}

{
  let state = answer(model, newSpeechSession(), 'no');
  for (const _diagnostic of model.policies[0].diagnostics) state = answer(model, state, 'reject');
  assert.equal(state.activeClaimId, 'c_speech_reject_substance');
}

{
  let state = answer(model, newSpeechSession(), 'no');
  state = answer(model, state, 'accept');
  state = answer(model, state, 'r_speech_sanction_disproportionate');
  while (state.phase === PHASES.PREMISE_CHECK) state = answer(model, state, 'accept');
  state = answer(model, state, 'accept');
  assert.equal(state.phase, PHASES.WHY_OR_STOP);
  state = answer(model, state, 'r_proportionate_burden_ground_1');
  while (state.phase === PHASES.PREMISE_CHECK) state = answer(model, state, 'accept');
  state = answer(model, state, 'accept');
  state = answer(model, state, 'stop_here');
  state = answer(model, state, 'apply');
  assert.equal(state.phase, PHASES.COUNTER_REASON_CHOICE);
  assert.equal(state.counterClaimId, 'c_speech_test_sanction_defense');
  state = answer(model, state, 'none');
  assert.equal(state.phase, PHASES.POLICY_DONE);
  const result = state.policyResults.speech_restriction;
  assert.equal(result.derivedConditionalAcceptance, true);
  const summary = summarizePolicyResult(model, result);
  assert.equal(summary.diagnosis, '罚款或拘留');
  assert(summary.changes.some((item) => item.dimensionId === 'sanction'));
  assert.equal(summary.mainReasonTitle, '罚款或拘留超过了必要程度');
  const retractedResult = structuredClone(result);
  retractedResult.mainPaths[0].status = 'retracted';
  const retractedSummary = summarizePolicyResult(model, retractedResult);
  assert.equal(retractedSummary.pathStatus, 'retracted');
  assert.equal(retractedSummary.deeperReason, null);
}

{
  let state = answer(model, newSpeechSession(), 'no');
  state = answer(model, state, 'accept');
  state = answer(model, state, 'no_match');
  state = answer(model, state, 'save_custom', { text: '较强处罚在这里造成了不必要的负担。' });
  assert.equal(state.phase, PHASES.COUNTER_REASON_CHOICE);
  assert.equal(state.mainPaths[0].status, 'custom_unverified');
}

{
  let state = answer(model, newSpeechSession(), 'uncertain');
  assert.equal(state.policyResults.speech_restriction.diagnosisClaimId, null);
  const firstAnswerId = state.answerLog[0].id;
  state = backToAnswer(state, firstAnswerId);
  assert.equal(state.phase, PHASES.POLICY_DECISION);
  assert.equal(state.answerLog.length, 0);
}

{
  let state = {
    ...newSpeechSession(),
    phase: PHASES.CUSTOM_REASON_REQUIRED,
    rootAnswer: 'no',
    acceptedRevisionFrameId: 'speech_civil_only',
    diagnosisClaimId: 'c_speech_reject_sanction',
    chainMode: 'counter',
    activeClaimId: 'c_speech_test_sanction_defense',
    counterClaimId: 'c_speech_test_sanction_defense',
  };
  state = answer(model, state, 'leave_unresolved');
  assert.equal(state.policyResults.speech_restriction.counterImpact, 'uncertain');
  assert.equal(state.policyResults.speech_restriction.finalRootAnswer, 'no');
}

{
  let state = startSession(model, createSession(model));
  state = skipPolicy(model, state);
  assert.equal(state.policyResults.speech_restriction.rootAnswer, 'skipped');
  assert.equal(state.currentPolicyId, 'metadata_surveillance');
  state = openPolicy(model, state, 'speech_restriction');
  assert.equal(state.policyResults.speech_restriction, undefined);
}

{
  const state = openPolicy(model, { ...createSession(model), startedAt: null }, 'speech_restriction');
  assert.match(state.startedAt, /^\d{4}-\d{2}-\d{2}T/);
}

{
  const state = openPolicy(model, createSession(model), 'citizenship_membership');
  assert.equal(state.currentPolicyId, 'citizenship_membership');
  assert.equal(state.policyIds.length, 9);
}

console.log(`Decision engine tests passed: ${model.policies.length} policies, ${Object.keys(model.reasons).length} reasons.`);
