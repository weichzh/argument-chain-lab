import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bankDirectory = path.join(root, 'public', 'bank');
const manifestPath = path.join(bankDirectory, 'manifest.json');

const readJson = async (filename) => JSON.parse(await fs.readFile(filename, 'utf8'));

export async function loadCurrentFormalModel() {
  const manifest = await readJson(manifestPath);
  if (manifest?.schema !== 'argument-chain-bank-manifest' || manifest?.version !== 1) {
    throw new Error('Bank manifest schema is not supported.');
  }
  const selected = manifest.models?.find((entry) => entry.version === manifest.current);
  if (!selected?.path) throw new Error('Bank manifest has no current model path.');

  const modelPath = path.resolve(bankDirectory, selected.path);
  const boundary = `${bankDirectory}${path.sep}`;
  if (!modelPath.startsWith(boundary)) throw new Error('Bank model path escapes public/bank.');

  const model = await readJson(modelPath);
  if (model?.meta?.version !== manifest.current) {
    throw new Error(`Bank model version ${model?.meta?.version} does not match manifest ${manifest.current}.`);
  }
  return { root, manifest, selected, model, modelPath };
}
