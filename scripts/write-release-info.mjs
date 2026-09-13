import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Cannot identify the built source revision.');
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
const manifest = readJson('dist/client/bank/manifest.json');
const model = manifest.models.find((item) => item.status === 'current' && item.version === manifest.default);
if (!model) throw new Error('Built bank has no current model.');
const release = {
  schema: 'argument-chain-release',
  applicationVersion: readJson('package.json').version,
  modelVersion: manifest.default,
  sourceCommit: commit,
  sourceDirty: dirty,
  modelSha256: createHash('sha256').update(readFileSync(`dist/client/bank/${model.path}`)).digest('hex'),
  builtAt: new Date().toISOString(),
};
writeFileSync('dist/client/release.json', `${JSON.stringify(release, null, 2)}\n`);
console.log(`Release metadata: application ${release.applicationVersion}, model ${release.modelVersion}, clean source=${!dirty}`);
