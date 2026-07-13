import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');

const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/);
if (cssMatch) {
  const cssPath = path.join(dist, cssMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
  const css = await fs.readFile(cssPath, 'utf8');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  html = html.replace(cssMatch[0], () => `<style>${safeCss}</style>`);
}

const scriptMatch = html.match(/<script type="module"[^>]*src="([^"]+\.js)"[^>]*><\/script>/);
if (!scriptMatch) throw new Error('Vite entry script was not found.');
const scriptPath = path.join(dist, scriptMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
const script = await fs.readFile(scriptPath, 'utf8');
const safeScript = script.replace(/<\/script/gi, '<\\/script');
html = html.replace(scriptMatch[0], () => `<script type="module">${safeScript}</script>`);

const output = path.join(root, 'argument-chain-lab.html');
await fs.writeFile(output, html, 'utf8');
console.log(`Created ${output}`);
