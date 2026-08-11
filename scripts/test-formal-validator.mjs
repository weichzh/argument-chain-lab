import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalFormula,
  deriveAttackGraph,
  evaluateConstraint,
  evaluateFormalCheck,
  groundedLabelling,
  validateArgument,
} from '../src/lib/formalValidator.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { formalSchema, model } = await loadCurrentFormalModel();
const catalog = model.arglogicCatalog;
const bundle = { entities: model.formalEntities, formalIndex: model.formalIndex };
const argumentsList = Object.values(model.arguments);
const form = (argumentId) => structuredClone(model.arguments[argumentId].formalization);
const validateSchema = new Ajv2020({ allErrors: true, allowUnionTypes: true }).compile(formalSchema);
const instantiate = (value, bindings) => {
  if (typeof value === 'string' && value.startsWith('?')) return bindings[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => instantiate(item, bindings));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, instantiate(child, bindings)]));
};
const containsFormula = (container, target) => {
  if (canonicalFormula(container) === canonicalFormula(target)) return true;
  if (container?.not) return containsFormula(container.not, target);
  if (container?.and) return container.and.some((item) => containsFormula(item, target));
  if (container?.or) return container.or.some((item) => containsFormula(item, target));
  return container?.exists?.where ? containsFormula(container.exists.where, target) : false;
};
const firstAtom = (formula) => {
  if (formula?.pred) return formula;
  if (formula?.not) return firstAtom(formula.not);
  if (formula?.and) return formula.and.map(firstAtom).find(Boolean);
  if (formula?.or) return formula.or.map(firstAtom).find(Boolean);
  return formula?.exists?.where ? firstAtom(formula.exists.where) : null;
};

for (const argument of argumentsList) {
  const original = structuredClone(argument.formalization);
  const certificate = validateArgument(original, bundle, catalog);
  assert.equal(validateSchema(original), true, `${argument.id}: schema`);
  assert.equal(certificate.wellFormed, true, `${argument.id}: well formed`);
  assert.equal(certificate.locallyLicensed, true, `${argument.id}: locally licensed`);
  assert.match(certificate.certificateHash, /^sha256:[a-f0-9]{64}$/);

  const scheme = catalog.schemes.find((item) => item.id === original.schemeId);
  const required = instantiate(scheme.requiredPremises[0].pattern, original.bindings);
  const missing = structuredClone(original);
  const requiredIndex = missing.premises.findIndex((item) => containsFormula(item.formula, required));
  assert.notEqual(requiredIndex, -1, `${argument.id}: required premise fixture`);
  missing.premises.splice(requiredIndex, 1);
  assert(validateArgument(missing, bundle, catalog).errors.some((item) => item.code === 'MISSING_REQUIRED_PREMISE'));

  const wrongSort = structuredClone(original);
  const atom = wrongSort.premises.find((item) => item.formula?.pred)?.formula;
  assert(atom, `${argument.id}: atomic premise fixture`);
  atom.args[0] = typeof atom.args[0] === 'number' ? 'institution:state' : 42;
  assert(validateArgument(wrongSort, bundle, catalog).errors.some((item) => item.code === 'TYPE_MISMATCH'));

  const overreach = structuredClone(original);
  overreach.sourceTargetElementIds = [...(overreach.sourceTargetElementIds || []), 'element:mutation_overreach'];
  assert(validateArgument(overreach, bundle, catalog).errors.some((item) => item.code === 'CONCLUSION_OVERREACH'));

  const circular = structuredClone(original);
  circular.premises.push({
    id: 'mutation_conclusion',
    claimRef: circular.conclusion.claimRef,
    status: 'ordinary',
    formula: circular.conclusion.formula,
  });
  assert(validateArgument(circular, bundle, catalog).errors.some((item) => item.code === 'QUESTION_BEGGING'));

  const inconsistent = structuredClone(original);
  inconsistent.premises.push({
    id: 'mutation_negation',
    status: 'ordinary',
    formula: { not: firstAtom(inconsistent.premises[0].formula) },
  });
  assert(
    validateArgument(inconsistent, bundle, catalog).errors.some((item) => item.code === 'INCONSISTENT_PREMISES'),
    `${argument.id}: inconsistent mutation`,
  );

  const reordered = structuredClone(original);
  reordered.premises.reverse();
  const reorderedCertificate = validateArgument(reordered, bundle, catalog);
  assert.deepEqual(
    [reorderedCertificate.wellFormed, reorderedCertificate.locallyLicensed, reorderedCertificate.inferenceStatus],
    [certificate.wellFormed, certificate.locallyLicensed, certificate.inferenceStatus],
    `${argument.id}: premise order`,
  );

  const wordingOnly = structuredClone(argument);
  wordingOnly.summary = `${wordingOnly.summary}（措辞变体）`;
  assert.deepEqual(wordingOnly.formalization, argument.formalization, `${argument.id}: Chinese wording must not alter AST`);
}

const wrongDomainBridge = form('expert_referendum_veto_support_preserve_reviewable_correction_2');
wrongDomainBridge.schemeId = 'expression_error_correction';
assert(
  validateArgument(wrongDomainBridge, bundle, catalog).errors.some((item) => item.code === 'ACTION_KIND_MISMATCH'),
  'A bridge from another action domain must be rejected.',
);

