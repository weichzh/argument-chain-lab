import fs from 'node:fs/promises';
import { configureFormalModel } from '../src/data/model.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { manifest, model, modelPath } = await loadCurrentFormalModel();
configureFormalModel(model);
const {
  arglogicCatalog: _formalRuntimeOnly,
  formalIndex: _formalIndexRuntimeOnly,
  formalReviewBenchmark: _formalReviewRuntimeOnly,
  ideologyBenchmarks: _runtimeOnly,
  ...formalModel
} = model;
await fs.writeFile(modelPath, `${JSON.stringify(formalModel, null, 2)}\n`, 'utf8');

console.log(`Normalized formal bank ${manifest.current}: ${modelPath}`);
