import fs from 'node:fs/promises';
import { configureFormalModel } from '../src/data/model.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { manifest, model, modelPath } = await loadCurrentFormalModel();
configureFormalModel(model);
await fs.writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');

console.log(`Normalized formal bank ${manifest.current}: ${modelPath}`);
