#!/usr/bin/env node
/** Save the user's completed reference page without submitting answers. */
import { chromium } from 'playwright';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';

const endpoint = new URL(process.env.REFERENCE_CDP_URL || 'http://127.0.0.1:47833');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
  throw new Error('Only an explicitly local browser debugging endpoint is accepted.');
}
const directory = path.resolve(process.argv[2] || '.tmp/reference-human-result');
const browser = await chromium.connectOverCDP(endpoint.href, { timeout: 10000 });
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => {
  try {
    const url = new URL(candidate.url());
    return url.hostname === 'taketest.xyz' && url.pathname === '/us-politics' && !url.searchParams.has('skip');
  } catch { return false; }
});
if (!page) {
  console.error('The authorized reference questionnaire tab is not open. No page was captured.');
  process.exit(2);
}
const results = page.locator('#results-area');
if (!await results.isVisible() || await page.locator('#results-content').count() !== 1) {
  console.log('WAITING_FOR_USER: the questionnaire has not reached a completed result. Nothing was saved.');
  process.exit(2);
}
const text = await page.locator('#results-content').innerText();
if (text.trim().length < 80 || /Error loading results|Skip mode/i.test(text)) {
  console.log('WAITING_FOR_VALID_RESULT: result content is absent, a preview, or an error. Nothing was saved.');
  process.exit(2);
}
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
await writeFile(path.join(directory, 'rendered.html'), await page.content(), { mode: 0o600 });
const client = await page.context().newCDPSession(page);
const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' });
await writeFile(path.join(directory, 'result.mhtml'), data, { mode: 0o600 });
await page.screenshot({ path: path.join(directory, 'result.png'), fullPage: true });
await chmod(path.join(directory, 'result.png'), 0o600);
await client.detach();
console.log(`Saved rendered HTML, self-contained MHTML and screenshot to ${directory}. These are private user results; do not commit them.`);
// Disconnect only; the user's visible browser remains open and unchanged.
process.exit(0);
