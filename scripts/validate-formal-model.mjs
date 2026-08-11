import Ajv2020 from 'ajv/dist/2020.js';
import { validateArgument } from '../src/lib/formalValidator.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { formalSchema, model } = await loadCurrentFormalModel();
const failures = [];
const formalized = Object.values(model.arguments).filter((argument) => argument.formalization);
const bundle = { entities: model.formalEntities };
const validateSchema = new Ajv2020({ allErrors: true, allowUnionTypes: true }).compile(formalSchema);

for (const argument of formalized) {
  const form = argument.formalization;
  if (!validateSchema(form)) {
    validateSchema.errors.forEach((error) => failures.push(
      `${argument.id}: schema ${error.instancePath || '$'} ${error.message}.`,
    ));
  }
  if (form.argumentId !== argument.id) failures.push(`${argument.id}: formal argument id does not match.`);
  if (form.source?.targetClaimId !== argument.targetClaimId) failures.push(`${argument.id}: formal target does not match.`);
  if (form.source?.bridgeClaimId !== argument.bridgeClaimId) failures.push(`${argument.id}: formal bridge does not match.`);
  if (JSON.stringify(form.source?.factIds) !== JSON.stringify(argument.factIds)) {
    failures.push(`${argument.id}: formal source facts do not match.`);
  }
  if (form.conclusion?.claimRef !== argument.targetClaimId) failures.push(`${argument.id}: conclusion claim does not match.`);

  const mappedFacts = new Set((form.premises || []).map((premise) => premise.claimRef));
  argument.factIds.forEach((factId) => {
    if (!mappedFacts.has(factId)) failures.push(`${argument.id}: source fact ${factId} is not mapped to the AST.`);
  });
  for (const premise of form.premises || []) {
    if (premise.claimRef && !model.facts[premise.claimRef] && !model.claims[premise.claimRef]) {
      failures.push(`${argument.id}: premise references unknown claim ${premise.claimRef}.`);
    }
  }

  const certificate = validateArgument(form, bundle, model.arglogicCatalog);
  certificate.errors.forEach((error) => failures.push(`${argument.id}: ${error.code} ${error.message}`));
}

const corePolicies = model.policies.filter((policy) => policy.selection?.tier === 'core');
for (const policy of corePolicies) {
  const covered = formalized.some((argument) => argument.targetClaimId === policy.supportClaimId);
  if (!covered) failures.push(`${policy.id}: no formally checked core support path.`);
}

for (const argumentId of [
  'severe_harm_to_security',
  'deprivation_to_floor',
  'production_to_productive_self_governance',
  'reviewable_emergency_authority_to_constitutional_rule_of_law',
  'equal_membership_without_ancestry_to_universal_civic_equality',
  'local_feedback_to_decentralized_adaptation',
  'speech_correction_oppose',
  'expert_referendum_veto_support_preserve_reviewable_correction_2',
]) {
  if (!model.arguments[argumentId]?.formalization) failures.push(`${argumentId}: high-risk path is not formalized.`);
}

if (failures.length) {
  console.error(`Formal model validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Formal model ${model.meta.version} validation passed: ${formalized.length} arguments, ${corePolicies.length} core policies covered.`);
