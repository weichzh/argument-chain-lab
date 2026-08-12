import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canPromoteLegacyRecord, migrateLegacySessionV09 } from '../src/lib/sessionMigration.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.0.json', import.meta.url), 'utf8'));
const modelV10 = JSON.parse(fs.readFileSync(new URL('../public/bank/legacy/model-1.0.0.json', import.meta.url), 'utf8'));
const legacy = {
  modelVersion: '0.9.0',
  records: {
    speech_restriction: {
      stance: 'conditional',
      status: 'conditional',
      policyChoiceResponses: { penalty_power: 'civil_only' },
      chains: [{ id: 'legacy_chain', targetClaimId: 'speech_support' }],
    },
  },
  conflicts: [{ propositionId: 'legacy_fact' }],
  modelGaps: [{ summary: '旧题库缺口' }],
};

const migrated = migrateLegacySessionV09(legacy, model);
assert.equal(migrated.modelVersion, '1.2.0');
assert.deepEqual(migrated.policyResults, {});
assert.equal(migrated.legacyArchive.policies[0].oldStance, 'conditional');
assert.equal(migrated.legacyArchive.policies[0].oldPolicyChoiceResponses.penalty_power, 'civil_only');
assert.equal(migrated.legacyArchive.snapshot.records.speech_restriction.chains[0].id, 'legacy_chain');
assert.match(migrated.migrationNotice, /重新回答/);
assert.equal(canPromoteLegacyRecord(legacy.records.speech_restriction), false);

for (const previous of modelV10.policies) {
  const current = model.policies.find((policy) => policy.id === previous.id);
  assert(current, `1.2 removed policy/${previous.id}`);
  assert.equal(current.rootFrameId, previous.rootFrameId);
  assert.deepEqual(Object.keys(current.dimensions), Object.keys(previous.dimensions));
  for (const dimensionId of Object.keys(previous.dimensions)) {
    assert.deepEqual(
      Object.keys(current.dimensions[dimensionId].values),
      Object.keys(previous.dimensions[dimensionId].values),
    );
  }
  assert.deepEqual(Object.keys(current.frames), Object.keys(previous.frames));
  assert.deepEqual(
    current.diagnostics.map(({ id, candidateFrameId, changedDimensionIds, acceptedClaimId, counterClaimId }) => (
      { id, candidateFrameId, changedDimensionIds, acceptedClaimId, counterClaimId }
    )),
    previous.diagnostics.map(({ id, candidateFrameId, changedDimensionIds, acceptedClaimId, counterClaimId }) => (
      { id, candidateFrameId, changedDimensionIds, acceptedClaimId, counterClaimId }
    )),
  );
}
for (const [id, previous] of Object.entries(modelV10.claims)) {
  const current = model.claims[id];
  assert(current, `1.2 removed claims/${id}`);
  for (const key of ['policyId', 'frameId', 'direction']) assert.equal(current[key], previous[key]);
}
for (const [id, previous] of Object.entries(modelV10.reasons)) {
  const current = model.reasons[id];
  assert(current, `1.2 removed reasons/${id}`);
  assert.equal(current.targetClaimId, previous.targetClaimId);
  assert.equal(current.bridgeClaimId, previous.bridgeClaimId);
  assert.deepEqual(current.premises.map((premise) => premise.id), previous.premises.map((premise) => premise.id));
}
console.log('Conservative session migration tests passed.');
