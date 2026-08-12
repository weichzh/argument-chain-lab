import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateModel } from '../src/lib/decisionEngine.js';

const source = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.0.0.json', import.meta.url), 'utf8'));
const mutate = (change) => {
  const model = structuredClone(source);
  change(model);
  return validateModel(model);
};

const mutations = [
  [(model) => model.product.entryAnswers.splice(2, 0, { id: 'conditional', label: '有条件支持' }), /root answers|Conditional acceptance/],
  [(model) => { delete model.policies[0].frames.speech_root.assignments.review; }, /root frame is not complete/],
  [(model) => { model.policies[0].diagnostics[0].changedDimensionIds = ['review']; }, /changedDimensionIds/],
  [(model) => {
    const claimId = model.policies[0].diagnostics[0].acceptedClaimId;
    const matching = Object.entries(model.reasons).filter(([, reason]) => reason.targetClaimId === claimId);
    delete model.reasons[matching[0][0]];
  }, /needs at least two reasons/],
  [(model) => {
    const reason = model.reasons.r_speech_support_harm;
    reason.bridgeClaimId = reason.targetClaimId;
    reason.formalization.bridgeClaimId = reason.targetClaimId;
  }, /Reason graph cycle/],
  [(model) => { model.reasons.r_speech_support_harm.premises[0].formula.args[0] = 'frame:not_registered'; }, /unknown formal entity/],
  [(model) => {
    model.policies[0].frames.speech_civil_only.changes.sanction = 'fine_or_detention';
  }, /equivalent frames|must differ/],
  [(model) => {
    model.reasons.r_speech_sanction_disproportionate.formalization.contextFrameId = 'speech_civil_only';
  }, /formal context/],
  [(model) => {
    model.reasons.r_speech_support_harm.premises = model.reasons.r_speech_support_harm.premises
      .filter((premise) => premise.role !== 'alternative');
  }, /missing required premise role alternative/],
  [(model) => {
    model.reasons = Object.fromEntries(Object.entries(model.reasons)
      .filter(([, reason]) => reason.targetClaimId !== 'n_proportionate_burden'));
  }, /Non-terminal bridge n_proportionate_burden has no deeper reasons/],
];

for (const [change, expected] of mutations) {
  const report = mutate(change);
  assert.equal(report.ok, false);
  assert(report.errors.some((error) => expected.test(error)), report.errors.join('\n'));
}

console.log(`Model mutation tests passed: ${mutations.length} invalid variants rejected.`);
