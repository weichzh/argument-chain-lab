import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createEmptyCommunityBank,
  findSensitiveContent,
  hashContributionPackage,
  normalizeContributionPackage,
  validateCandidateRecord,
  validateCommunityBank,
} from '../shared/contribution-contract.js';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    values.set(name.slice(2), value);
    index += 1;
  }
  for (const required of ['input', 'bank', 'processed-keys', 'rejected-keys', 'report']) {
    if (!values.has(required)) throw new Error(`Missing --${required}`);
  }
  return Object.fromEntries(values);
}

async function collectJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.json') ? [absolute] : [];
  }));
  return nested.flat().sort();
}

const r2KeyFor = (inputDirectory, filename) => (
  `candidates/v1/${path.relative(inputDirectory, filename).split(path.sep).join('/')}`
);

async function loadCommunityBank(filename) {
  if (!existsSync(filename)) return createEmptyCommunityBank();
  const value = JSON.parse(await readFile(filename, 'utf8'));
  const validation = validateCommunityBank(value);
  if (!validation.ok) {
    throw new Error(`Community bank is invalid: ${JSON.stringify(validation.issues)}`);
  }
  for (const [index, entry] of value.entries.entries()) {
    const hash = await hashContributionPackage(entry.contribution);
    if (!hash.ok || hash.value !== entry.contentHash) {
      throw new Error(`Community bank entry ${index} has a mismatched content hash.`);
    }
    if (findSensitiveContent(entry.contribution).length) {
      throw new Error(`Community bank entry ${index} contains sensitive content.`);
    }
  }
  return value;
}

function reasonCodes(validation) {
  return [...new Set(validation.map((entry) => entry.code))].sort();
}

async function writeLines(filename, lines) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDirectory = path.resolve(args.input);
  const bankFilename = path.resolve(args.bank);
  const files = await collectJsonFiles(inputDirectory);
  const bank = await loadCommunityBank(bankFilename);
  const knownHashes = new Set(bank.entries.map((entry) => entry.contentHash));
  const newEntries = [];
  const processedKeys = [];
  const rejectedKeys = [];
  const report = [];

  for (const filename of files) {
    const key = r2KeyFor(inputDirectory, filename);
    let record;
    try {
      record = JSON.parse(await readFile(filename, 'utf8'));
    } catch {
      rejectedKeys.push(key);
      report.push({ key, outcome: 'rejected', reasonCodes: ['invalid_json'] });
      continue;
    }

    const validation = validateCandidateRecord(record);
    if (!validation.ok) {
      rejectedKeys.push(key);
      report.push({ key, outcome: 'rejected', reasonCodes: reasonCodes(validation.issues) });
      continue;
    }
    const normalized = normalizeContributionPackage(record.contribution);
    const hash = normalized.ok ? await hashContributionPackage(normalized.value) : normalized;
    if (!normalized.ok || !hash.ok || hash.value !== record.contentHash) {
      rejectedKeys.push(key);
      report.push({ key, outcome: 'rejected', reasonCodes: ['content_hash_mismatch'] });
      continue;
    }
    const expectedKey = `candidates/v1/${hash.value.slice(7, 9)}/${hash.value.slice(7)}.json`;
    if (key !== expectedKey) {
      rejectedKeys.push(key);
      report.push({ key, outcome: 'rejected', reasonCodes: ['object_key_mismatch'] });
      continue;
    }
    const sensitive = findSensitiveContent(normalized.value);
    if (sensitive.length) {
      rejectedKeys.push(key);
      report.push({ key, outcome: 'rejected', reasonCodes: reasonCodes(sensitive) });
      continue;
    }

    processedKeys.push(key);
    if (knownHashes.has(hash.value)) {
      report.push({ key, outcome: 'duplicate', reasonCodes: [] });
      continue;
    }
    knownHashes.add(hash.value);
    newEntries.push({ contentHash: hash.value, contribution: normalized.value });
    report.push({ key, outcome: 'proposed', reasonCodes: [] });
  }

  if (newEntries.length) {
    bank.entries.push(...newEntries);
    bank.entries.sort((left, right) => left.contentHash.localeCompare(right.contentHash));
    await mkdir(path.dirname(bankFilename), { recursive: true });
    await writeFile(bankFilename, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  }

  await writeLines(path.resolve(args['processed-keys']), processedKeys);
  await writeLines(path.resolve(args['rejected-keys']), rejectedKeys);
  await mkdir(path.dirname(path.resolve(args.report)), { recursive: true });
  await writeFile(path.resolve(args.report), `${JSON.stringify({
    schema: 'argument-chain-review-report',
    version: 1,
    proposedCount: newEntries.length,
    duplicateCount: report.filter((entry) => entry.outcome === 'duplicate').length,
    rejectedCount: rejectedKeys.length,
    candidates: report,
  }, null, 2)}\n`, 'utf8');

  if (args['github-output']) {
    const output = [
      `candidate_count=${newEntries.length}`,
      `processed_count=${processedKeys.length}`,
      `rejected_count=${rejectedKeys.length}`,
    ].join('\n');
    await appendFile(path.resolve(args['github-output']), `${output}\n`, 'utf8');
  }

  console.log(`Review batch prepared: ${newEntries.length} proposed, ${processedKeys.length - newEntries.length} duplicate, ${rejectedKeys.length} rejected.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
