import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CANDIDATE_RECORD_SCHEMA,
  canonicalizeContributionPackage,
  findSensitiveContent,
  hashContributionPackage,
  normalizeContributionPackage,
  validateCommunityBank,
  validateContributionPackage,
} from '../shared/contribution-contract.js';
import { handleRequest } from '../worker/src/index.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(await readFile(path.join(root, 'shared/fixtures/minimal-complete-contribution.json'), 'utf8'));
const clone = (value) => structuredClone(value);
const asLegacyContribution = (value) => {
  const legacy = clone(value);
  legacy.version = 2;
  delete legacy.checks.formalValidationVersion;
  delete legacy.checks.noFormalErrors;
  delete legacy.checks.formalizationCoverage;
  return legacy;
};

function expectIssue(value, code) {
  const result = validateContributionPackage(value);
  assert.equal(result.ok, false);
  assert(result.issues.some((entry) => entry.code === code), `Expected issue ${code}: ${JSON.stringify(result.issues)}`);
}

async function testContract() {
  assert.deepEqual(validateContributionPackage(fixture), { ok: true, issues: [] });

  const unknown = clone(fixture);
  unknown.sessionId = 'must-not-be-accepted';
  expectIssue(unknown, 'unknown_field');

  const nestedUnknown = clone(fixture);
  nestedUnknown.argument.steps[0].facts[0].rawInput = 'must-not-be-accepted';
  expectIssue(nestedUnknown, 'unknown_field');

  const incomplete = clone(fixture);
  incomplete.status = 'conditional';
  expectIssue(incomplete, 'invalid_value');

  const falseFact = clone(fixture);
  falseFact.argument.steps[0].facts[0].response = 'false';
  expectIssue(falseFact, 'invalid_value');

  const missingDefeaterReview = clone(fixture);
  delete missingDefeaterReview.argument.defeaterReview;
  expectIssue(missingDefeaterReview, 'required');

  const invalidDefeaterEffect = clone(fixture);
  invalidDefeaterEffect.argument.defeaterReview.effect = 'identity_label';
  expectIssue(invalidDefeaterEffect, 'invalid_value');

  const conflict = clone(fixture);
  conflict.checks.noUnresolvedConflicts = false;
  expectIssue(conflict, 'invalid_value');

  const invalidCoverage = clone(fixture);
  invalidCoverage.checks.formalizationCoverage = 'claimed_complete';
  expectIssue(invalidCoverage, 'invalid_value');

  const legacy = asLegacyContribution(fixture);
  assert.equal(validateContributionPackage(legacy).ok, false, 'The live endpoint must not accept new legacy packages.');
  assert.deepEqual(validateContributionPackage(legacy, { allowLegacy: true }), { ok: true, issues: [] });
  assert.equal((await hashContributionPackage(legacy, { allowLegacy: true })).ok, true);

  const hiddenControl = clone(fixture);
  hiddenControl.argument.target.text += '\u202E';
  hiddenControl.argument.steps[0].target.text = hiddenControl.argument.target.text;
  expectIssue(hiddenControl, 'unsafe_text_control');

  const placeholder = clone(fixture);
  placeholder.argument.target.text = '未命名结论';
  placeholder.argument.steps[0].target.text = placeholder.argument.target.text;
  expectIssue(placeholder, 'placeholder_content');

  const brokenLink = clone(fixture);
  brokenLink.argument.steps.push(clone(brokenLink.argument.steps[0]));
  brokenLink.argument.steps[0].bridge.kind = 'bridge';
  brokenLink.argument.steps[1].target.text = '另一条原则';
  expectIssue(brokenLink, 'chain_link_mismatch');

  const earlyTerminal = clone(fixture);
  earlyTerminal.argument.steps.push(clone(earlyTerminal.argument.steps[0]));
  earlyTerminal.argument.steps[1].target = { kind: 'bridge', text: earlyTerminal.argument.steps[0].bridge.text };
  expectIssue(earlyTerminal, 'nonfinal_bridge_must_be_bridge');

  const spaced = clone(fixture);
  spaced.argument.target.text = `  ${spaced.argument.target.text}  `;
  spaced.argument.steps[0].target.text = spaced.argument.target.text;
  const normalized = normalizeContributionPackage(spaced);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.value.argument.target.text, fixture.argument.target.text);
  assert.equal(canonicalizeContributionPackage(normalized.value).ok, true);
  assert.equal((await hashContributionPackage(normalized.value)).value, (await hashContributionPackage(fixture)).value);

  const sensitive = clone(fixture);
  sensitive.argument.target.text = '请联系 someone@example.com 讨论这项政策。';
  assert.deepEqual(findSensitiveContent(sensitive), [{ path: '$.argument.target.text', code: 'email_address' }]);
  assert.deepEqual(findSensitiveContent({ date: '2026-07-13' }), []);
  assert.deepEqual(findSensitiveContent({ source: 'https://example.test/path' }), [{ path: '$.source', code: 'external_url' }]);
  assert.deepEqual(findSensitiveContent({ note: 'api_key=do-not-store-this' }), [{ path: '$.note', code: 'secret_assignment' }]);
}

