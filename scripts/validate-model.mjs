import crypto from 'node:crypto';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateBankManifest } from '../src/data/bank.js';
import { validateModel } from '../src/lib/decisionEngine.js';

const modelUrl = new URL('../public/bank/model-1.2.0.json', import.meta.url);
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
const selected = validateBankManifest(manifest);
if (manifest.default !== model.meta.version || selected.path !== 'model-1.2.0.json') {
  throw new Error('Manifest must load the 1.2 current model.');
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
const expected = { policies: 13, dimensions: 53, frames: 63, diagnostics: 50, claims: 197, reasons: 302, argumentSchemes: 11 };
if (JSON.stringify(counts) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected model counts: ${JSON.stringify(counts)}`);
}
if (model.product.defaultPolicyIds.length !== 8
  || model.product.entertainmentTieBreakerPolicyIds.length !== 5
  || new Set([...model.product.defaultPolicyIds, ...model.product.entertainmentTieBreakerPolicyIds]).size !== 13) {
  throw new Error('The 1.2 policy split must remain 8 core plus 5 optional precision questions.');
}

const bridgeClaims = new Set(Object.values(model.reasons).map((reason) => reason.bridgeClaimId));
if (bridgeClaims.size !== 71
  || [...bridgeClaims].some((claimId) => !model.claims[claimId]?.stressTest?.scenario
    || !model.claims[claimId]?.stressTest?.question)) {
  throw new Error('The 1.2 model must provide 71 concrete stress tests.');
}

console.log(JSON.stringify({
  modelVersion: model.meta.version,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  schemaValid,
  semanticValid: true,
  counts,
}, null, 2));
