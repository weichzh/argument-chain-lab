import crypto from 'node:crypto';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateModel } from '../src/lib/decisionEngine.js';

const modelUrl = new URL('../public/bank/model-1.0.0.json', import.meta.url);
const schemaUrl = new URL('../public/bank/model-v4.schema.json', import.meta.url);
const manifestUrl = new URL('../public/bank/manifest.json', import.meta.url);
const bytes = fs.readFileSync(modelUrl);
const model = JSON.parse(bytes);
const schema = JSON.parse(fs.readFileSync(schemaUrl, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
const schemaValid = ajv.validate(schema, model);
if (!schemaValid) {
  throw new Error(`JSON Schema validation failed:\n${ajv.errorsText(ajv.errors, { separator: '\n' })}`);
}

const semantic = validateModel(model);
if (!semantic.ok) throw new Error(`Semantic validation failed:\n${semantic.errors.join('\n')}`);
if (manifest.default !== model.meta.version || manifest.models.length !== 1) {
  throw new Error('Manifest must load only the 1.0 current model.');
}
if (!manifest.legacy?.every((item) => item.loadInProduct === false && item.status === 'archive_only')) {
  throw new Error('Legacy models must remain archive-only.');
}

const counts = {
  policies: model.policies.length,
  dimensions: model.policies.reduce((sum, policy) => sum + Object.keys(policy.dimensions).length, 0),
  frames: model.policies.reduce((sum, policy) => sum + Object.keys(policy.frames).length, 0),
  diagnostics: model.policies.reduce((sum, policy) => sum + policy.diagnostics.length, 0),
  claims: Object.keys(model.claims).length,
  reasons: Object.keys(model.reasons).length,
  argumentSchemes: Object.keys(model.argumentSchemes).length,
};
const expected = { policies: 8, dimensions: 33, frames: 39, diagnostics: 31, claims: 117, reasons: 173, argumentSchemes: 11 };
if (JSON.stringify(counts) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected model counts: ${JSON.stringify(counts)}`);
}

console.log(JSON.stringify({
  modelVersion: model.meta.version,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  schemaValid,
  semanticValid: true,
  counts,
}, null, 2));
