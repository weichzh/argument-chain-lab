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
  if (selected.benchmarks) {
    const benchmarkPath = path.resolve(bankDirectory, selected.benchmarks);
    if (!benchmarkPath.startsWith(boundary)) throw new Error('Bank benchmark path escapes public/bank.');
    model.ideologyBenchmarks = await readJson(benchmarkPath);
  }
  let formalSchemaPath = null;
  let formalSchema = null;
  if (selected.formalSchema || selected.formalSchemes) {
    if (!selected.formalSchema || !selected.formalSchemes) {
      throw new Error('Bank formal schema and scheme catalog must be configured together.');
    }
    formalSchemaPath = path.resolve(bankDirectory, selected.formalSchema);
    const formalSchemesPath = path.resolve(bankDirectory, selected.formalSchemes);
    const formalIndexPath = selected.formalIndex
      ? path.resolve(bankDirectory, selected.formalIndex)
      : null;
    if (!formalSchemaPath.startsWith(boundary)
      || !formalSchemesPath.startsWith(boundary)
      || (formalIndexPath && !formalIndexPath.startsWith(boundary))) {
      throw new Error('Bank formal asset path escapes public/bank.');
    }
    formalSchema = await readJson(formalSchemaPath);
    model.arglogicCatalog = await readJson(formalSchemesPath);
    model.formalIndex = formalIndexPath ? await readJson(formalIndexPath) : null;
    if (selected.formalReviews) {
      const formalReviewsPath = path.resolve(bankDirectory, selected.formalReviews);
      if (!formalReviewsPath.startsWith(boundary)) throw new Error('Bank formal review path escapes public/bank.');
      model.formalReviewBenchmark = await readJson(formalReviewsPath);
    }
  }
  return { root, manifest, selected, model, modelPath, formalSchemaPath, formalSchema };
}
