import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODEL_META,
  argumentsById,
  claims,
  dilemmas,
  facts,
  policies,
  sources,
} from '../src/data/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const filename = `model-${MODEL_META.version}.json`;
const output = path.join(root, 'public', filename);

const payload = {
  schema: 'minimal-bridge-dialogue-model',
  schemaVersion: 3,
  meta: MODEL_META,
  typeRules: {
    minimalBridge: 'If V contains an evaluative predicate not definable in the descriptive vocabulary, F alone does not entail V: F1 ∧ … ∧ Fn ⊭ V.',
    operationalSupport: 'Ordinary policy paths are represented as defeasible support: F1 ∧ … ∧ Fn ∧ B ⇝ V.',
    strictEntailment: 'Use ⊨ only when B is explicitly sufficient and every premise relevant to the formal consequence has been included.',
    descriptive: 'Each F is represented as a bivalent proposition with truth and falsification conditions; unknown is an epistemic response, not a third truth value.',
    normative: 'Each B contains normative content and may become the V of a deeper recursive question.',
    terminal: 'A G node requires separate user nomination and explicit independent confirmation; running out of reasons does not create a fixed point.',
    dilemma: 'A dilemma is eligible only when both endpoint values were confirmed as provisional fixed points in this session.',
  },
  facts,
  claims,
  arguments: argumentsById,
  policies,
  dilemmas,
  sources,
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Created ${output}`);
