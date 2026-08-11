import assert from 'node:assert/strict';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';
import {
  argumentsById,
  configureFormalModel,
  getPolicyElements,
  ideologyBenchmarks,
  policies,
} from '../src/data/model.js';
import { createInitialState } from '../src/lib/engine.js';
import {
  buildArgumentType,
  matchIdeologyProfiles,
  profilePositionForPolicy,
  selectNextAdaptivePolicy,
} from '../src/lib/ideology.js';

const { model } = await loadCurrentFormalModel();
configureFormalModel(model);

const profile = ideologyBenchmarks.profiles.find((item) => item.name === 'Anarcho-Communism');
const variant = profile.variants[0];
const records = {};
Object.entries(variant.policyPositions).forEach(([policyId, position], policyIndex) => {
  const stance = position.stance;
  const reasonFamilyId = variant.primaryReasons[policyId];
  const argument = Object.values(argumentsById).find((item) => (
    item.reasonFamilyId === reasonFamilyId
    && policies.find((policy) => policy.id === policyId)?.[stance === 'oppose' ? 'opposeClaimId' : 'supportClaimId'] === item.targetClaimId
  ));
  const policy = policies.find((item) => item.id === policyId);
  const responses = { policyChoiceResponses: {}, safeguardResponses: {}, parameterResponses: {} };
  getPolicyElements(policy, ['policy_choice', 'safeguard', 'parameter']).forEach((element) => {
    const value = variant.componentPositions[element.id];
    if (!value) return;
    if (element.kind === 'policy_choice') responses.policyChoiceResponses[element.id] = value;
    if (element.kind === 'safeguard') responses.safeguardResponses[element.id] = { support: 'required', oppose: 'not_required', conditional: 'preferred' }[value];
    if (element.kind === 'parameter') responses.parameterResponses[element.id] = { support: 'accept', oppose: 'reject', conditional: 'adjust' }[value];
  });
  records[policyId] = {
    policyId,
    stance,
    direction: stance,
    packageStanceBeforeDefeater: stance,
    packageStanceAfterDefeater: stance,
    ...responses,
    chains: [{
      id: `chain_${policyIndex}`,
      policyId,
      direction: stance,
      steps: argument ? [{ argumentId: argument.id }] : [],
      terminal: { claimId: variant.fixedPoints[policyId], status: 'provisional_fixed_point' },
      stress: { response: variant.stressBoundaries[policyId] },
      defeaterReview: { effect: 'none_accepted', stanceBefore: stance, stanceAfter: stance },
      status: 'complete',
      argumentClosure: 'closed',
      matchingStatus: 'active',
    }],
  };
});

const state = { ...createInitialState(), records };
const matching = matchIdeologyProfiles(state);
assert.equal(matching.matches[0].profile.name, 'Anarcho-Communism');
assert.equal(matching.matches[0].similarity, 100);
assert.equal(matching.coverage, 60, 'Coverage must reflect item-level evidence and answered policy breadth.');

const speechRecord = records.speech_restriction;
const speechPolicy = policies.find((item) => item.id === 'speech_restriction');
const speechTargetClaimId = speechRecord.direction === 'oppose' ? speechPolicy.opposeClaimId : speechPolicy.supportClaimId;
const alternateArgument = Object.values(argumentsById).find((item) => (
  item.targetClaimId === speechTargetClaimId
  && item.reasonFamilyId !== variant.primaryReasons.speech_restriction
));
const multipleReasons = {
  ...state,
  records: {
    ...state.records,
    speech_restriction: {
      ...speechRecord,
      chains: [
        { ...speechRecord.chains[0], id: 'alternate_reason', steps: [{ argumentId: alternateArgument.id }] },
        speechRecord.chains[0],
      ],
    },
  },
};
assert.equal(matchIdeologyProfiles(multipleReasons).matches[0].similarity, 100, 'A second active reason must not erase another valid matching reason.');

const draftState = {
  ...state,
  records: {
    ...state.records,
    emergency_powers: {
      policyId: 'emergency_powers',
      stance: 'support',
      policyChoiceResponses: { emergency_powers_component_1: 'support' },
      chains: [],
    },
  },
};
assert.deepEqual(
  matchIdeologyProfiles(draftState),
  matching,
  'An unfinished draft must not change the nearest-neighbor result.',
);

const firstType = buildArgumentType(state, matching);
const secondType = buildArgumentType(state, matching);
assert.equal(firstType.code, secondType.code, 'The share code must be stable for a normalized argument graph.');

const emergency = policies.find((policy) => policy.id === 'emergency_powers');
assert.equal(profilePositionForPolicy(profile, variant, emergency), null, 'Tag heuristics must not enter final matching.');
assert.equal(profilePositionForPolicy(profile, variant, emergency, { allowHeuristic: true }).basis, 'tag_heuristic');
assert.equal(selectNextAdaptivePolicy(createInitialState()).id, 'speech_restriction');

const unresolved = {
  ...createInitialState(),
  records: {
    speech_restriction: {
      policyId: 'speech_restriction',
      stance: 'support',
      chains: [{ id: 'gap', policyId: 'speech_restriction', status: 'unresolved', matchingStatus: 'inactive', steps: [] }],
    },
  },
  modelGaps: [{ id: 'gap', policyId: 'speech_restriction' }],
};
assert.equal(matchIdeologyProfiles(unresolved).coverage, 0, 'Unresolved chains and model gaps must not add coverage.');

const withDilemma = {
  ...state,
  dilemmaResponses: { agency_vs_security: { response: 'left_strong' } },
};
assert.deepEqual(
  matchIdeologyProfiles(withDilemma),
  matching,
  'Dilemmas with no benchmark answers must have zero effective weight.',
);

console.log('Ideology tests passed: active-path matching, item coverage, benchmark boundaries, adaptive selection, and stable share codes.');
