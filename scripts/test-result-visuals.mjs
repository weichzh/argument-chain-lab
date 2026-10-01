import assert from 'node:assert/strict';
import { model, benchmark } from './current-bank.mjs';
import { createUXFixture } from '../tests/fixtures/ux-session.js';
import { buildResultAtlas, boundaryFrames, reasonBranch, decisionJourney } from '../src/lib/resultVisuals.js';
import { referenceEvidenceRows, matchEntertainment, validateEntertainmentResult } from '../src/lib/entertainmentMatcher.js';

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
const fixture = createUXFixture();
const before = JSON.stringify(fixture);
const core = model.product.defaultPolicyIds;
check('core, optional, skipped and unfinished records use separate denominators', () => {
  const atlas = buildResultAtlas(model, fixture);
  assert.equal(atlas.completed, 8);
  assert.equal(Object.values(atlas.counts).reduce((a, b) => a + b), 8);
  const mixed = structuredClone(fixture);
  delete mixed.policyResults[core[1]];
  mixed.currentPolicyId = core[1];
  mixed.policyResults[core[0]] = { policyId: core[0], rootAnswer: 'skipped', finalRootAnswer: 'skipped' };
  mixed.policyResults.citizenship_membership = { policyId: 'citizenship_membership', rootAnswer: 'uncertain', finalRootAnswer: 'uncertain' };
  const next = buildResultAtlas(model, mixed);
  assert.equal(next.completed, 6);
  assert.equal(next.optionalCompleted, 1);
  assert.equal(next.counts.skipped, 1);
  assert.equal(next.counts.ongoing, 1);
});
check('empty and all-skipped sessions never report completed judgments', () => {
  const empty = { policyIds: core, policyResults: {}, startedAt: null };
  assert.equal(buildResultAtlas(model, empty).counts.untouched, 8);
  empty.policyResults = Object.fromEntries(core.map(policyId => [policyId, { policyId, rootAnswer: 'skipped', finalRootAnswer: 'skipped' }]));
  const atlas = buildResultAtlas(model, empty);
  assert.equal(atlas.completed, 0);
  assert.equal(atlas.counts.skipped, 8);
});
check('a reversed judgment is counted by its final answer without erasing the initial answer', () => {
  const record = { ...fixture.policyResults.speech_restriction, finalRootAnswer: 'yes', counterImpact: 'reverse' };
  const atlas = buildResultAtlas(model, { ...fixture, policyResults: { speech_restriction: record } });
  assert.equal(atlas.rows[0].status, 'accepted');
  assert.equal(atlas.rows[0].changed, true);
  assert.equal(decisionJourney(record).initial, '不接受原方案');
  assert.equal(decisionJourney(record).final, '接受原方案');
  assert.equal(boundaryFrames(model, record)[0].response, 'no');
});
check('uncertain, untested and accepted modifications remain distinct', () => {
  const record = fixture.policyResults.emergency_powers;
  const frames = boundaryFrames(model, record);
  assert.equal(frames[1].response, 'uncertain');
  assert(frames.slice(2).every(frame => frame.response === 'untested'));
  const accepted = boundaryFrames(model, fixture.policyResults.workplace_cogovernance);
  assert.equal(accepted[1].response, 'accept');
  assert(accepted.slice(2).every(frame => frame.response === 'untested'));
});
check('old missing history remains unrecorded and old frame text is retained', () => {
  const record = { ...fixture.policyResults.expert_referendum_delay, sourceModelVersion: '1.2.2' };
  const frames = boundaryFrames(model, record);
  assert(frames.slice(2).every(frame => frame.response === 'unrecorded'));
  assert.equal(frames[1].title, model.product.frameHistory['1.2.2'].expert_referendum_delay.frames[frames[1].id].label);
});
check('saved but unchecked choices have no confirmed links or passed cases', () => {
  const branch = reasonBranch(model, fixture.policyResults.metadata_surveillance);
  assert(branch.nodes.some(node => node.tone === 'pending'));
  assert(branch.nodes.every(node => !node.connected));
  assert(branch.nodes.some(node => node.kind === '相似案例' && node.tone === 'missing'));
});
check('retracted and disputed reasons are preserved without adopted links', () => {
  const record = structuredClone(fixture.policyResults.speech_restriction);
  record.mainPaths[0].status = 'retracted';
  record.mainPaths[0].stress.response = 'retract';
  record.rejectedReasonAttempts = [{ chainMode: 'counter', reasonId: 'r_speech_support_participation__v130', response: 'not_applicable', part: 'rule' }];
  const branch = reasonBranch(model, record);
  assert(branch.nodes.every(node => !node.connected));
  assert(branch.nodes.some(node => node.tone === 'retracted'));
  assert(reasonBranch(model, record, 'counter').nodes.some(node => node.tone === 'disputed'));
});
check('missing or self-written reasons do not acquire checked premises', () => {
  const record = { policyId: core[0], rootAnswer: 'no', mainPaths: [{ status: 'custom_unverified', steps: [], customReason: { text: '<b>原文保留</b>' } }] };
  const branch = reasonBranch(model, record);
  assert.equal(branch.nodes[0].title, '<b>原文保留</b>');
  assert(branch.nodes.every(node => !node.connected));
  assert.equal(reasonBranch(model, { rootAnswer: 'uncertain' }).nodes.length, 0);
});
check('broken premise or target records cannot draw confirmed links', () => {
  for (const mutation of ['premise', 'target']) {
    const record = structuredClone(fixture.policyResults.speech_restriction);
    if (mutation === 'premise') record.mainPaths[0].steps[0].premiseAnswers = {};
    else record.mainPaths[0].steps[0].claimId = 'different-target';
    const branch = reasonBranch(model, record);
    assert(branch.nodes.every(node => !node.connected));
    assert(branch.nodes.every(node => node.tone !== 'confirmed'));
  }
});
const liberal = benchmark.profiles.find(profile => profile.id === 'ideology:liberalism');
const cells = (records, profile = liberal) => referenceEvidenceRows(model, records, profile)[0].cells;
check('mutual uncertainty cannot become a matching initial judgment', () => {
  const profile = { expectedPaths: { [core[0]]: { rootAnswer: 'uncertain' } } };
  assert.equal(cells({ [core[0]]: { rootAnswer: 'uncertain' } }, profile)[0].status, 'missing');
});
check('missing reference records are gaps, not disagreements', () => {
  const row = cells({ [core[0]]: fixture.policyResults[core[0]] }, { expectedPaths: {} });
  assert.equal(row[0].status, 'missing');
  assert(!row.some(cell => cell.status === 'different' || cell.status === 'same'));
});
check('different reasoning targets are not labelled as matching reasons', () => {
  const policyId = 'speech_restriction';
  const record = fixture.policyResults[policyId];
  const profile = structuredClone(liberal);
  profile.expectedPaths[policyId] = { ...profile.expectedPaths[policyId], rootAnswer: 'yes', diagnosisClaimId: 'c_speech_support_root', canonicalReasonPath: record.mainPaths[0].steps.map(step => step.reasonId) };
  const row = cells({ [policyId]: record }, profile);
  assert.equal(row.find(cell => cell.key === 'reason').status, 'incomparable');
});
check('reference comparison cannot adopt retracted or unchecked reasons', () => {
  const record = structuredClone(fixture.policyResults.speech_restriction);
  record.mainPaths[0].status = 'retracted';
  record.mainPaths[0].stress.response = 'retract';
  assert.equal(cells({ speech_restriction: record }).find(cell => cell.key === 'reason').status, 'incomparable');
  assert.notEqual(cells({ metadata_surveillance: fixture.policyResults.metadata_surveillance }).find(cell => cell.key === 'reason').status, 'same');
});
check('historical changes to expert powers are explicitly not comparable', () => {
  const record = { ...fixture.policyResults.expert_referendum_delay, sourceModelVersion: '1.2.2' };
  assert.equal(cells({ expert_referendum_delay: record }).find(cell => cell.key === 'revision').status, 'incomparable');
});
const match = await matchEntertainment(model, benchmark, fixture.policyResults);
check('reference matrices are tied to their real data and reject altered explanations', () => {
  assert(match.candidateGroup.length > 0);
  const forged = structuredClone(match);
  forged.candidateGroup[0].evidenceRows[0].cells[0].userText = '编造的回答';
  assert.equal(validateEntertainmentResult(model, benchmark, fixture.policyResults, forged).ok, false);
});
check('visualization never mutates the session', () => assert.equal(JSON.stringify(fixture), before));
console.log(`Result visualization regressions passed: ${count} groups.`);
