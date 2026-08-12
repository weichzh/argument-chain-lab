import fs from 'node:fs/promises';
import { validateModel } from '../src/lib/decisionEngine.js';

const modelUrl = new URL('../public/bank/model-1.1.0.json', import.meta.url);
const model = JSON.parse(await fs.readFile(modelUrl, 'utf8'));
const report = validateModel(model);
if (!report.ok) throw new Error(report.errors.join('\n'));
await fs.writeFile(modelUrl, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
console.log(`Normalized dialogue model ${model.meta.version}.`);
