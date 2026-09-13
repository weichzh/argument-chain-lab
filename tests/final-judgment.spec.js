import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import { PHASES, answer, createSession, startSession, getQuestion } from '../src/lib/decisionEngine.js';
const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.2.json', import.meta.url)));
const step = (state, id) => answer(model, { ...state, history: [] }, id);
const confirm = (state) => {
  let s = step(state, getQuestion(model, state).options.find((item) => model.reasons[item.id]).id);
  while (s.phase === PHASES.PREMISE_CHECK) s = step(s, 'accept');
  return step(s, 'accept');
};
test('完整原方案的改判必须明确选择，案例原文保留在结果中', async ({ page }) => {
  let s = startSession(model, createSession(model, { policyIds: ['speech_restriction'] }));
  s = confirm(step(step(s, 'no'), 'accept'));
  s = step(step(s, 'stop_here'), 'apply');
  s = confirm(s);
  s = step(step(s, 'stop_here'), 'apply');
  await page.addInitScript((state) => localStorage.setItem('argument-chain-lab:progress:v10', JSON.stringify({ storageVersion: 10, view: 'questionnaire', ...state })), s);
  await page.goto('/');
  await expect(page.locator('.v4-question-card > header')).toContainText('认可一条局部理由，不等于接受整个方案');
  await page.getByRole('button', { name: '改为接受完整原方案', exact: true }).click();
  await page.getByRole('button', { name: '现在查看结果', exact: true }).click();
  await expect(page.locator('.v4-result-item')).toContainText('不应当 → 应当');
  await page.getByText('查看详细推理记录', { exact: true }).click();
  await expect(page.locator('.recorded-stress').first()).toContainText(s.mainPaths[0].stress.scenario);
  await expect(page.locator('.recorded-stress').first()).toContainText(s.mainPaths[0].stress.principle);
});