function createBucket() {
  const objects = new Map();
  return {
    objects,
    async head(key) {
      return objects.has(key) ? { key } : null;
    },
    async put(key, body, options) {
      objects.set(key, { body, options });
    },
  };
}

async function jsonBody(response) {
  return JSON.parse(await response.text());
}

async function testWorker() {
  const bucket = createBucket();
  const env = { CANDIDATES: bucket, ALLOWED_ORIGINS: 'https://example.test,http://localhost:5173' };
  const makeRequest = (body, headers = {}) => new Request('https://bank.example.test/v1/contributions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.test',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const accepted = await handleRequest(makeRequest(fixture), env);
  assert.equal(accepted.status, 202);
  const acceptedBody = await jsonBody(accepted);
  assert.equal(acceptedBody.accepted, true);
  assert.equal(acceptedBody.duplicate, false);
  assert.match(acceptedBody.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(bucket.objects.size, 1);

  const stored = JSON.parse([...bucket.objects.values()][0].body);
  assert.deepEqual(Object.keys(stored), ['schema', 'version', 'contentHash', 'contribution']);
  assert.equal(stored.schema, CANDIDATE_RECORD_SCHEMA);
  assert.equal(Object.hasOwn(stored.contribution, 'sessionId'), false);

  const duplicate = await handleRequest(makeRequest(fixture), env);
  assert.equal(duplicate.status, 200);
  assert.equal((await jsonBody(duplicate)).duplicate, true);
  assert.equal(bucket.objects.size, 1);

  const unknown = clone(fixture);
  unknown.provider = 'must-not-be-stored';
  const rejectedUnknown = await handleRequest(makeRequest(unknown), env);
  assert.equal(rejectedUnknown.status, 422);
  const rejectedUnknownBody = await jsonBody(rejectedUnknown);
  assert.equal(rejectedUnknownBody.error.code, 'invalid_contribution');
  assert.equal(JSON.stringify(rejectedUnknownBody).includes('must-not-be-stored'), false);
  assert.equal(bucket.objects.size, 1);

  const sensitive = clone(fixture);
  sensitive.argument.steps[0].facts[0].statement = '可通过 user@example.com 核实这句话。';
  const rejectedSensitive = await handleRequest(makeRequest(sensitive), env);
  assert.equal(rejectedSensitive.status, 422);
  assert.equal((await jsonBody(rejectedSensitive)).error.code, 'sensitive_content_detected');
  assert.equal(bucket.objects.size, 1);

  const forbiddenOrigin = await handleRequest(makeRequest(fixture, { Origin: 'https://wrong.example' }), env);
  assert.equal(forbiddenOrigin.status, 403);

  const tooLarge = await handleRequest(makeRequest(fixture, { 'Content-Length': '999999' }), env);
  assert.equal(tooLarge.status, 413);

  const encoded = await handleRequest(makeRequest(fixture, { 'Content-Encoding': 'gzip' }), env);
  assert.equal(encoded.status, 415);

  const wrongMethod = await handleRequest(new Request('https://bank.example.test/v1/contributions', { method: 'GET' }), env);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('Allow'), 'POST, OPTIONS');

  const failingStorage = {
    head: async () => null,
    put: async () => { throw new Error('private failure details'); },
  };
  const unavailable = await handleRequest(makeRequest(fixture), { ...env, CANDIDATES: failingStorage });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await jsonBody(unavailable), { error: { code: 'storage_unavailable' } });
}

async function makeRecord(contribution, options) {
  const hash = await hashContributionPackage(contribution, options);
  assert.equal(hash.ok, true);
  return {
    schema: CANDIDATE_RECORD_SCHEMA,
    version: 1,
    contentHash: hash.value,
    contribution,
  };
}

