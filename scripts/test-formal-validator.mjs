import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validatePolicyResult,
  validatePolicyResults,
  validateReasonPath,
} from '../src/lib/formalValidator.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.2.json', import.meta.url), 'utf8'));
const reason = model.reasons.r_speech_sanction_disproportionate;
const validPath = {
  rootClaimId: reason.targetClaimId,
  status: 'accepted',
  steps: [{
    claimId: reason.targetClaimId,
    reasonId: reason.id,
    premiseAnswers: Object.fromEntries(reason.premises.map((premise) => [premise.id, 'accept'])),
    bridgeClaimId: reason.bridgeClaimId,
    ruleAnswer: 'accept',
  }],
};

assert.deepEqual(validateReasonPath(model, validPath), { ok: true, status: 'accepted', errors: [] });

const wrongTarget = structuredClone(validPath);
wrongTarget.steps[0].claimId = 'c_speech_support_root';
assert.equal(validateReasonPath(model, wrongTarget).ok, false);

const missingPremise = structuredClone(validPath);
delete missingPremise.steps[0].premiseAnswers[reason.premises[0].id];
assert.equal(validateReasonPath(model, missingPremise).ok, false);

assert.equal(validateReasonPath(model, { customReason: { text: '自定义理由' } }).status, 'custom_unverified');

const validResult = {
  policyId: 'speech_restriction',
  rootFrameId: 'speech_root',
  rootAnswer: 'no',
  finalRootAnswer: 'no',
  acceptedRevisionFrameId: 'speech_civil_only',
  derivedConditionalAcceptance: true,
  diagnosisClaimId: 'c_speech_reject_sanction',
  mainPaths: [validPath],
  counterClaimId: 'c_speech_test_sanction_defense',
  counterPath: null,
  counterImpact: 'no_change',
};
assert.deepEqual(validatePolicyResult(model, validResult), { ok: true, errors: [], warnings: [] });

const unresolvedCounter = { ...validResult, counterImpact: 'uncertain' };
assert.deepEqual(validatePolicyResult(model, unresolvedCounter), { ok: true, errors: [], warnings: [] });
const missingCounter = { ...validResult, counterImpact: null };
assert.deepEqual(validatePolicyResult(model, missingCounter).warnings, ['这项政策尚未记录相反理由对判断的影响。']);

const wrongFinalAnswer = structuredClone(validResult);
wrongFinalAnswer.finalRootAnswer = 'yes';
assert.equal(validatePolicyResult(model, wrongFinalAnswer).ok, false);

const wrongPathRoot = structuredClone(validResult);
wrongPathRoot.mainPaths[0].rootClaimId = 'c_speech_support_root';
assert.equal(validatePolicyResult(model, wrongPathRoot).ok, false);

assert.equal(validatePolicyResults(model, { speech_restriction: validResult }).ok, true);
console.log('Reason-path validator tests passed.');
