import fs from 'node:fs';
import { validateBankManifest } from '../src/data/bank.js';
export const bankUrl = new URL('../public/bank/', import.meta.url);
export const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', bankUrl), 'utf8'));
export const selected = validateBankManifest(manifest);
export const modelUrl = new URL(selected.path, bankUrl);
export const benchmarkUrl = new URL(manifest.entertainmentBenchmark.path, bankUrl);
export const model = JSON.parse(fs.readFileSync(modelUrl, 'utf8'));
export const benchmark = JSON.parse(fs.readFileSync(benchmarkUrl, 'utf8'));
