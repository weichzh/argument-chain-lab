import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canPromoteLegacyRecord, migrateLegacySessionV09 } from '../src/lib/sessionMigration.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.1.0.json', import.meta.url), 'utf8'));
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
assert.equal(migrated.modelVersion, '1.1.0');
assert.deepEqual(migrated.policyResults, {});
assert.equal(migrated.legacyArchive.policies[0].oldStance, 'conditional');
assert.equal(migrated.legacyArchive.policies[0].oldPolicyChoiceResponses.penalty_power, 'civil_only');
assert.equal(migrated.legacyArchive.snapshot.records.speech_restriction.chains[0].id, 'legacy_chain');
assert.match(migrated.migrationNotice, /重新回答/);
assert.equal(canPromoteLegacyRecord(legacy.records.speech_restriction), false);

assert(modelV10.policies.every((policy) => (
  JSON.stringify(policy) === JSON.stringify(model.policies.find((item) => item.id === policy.id))
)));
for (const collection of ['claims', 'reasons']) {
  for (const [id, value] of Object.entries(modelV10[collection])) {
    assert(model[collection][id], `1.1 removed ${collection}/${id}`);
    const sharedValue = { ...value };
    const currentValue = { ...model[collection][id] };
    delete sharedValue.tags;
    delete currentValue.tags;
    assert.deepEqual(currentValue, sharedValue, `1.1 changed the compatible structure of ${collection}/${id}`);
  }
}
console.log('Conservative session migration tests passed.');
