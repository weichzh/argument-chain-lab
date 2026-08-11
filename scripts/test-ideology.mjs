import assert from 'node:assert/strict';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';
import {
  argumentsById,
  configureFormalModel,
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
Object.entries(variant.policyPositions).forEach(([policyId, stance], policyIndex) => {
  const reasonFamilyId = variant.primaryReasons[policyId];
  const argument = Object.values(argumentsById).find((item) => (
    item.reasonFamilyId === reasonFamilyId
    && policies.find((policy) => policy.id === policyId)?.[stance === 'oppose' ? 'opposeClaimId' : 'supportClaimId'] === item.targetClaimId
  ));
  records[policyId] = {
    policyId,
    stance,
    direction: stance,
    componentPositions: Object.fromEntries(
      policies.find((policy) => policy.id === policyId).components
        .flatMap((component) => variant.componentPositions[component.id] ? [[component.id, variant.componentPositions[component.id]]] : []),
    ),
    chains: [{
      id: `chain_${policyIndex}`,
      policyId,
      direction: stance,
      steps: argument ? [{ argumentId: argument.id }] : [],
      terminal: { claimId: variant.fixedPoints[policyId], status: 'provisional_fixed_point' },
      stress: { response: variant.stressBoundaries[policyId] },
      status: 'complete',
    }],
  };
});

const state = { ...createInitialState(), records };
const matching = matchIdeologyProfiles(state);
assert.equal(matching.matches[0].profile.name, 'Anarcho-Communism');
assert.equal(matching.matches[0].similarity, 100);
assert.equal(matching.coverage, 54, 'Coverage must reflect both answered policy breadth and available path dimensions.');

const draftState = {
  ...state,
  records: {
    ...state.records,
    emergency_powers: {
      policyId: 'emergency_powers',
      stance: 'support',
      componentPositions: { emergency_temporary_limit: 'support' },
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
assert.equal(profilePositionForPolicy(profile, variant, emergency), 'oppose');
assert.equal(selectNextAdaptivePolicy(createInitialState()).id, 'speech_restriction');

console.log('Ideology tests passed: path-weighted matching, missing-answer coverage, derived policy signals, adaptive selection, and stable share codes.');