const speechForm = form('speech_harm_support');
const speech = validateArgument(speechForm, bundle, catalog);
const factResponses = Object.fromEntries(speechForm.source.factIds.map((factId) => [factId, 'true']));
const openRuntime = evaluateFormalCheck(speech, speechForm, factResponses, 'accept', { modelVersion: model.meta.version });
assert.equal(openRuntime.evidenceStatus, 'established');
assert.equal(openRuntime.dialecticalStatus, 'undecided', 'An unanswered critical question is not a rejection.');
const resolvedQuestions = Object.fromEntries(speech.criticalQuestions.map((question) => [question.id, 'satisfied']));
const resolvedRuntime = evaluateFormalCheck(speech, speechForm, factResponses, 'accept', {
  modelVersion: model.meta.version,
  criticalQuestionResponses: resolvedQuestions,
});
assert.equal(resolvedRuntime.dialecticalStatus, 'accepted');
assert.equal(resolvedRuntime.openCriticalQuestions.length, 0);
assert.strictEqual(
  evaluateFormalCheck(speech, speechForm, factResponses, 'accept', {
    modelVersion: model.meta.version,
    criticalQuestionResponses: resolvedQuestions,
  }),
  resolvedRuntime,
  'Runtime certificates should be cached by model, argument, and answers.',
);
const rejectedFacts = { ...factResponses, [speechForm.source.factIds[0]]: 'false' };
assert.equal(evaluateFormalCheck(speech, speechForm, rejectedFacts, 'accept', {
  modelVersion: model.meta.version,
  criticalQuestionResponses: resolvedQuestions,
  dialecticalStatus: 'accepted',
}).dialecticalStatus, 'rejected', 'A graph label must not override failed evidence.');

const renamedCatalog = structuredClone(catalog);
const renamedForm = form('speech_harm_support');
const rename = (value) => {
  if (value === '?actor') return '?renamed_actor';
  if (Array.isArray(value)) return value.map(rename);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rename(child)]));
};
const schemeIndex = renamedCatalog.schemes.findIndex((item) => item.id === renamedForm.schemeId);
renamedCatalog.schemes[schemeIndex] = rename(renamedCatalog.schemes[schemeIndex]);
renamedForm.bindings['?renamed_actor'] = renamedForm.bindings['?actor'];
delete renamedForm.bindings['?actor'];
assert.equal(validateArgument(renamedForm, bundle, renamedCatalog).locallyLicensed, true, 'Alpha-renaming must preserve licensing.');

assert.equal(evaluateConstraint({ pred: 'Gte', args: ['?limit', 5] }, { '?limit': 10 }), true);
assert.equal(evaluateConstraint({ and: [
  { pred: 'Gte', args: ['?limit', 5] },
  { pred: 'Gte', args: ['?limit', 0] },
] }, { '?limit': 10 }), true, 'Adding an entailed strict constraint must preserve the result.');
assert.equal(evaluateConstraint({ or: [{ pred: 'P', args: [] }, { pred: 'Q', args: [] }] }, {}, { P: false, Q: true }), true);
const impossible = form('speech_harm_support');
impossible.bindings['?limit'] = 3;
impossible.constraints = [{ pred: 'Gte', args: ['?limit', 5] }];
assert(validateArgument(impossible, bundle, catalog).errors.some((item) => item.code === 'CONSTRAINT_UNSATISFIED'));

const target = form('severe_harm_to_security');
const undercutter = {
  argumentId: 'test_undercutter',
  premises: [{ formula: { pred: 'UndercutsRule', args: [target.bindings['?rule']] } }],
  conclusion: { formula: { pred: 'ReasonForRule', args: ['value:test', 'rule:test'] } },
};
const undercutAttacks = deriveAttackGraph([target, undercutter]);
assert(undercutAttacks.some((edge) => edge.sourceArgumentId === 'test_undercutter'
  && edge.targetArgumentId === target.argumentId && edge.kind === 'undercut'));
assert.equal(groundedLabelling([target.argumentId], [])[target.argumentId], 'accepted');
const undercutLabels = groundedLabelling([target.argumentId, undercutter.argumentId], undercutAttacks);
assert.equal(undercutLabels[target.argumentId], 'rejected');
assert.equal(undercutLabels[undercutter.argumentId], 'accepted');
assert.deepEqual(
  groundedLabelling(['reason_a', 'reason_b'], []),
  { reason_a: 'accepted', reason_b: 'accepted' },
  'Independent reasons must not overwrite each other.',
);

const indexedEdges = new Set(model.formalIndex.attacks.map((edge) => (
  `${edge.sourceArgumentId}|${edge.targetArgumentId}|${edge.kind}`
)));
const derivedEdges = deriveAttackGraph(argumentsList.map((argument) => argument.formalization));
assert.equal(derivedEdges.length, indexedEdges.size);
derivedEdges.forEach((edge) => assert(indexedEdges.has(`${edge.sourceArgumentId}|${edge.targetArgumentId}|${edge.kind}`)));

console.log(`ArgLogic tests passed: ${argumentsList.length} arguments, six mutations each, runtime cache, constraints, attack graph, and grounded properties.`);