async function testReviewBatch() {
  const temporaryBase = path.join(root, '.tmp');
  await mkdir(temporaryBase, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(temporaryBase, 'argument-chain-review-'));
  assert(temporaryRoot.startsWith(temporaryBase));
  try {
    const input = path.join(temporaryRoot, 'input');
    const bank = path.join(temporaryRoot, 'community.json');
    const processed = path.join(temporaryRoot, 'processed.txt');
    const rejected = path.join(temporaryRoot, 'rejected.txt');
    const report = path.join(temporaryRoot, 'report.json');
    const githubOutput = path.join(temporaryRoot, 'github-output.txt');
    await writeFile(bank, JSON.stringify({ schema: 'argument-chain-community-bank', version: 1, entries: [] }));

    const valid = await makeRecord(fixture);
    const validDirectory = path.join(input, valid.contentHash.slice(7, 9));
    await mkdir(validDirectory, { recursive: true });
    await writeFile(path.join(validDirectory, `${valid.contentHash.slice(7)}.json`), JSON.stringify(valid));

    const legacy = await makeRecord(asLegacyContribution(fixture), { allowLegacy: true });
    const legacyDirectory = path.join(input, legacy.contentHash.slice(7, 9));
    await mkdir(legacyDirectory, { recursive: true });
    await writeFile(path.join(legacyDirectory, `${legacy.contentHash.slice(7)}.json`), JSON.stringify(legacy));

    const sensitiveContribution = clone(fixture);
    sensitiveContribution.argument.target.text = '请联系 reviewer@example.com';
    sensitiveContribution.argument.steps[0].target.text = sensitiveContribution.argument.target.text;
    const sensitive = await makeRecord(sensitiveContribution);
    const sensitiveDirectory = path.join(input, sensitive.contentHash.slice(7, 9));
    await mkdir(sensitiveDirectory, { recursive: true });
    await writeFile(path.join(sensitiveDirectory, `${sensitive.contentHash.slice(7)}.json`), JSON.stringify(sensitive));

    const invalid = clone(valid);
    invalid.contribution.aiConfig = { apiKey: 'not-allowed' };
    await writeFile(path.join(input, 'invalid.json'), JSON.stringify(invalid));

    const run = spawnSync(process.execPath, [
      path.join(root, 'scripts/prepare-review-batch.mjs'),
      '--input', input,
      '--bank', bank,
      '--processed-keys', processed,
      '--rejected-keys', rejected,
      '--report', report,
      '--github-output', githubOutput,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

    const bankValue = JSON.parse(await readFile(bank, 'utf8'));
    assert.equal(validateCommunityBank(bankValue).ok, true);
    assert.equal(bankValue.entries.length, 2);
    assert(bankValue.entries.some((entry) => entry.contentHash === valid.contentHash));
    assert(bankValue.entries.some((entry) => entry.contentHash === legacy.contentHash));

    const reportValue = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(reportValue.proposedCount, 2);
    assert.equal(reportValue.rejectedCount, 2);
    assert.equal(JSON.stringify(reportValue).includes('reviewer@example.com'), false);
    assert.match(await readFile(githubOutput, 'utf8'), /candidate_count=2/);
    assert.match(await readFile(processed, 'utf8'), new RegExp(`candidates/v1/${valid.contentHash.slice(7, 9)}/`));
    assert.match(await readFile(processed, 'utf8'), new RegExp(`candidates/v1/${legacy.contentHash.slice(7, 9)}/`));
    assert.equal((await readFile(rejected, 'utf8')).trim().split('\n').length, 2);

    const secondOutput = path.join(temporaryRoot, 'github-output-second.txt');
    const duplicateRun = spawnSync(process.execPath, [
      path.join(root, 'scripts/prepare-review-batch.mjs'),
      '--input', input,
      '--bank', bank,
      '--processed-keys', processed,
      '--rejected-keys', rejected,
      '--report', report,
      '--github-output', secondOutput,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(duplicateRun.status, 0, `${duplicateRun.stdout}\n${duplicateRun.stderr}`);
    const duplicateReport = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(duplicateReport.proposedCount, 0);
    assert.equal(duplicateReport.duplicateCount, 2);
    assert.match(await readFile(secondOutput, 'utf8'), /candidate_count=0/);

    const editedBank = JSON.parse(await readFile(bank, 'utf8'));
    const editedTarget = `${editedBank.entries[0].contribution.argument.target.text}（经审核修订）`;
    editedBank.entries[0].contribution.argument.target.text = editedTarget;
    editedBank.entries[0].contribution.argument.steps[0].target.text = editedTarget;
    await writeFile(bank, JSON.stringify(editedBank));
    const normalizeRun = spawnSync(process.execPath, [
      path.join(root, 'scripts/normalize-community-bank.mjs'),
      bank,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(normalizeRun.status, 0, `${normalizeRun.stdout}\n${normalizeRun.stderr}`);
    const normalizedBank = JSON.parse(await readFile(bank, 'utf8'));
    assert(normalizedBank.entries.some((entry) => entry.contribution.version === 2));
    const editedHash = await hashContributionPackage(normalizedBank.entries[0].contribution, { allowLegacy: true });
    assert.equal(editedHash.ok, true);
    assert.equal(normalizedBank.entries[0].contentHash, editedHash.value);
    assert.notEqual(normalizedBank.entries[0].contentHash, valid.contentHash);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function testCommittedCommunityBank() {
  const filename = path.join(root, 'public/bank/community-contributions-v1.json');
  const bank = JSON.parse(await readFile(filename, 'utf8'));
  const validation = validateCommunityBank(bank);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
  for (const entry of bank.entries) {
    const hash = await hashContributionPackage(entry.contribution, { allowLegacy: true });
    assert.equal(hash.ok, true);
    assert.equal(hash.value, entry.contentHash);
    assert.deepEqual(findSensitiveContent(entry.contribution), []);
  }
}

await testContract();
await testWorker();
await testReviewBatch();
await testCommittedCommunityBank();
console.log('Contribution contract, Worker, and review pipeline tests passed.');
