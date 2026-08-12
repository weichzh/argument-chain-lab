import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateReasonPath } from '../src/lib/formalValidator.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.0.0.json', import.meta.url), 'utf8'));
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
console.log('Reason-path validator tests passed.');
