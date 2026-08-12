import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canPromoteLegacyRecord, migrateLegacySessionV09 } from '../src/lib/sessionMigration.js';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.0.0.json', import.meta.url), 'utf8'));
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
assert.equal(migrated.modelVersion, '1.0.0');
assert.deepEqual(migrated.policyResults, {});
assert.equal(migrated.legacyArchive.policies[0].oldStance, 'conditional');
assert.equal(migrated.legacyArchive.policies[0].oldPolicyChoiceResponses.penalty_power, 'civil_only');
assert.equal(migrated.legacyArchive.snapshot.records.speech_restriction.chains[0].id, 'legacy_chain');
assert.match(migrated.migrationNotice, /重新回答/);
assert.equal(canPromoteLegacyRecord(legacy.records.speech_restriction), false);
console.log('Conservative session migration tests passed.');
