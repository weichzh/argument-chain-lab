import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import { model } from '../scripts/current-bank.mjs';
import * as engine from '../src/lib/decisionEngine.js';
import { createUXFixture } from './fixtures/ux-session.js';

const key = 'argument-chain-lab:progress:v10';
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
const start = async page => { await page.goto('/'); await click(page, '开始答题'); };
const choosePolicy = async (page, name) => {
  await click(page, '题目列表');
  await page.getByRole('button', { name: new RegExp(`^(继续|从这里开始|查看小结)：${name}$`) }).click();
};
const seed = async (page, state, view = 'questionnaire') => {
  await page.goto('/');
  await page.getByRole('heading', { name: '论证链实验室', exact: true }).waitFor();
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key, value: { ...state, storageVersion: 10, view },
  });
  await page.reload();
};

for (const width of [390, 1280]) test(`完整方案可读，选择区位置和横向宽度受控 ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await start(page);
  await expect(page.getByText('可以罚款或拘留', { exact: true })).toBeVisible();
  await expect(page.getByText('不额外要求书面理由和独立复核', { exact: true })).toBeVisible();
  await expect(page.locator('.v4-choice-list > button')).toHaveCount(3);
  const metrics = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    firstChoiceY: document.querySelector('.v4-choice-list > button').getBoundingClientRect().y,
    height: document.documentElement.scrollHeight,
  }));
  console.log('LAYOUT_METRICS', JSON.stringify(metrics));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
  expect(metrics.firstChoiceY).toBeLessThan(width === 390 ? 900 : 760);
  await testInfo.attach('layout-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath(`root-${width}.png`), fullPage: true });
});

test('跨题切换、刷新和回退不覆盖其他政策的进度', async ({ page }) => {
  await start(page);
  await click(page, '不应当');
  const first = await stored(page);
  await choosePolicy(page, '元数据收集');
  await click(page, '不应当');
  await choosePolicy(page, '表达处罚');
  expect((await stored(page)).phase).toBe(first.phase);
  expect((await stored(page)).answerLog.filter(entry => entry.policyId === 'speech_restriction')).toEqual(first.answerLog);
  await click(page, '上一题');
  await page.reload();
  await expect(page.locator('#current-question')).toContainText('国家是否应当处罚');
  await choosePolicy(page, '元数据收集');
  await expect(page.getByText('修改比较 1 / 4 · 每次都与原方案相比')).toBeVisible();
  expect((await stored(page)).rootAnswer).toBe('no');
});

test('完成结果和不确定原因可回看；重答可取消且只替换本题', async ({ page }) => {
  await start(page);
  await click(page, '不确定');
  await expect(page.getByRole('region', { name: '本题小结' })).toBeVisible();
  await page.getByText('补充不确定的原因（可选）', { exact: true }).click();
  await page.getByLabel('目前卡在哪里？').selectOption('definition');
  await page.getByLabel('还需要明确什么？').fill('需要更明确的适用范围。');
  await click(page, '保存未确定处');
  await click(page, '进入下一题');
  await click(page, '不确定');
  await choosePolicy(page, '表达处罚');
  await page.getByText('补充不确定的原因（可选）', { exact: true }).click();
  await expect(page.getByLabel('还需要明确什么？')).toHaveValue('需要更明确的适用范围。');
  const before = (await stored(page)).policyResults;
  page.once('dialog', dialog => dialog.dismiss());
  await click(page, '重新回答这题');
  expect((await stored(page)).policyResults).toEqual(before);
  page.once('dialog', dialog => dialog.accept());
  await click(page, '重新回答这题');
  const after = await stored(page);
  expect(after.policyResults.speech_restriction).toBeUndefined();
  expect(after.policyResults.metadata_surveillance).toEqual(before.metadata_surveillance);
});

test('先保存未检验理由后，可从结果页重新进入原检验位置', async ({ page }) => {
  await start(page);
  await choosePolicy(page, '碳费');
  await click(page, '应当');
  await page.locator('.v4-choice-list > button').first().click();
  await click(page, '先记录这条理由，暂不检验');
  await expect(page.getByRole('region', { name: '本题小结' })).toContainText('尚未检验');
  const result = (await stored(page)).policyResults.carbon_fee;
  expect(result.mainPaths[0].steps).toHaveLength(0);
  expect(result.mainPaths[0].status).toBe('unchecked');
  await click(page, '现在查看结果');
  await click(page, '继续核对理由');
  await click(page, '继续核对刚才的理由');
  await expect(page.locator('#current-question')).toHaveText('先核对一个假设');
  expect((await stored(page)).currentReasonId).toBe(result.mainPaths[0].selectedReasonId);
  expect((await stored(page)).policyResults.carbon_fee).toBeUndefined();
});

test('不确定不等于拒绝，继续比较后仍保留未确定处', async ({ page }) => {
  await start(page);
  await click(page, '不应当');
  await click(page, '不确定');
  await click(page, '保留不确定，继续比较其他修改');
  await click(page, '这样改以后仍不能接受');
  await click(page, '这样改以后仍不能接受');
  const result = (await stored(page)).policyResults.speech_restriction;
  expect(result.diagnosisClaimId).toBeNull();
  expect(result.revisionAnswers.speech_civil_only).toBe('uncertain');
  await expect(page.getByRole('region', { name: '本题小结' })).toContainText('还没有确定哪些修改');
  await click(page, '现在查看结果');
  await expect(page.locator('.v4-result-item')).not.toContainText('已经测试的修改都不足以改变');
});

test('修訂后的公共参与理由不再要求认可出身资源差距原则', async ({ page }) => {
  let state = engine.startSession(model, engine.createSession(model, { policyIds: ['speech_restriction'] }));
  state = engine.answer(model, state, 'yes');
  await seed(page, state);
  await page.getByRole('button', { name: '持续贬低会把一部分人排除出公共参与', exact: true }).click();
  while ((await stored(page)).phase === engine.PHASES.PREMISE_CHECK) await click(page, '先按这个情况继续');
  await expect(page.locator('#current-question').locator('..')).toContainText('公共参与因可识别的排斥而受损');
  await expect(page.locator('.v4-question-card')).not.toContainText('资源差距主要来自个人无法选择的出身');
  await click(page, '原则可以成立，但没有解释这里的担忧');
  await expect(page.getByRole('status')).toContainText('未认可原则在这里的适用');
  expect((await stored(page)).rejectedReasonAttempts[0].response).toBe('not_applicable');
});

test('可读导出含实际判断与未确定处，不含配置或凭据', async ({ page }) => {
  await start(page);
  await click(page, '不确定');
  await click(page, '现在查看结果');
  const downloading = page.waitForEvent('download');
  await click(page, '导出结果');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('argument-chain-results-1.3.0.md');
  const text = fs.readFileSync(await download.path(), 'utf8');
  expect(text).toContain('# 本轮判断记录');
  expect(text).toContain('表达处罚：暂不能判断');
  expect(text).not.toMatch(/apiKey|providerOptions|sessionUuid|cookies|cf_clearance/);
});

test('结果顺序先给出实际边界，参考比较保持按需且不泄露测试参考', async ({ page }, testInfo) => {
  const fixture = createUXFixture();
  await seed(page, fixture, 'results');
  await expect(page.getByRole('heading', { name: '这次判断的边界' })).toBeVisible();
  expect(await page.locator('.v4-result-list').evaluate(list => list.compareDocumentPosition(document.querySelector('.entertainment-opt-in')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await click(page, '生成娱乐匹配');
  await expect(page.getByRole('heading', { name: '对照具体记录，不给人贴标签' })).toBeVisible();
  await expect(page.locator('.reference-card-grid')).not.toContainText('仅供测试的假想参考');
  const titles = await page.locator('.reference-card-grid h4').allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'zh-CN')));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('results-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('results-mobile.png'), fullPage: true });
});
