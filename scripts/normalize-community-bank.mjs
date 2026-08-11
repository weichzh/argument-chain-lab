import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findSensitiveContent,
  hashContributionPackage,
  normalizeContributionPackage,
  validateCommunityBank,
} from '../shared/contribution-contract.js';

async function main() {
  const requested = process.argv[2];
  if (!requested || process.argv.length !== 3) {
    throw new Error('Usage: node scripts/normalize-community-bank.mjs <community-bank.json>');
  }
  const filename = path.resolve(requested);
  const bank = JSON.parse(await readFile(filename, 'utf8'));
  const validation = validateCommunityBank(bank);
  if (!validation.ok) throw new Error(`Community bank is invalid: ${JSON.stringify(validation.issues)}`);

  const seen = new Set();
  const entries = [];
  for (const [index, entry] of bank.entries.entries()) {
    const normalized = normalizeContributionPackage(entry.contribution, { allowLegacy: true });
    if (!normalized.ok) throw new Error(`Entry ${index} is invalid: ${JSON.stringify(normalized.issues)}`);
    if (findSensitiveContent(normalized.value).length) {
      throw new Error(`Entry ${index} contains sensitive content.`);
    }
    const hash = await hashContributionPackage(normalized.value, { allowLegacy: true });
    if (!hash.ok) throw new Error(`Entry ${index} cannot be hashed.`);
    if (seen.has(hash.value)) throw new Error(`Entry ${index} duplicates another contribution.`);
    seen.add(hash.value);
    entries.push({ contentHash: hash.value, contribution: normalized.value });
  }

  entries.sort((left, right) => left.contentHash.localeCompare(right.contentHash));
  await writeFile(filename, `${JSON.stringify({ ...bank, entries }, null, 2)}\n`, 'utf8');
  console.log(`Normalized ${entries.length} community contribution(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
