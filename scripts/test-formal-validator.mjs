import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  evaluateFormalCheck,
  validateArgument,
} from '../src/lib/formalValidator.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { formalSchema, model } = await loadCurrentFormalModel();
const catalog = model.arglogicCatalog;
const bundle = { entities: model.formalEntities };
const form = (argumentId) => structuredClone(model.arguments[argumentId].formalization);
const validateSchema = new Ajv2020({ allErrors: true, allowUnionTypes: true }).compile(formalSchema);

const speech = validateArgument(form('speech_harm_support'), bundle, catalog);
assert.equal(speech.wellFormed, true);
assert.equal(speech.locallyLicensed, true);
assert.equal(speech.inferenceStatus, 'open_critical_questions');

const invalidSchema = form('speech_harm_support');
invalidSchema.premises[0].status = 'bogus';
invalidSchema.extra = true;
assert.equal(validateSchema(invalidSchema), false);

const missing = form('speech_harm_support');
missing.premises = missing.premises.filter((premise) => premise.id !== 'no_less_restrictive_alt');
assert(validateArgument(missing, bundle, catalog).errors.some((item) => (
  item.code === 'MISSING_REQUIRED_PREMISE' && item.slot === 'no_less_restrictive_alt'
)));

const overreach = form('carbon_harm_support');
overreach.sourceTargetElementIds.push('element:equal_dividend');
assert(validateArgument(overreach, bundle, catalog).errors.some((item) => (
  item.code === 'CONCLUSION_OVERREACH'
  && item.unsupportedTargetElements.includes('element:equal_dividend')
)));

const circular = form('income_material_support');
circular.premises.push({
  id: 'smuggled_conclusion',
  claimRef: circular.conclusion.claimRef,
  status: 'ordinary',
  formula: circular.conclusion.formula,
});
assert(validateArgument(circular, bundle, catalog).errors.some((item) => item.code === 'QUESTION_BEGGING'));

const wrongDomain = form('expert_referendum_veto_support_preserve_reviewable_correction_2');
wrongDomain.schemeId = 'expression_error_correction';
assert(validateArgument(wrongDomain, bundle, catalog).errors.some((item) => item.code === 'ACTION_KIND_MISMATCH'));

const wrongContext = form('speech_harm_support');
wrongContext.premises[0].contextId = 'context:surveillance_program';
const wrongContextCertificate = validateArgument(wrongContext, bundle, catalog);
assert.equal(wrongContextCertificate.wellFormed, false);
assert.equal(wrongContextCertificate.locallyLicensed, false);
assert(wrongContextCertificate.errors.some((item) => item.code === 'CONTEXT_MISMATCH'));

const quantified = form('speech_harm_support');
quantified.premises[0].formula = {
  exists: {
    vars: ['?candidate'],
    where: { pred: 'Reduces', args: ['?candidate', quantified.bindings['?harm']] },
  },
};
assert(!validateArgument(quantified, bundle, catalog).errors.some((item) => item.code === 'UNBOUND_VARIABLE'));

const runtime = evaluateFormalCheck(
  speech,
  form('speech_harm_support'),
  Object.fromEntries(form('speech_harm_support').source.factIds.map((factId) => [factId, 'true'])),
  'accept',
);
assert.equal(runtime.evidenceStatus, 'established');
assert.equal(runtime.errors.length, 0);

const uncertainBridge = evaluateFormalCheck(speech, form('speech_harm_support'), {}, 'uncertain');
assert.equal(uncertainBridge.evidenceStatus, 'undetermined');

console.log('ArgLogic tests passed: typing, required premises, scope, circularity, quantifiers, and runtime evidence.');
