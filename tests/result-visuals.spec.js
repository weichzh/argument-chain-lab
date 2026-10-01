import { expect, test } from 'playwright/test';
import { createUXFixture } from './fixtures/ux-session.js';
import { model } from '../scripts/current-bank.mjs';

const key = 'argument-chain-lab:progress:v10';
const seed = async (page, state = createUXFixture()) => {
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ ...state, storageVersion: 10, view: 'results', entertainmentEnabled: false }));
  }, { key, state });
  await page.goto('/');
  await expect(page.locator('.result-atlas')).toBeVisible();
};
const saved = page => page.evaluate(key => localStorage.getItem(key), key);
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const width of [320, 390, 768, 1440]) {
  test(`结果总览、方案轨迹和双分支在 ${width}px 可读`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await seed(page);
    const before = await saved(page);
    await expect(page.locator('.atlas-tiles[aria-label="八个核心情景"] > li')).toHaveCount(8);
    await expect(page.locator('.atlas-count')).toContainText('8 / 8');
    expect(await noOverflow(page)).toBe(true);
    if ([390, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`overview-${width}.png`) });
    const card = page.locator('#result-income_floor');
    if ([390, 1440].includes(width)) await card.screenshot({ path: info.outputPath(`boundary-${width}.png`), style: '.app-header { visibility: hidden; }' });
    await card.locator('.reasoning-detail > summary').click();
    await expect(card.locator('.branch-main')).toContainText('主要理由');
    await expect(card.locator('.branch-counter')).toContainText('相反理由');
    await expect(card.locator('.reasoning-outcome')).toContainText('不接受原方案');
    expect(await noOverflow(page)).toBe(true);
    if ([390, 1440].includes(width)) await card.locator('.reasoning-map').screenshot({ path: info.outputPath(`reasons-${width}.png`), style: '.app-header { visibility: hidden; }' });
    expect(await saved(page)).toBe(before);
    expect(errors).toEqual([]);
  });
}

test('方案轨迹可用键盘选择，未测试不假定为拒绝', async ({ page }) => {
  await seed(page);
  const before = await saved(page);
  const card = page.locator('#result-workplace_cogovernance');
  const untested = card.locator('.boundary-track button').nth(3);
  await untested.focus();
  await page.keyboard.press('Enter');
  await expect(untested).toHaveAttribute('aria-pressed', 'true');
  await expect(untested).toBeFocused();
  await expect(card.locator('.boundary-selection')).toContainText('本轮没有测试这个方案');
  await card.locator('.revision-diff-detail > summary').click();
  await expect(card.locator('.v4-result-changes')).toBeVisible();
  expect(await saved(page)).toBe(before);
});

test('跳转只阅读已有结果；未完成入口恢复到原位置', async ({ page }) => {
  const state = createUXFixture();
  delete state.policyResults.metadata_surveillance;
  state.currentPolicyId = 'metadata_surveillance';
  state.policyPosition = 1;
  state.phase = 'revision_test';
  state.rootAnswer = 'no';
  state.diagnosticIndex = 2;
  await seed(page, state);
  const before = await saved(page);
  await page.getByRole('link', { name: '碳费：接受原方案，查看判断边界', exact: true }).click();
  await expect.poll(() => page.locator('#result-carbon_fee').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(140);
  expect(await saved(page)).toBe(before);
  await page.getByRole('button', { name: '元数据收集：进行中，继续作答', exact: true }).click();
  await expect(page.locator('.revision-progress')).toContainText('3 / 4');
});

for (const rootAnswer of ['skipped', 'uncertain']) test(`全部 ${rootAnswer} 不会被当成接受原方案`, async ({ page }) => {
  const state = createUXFixture();
  state.policyResults = Object.fromEntries(model.product.defaultPolicyIds.map(policyId => [policyId, { policyId, rootAnswer, finalRootAnswer: rootAnswer, mainPaths: [] }]));
  await seed(page, state);
  await expect(page.locator('.atlas-count')).toContainText(`${rootAnswer === 'skipped' ? 0 : 8} / 8`);
  await expect(page.locator(`.atlas-tiles > li[data-state="${rootAnswer}"]`)).toHaveCount(8);
  await expect(page.locator('.atlas-tiles > li[data-state="accepted"]')).toHaveCount(0);
});

test('未检验与撤回在图中有文字标记且没有已确认连接', async ({ page }) => {
  const state = createUXFixture();
  const record = state.policyResults.speech_restriction;
  record.mainPaths[0].status = 'retracted';
  record.mainPaths[0].stress.response = 'retract';
  await seed(page, state);
  const unchecked = page.locator('#result-metadata_surveillance');
  await unchecked.locator('.reasoning-detail > summary').click();
  await expect(unchecked.locator('.reasoning-map')).toContainText('尚未检验');
  await expect(unchecked.locator('.reason-node[data-connected="true"]')).toHaveCount(0);
  const retracted = page.locator('#result-speech_restriction');
  await retracted.locator('.reasoning-detail > summary').click();
  await expect(retracted.locator('.reasoning-map')).toContainText('现已撤回');
  await expect(retracted.locator('.reason-node[data-connected="true"]')).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`参考矩阵 ${width}px 支持逐格阅读且不改变回答`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await seed(page);
    await page.getByRole('button', { name: '生成娱乐匹配', exact: true }).click();
    const first = page.locator('.reference-evidence').first();
    await expect(first).toBeVisible();
    const before = await saved(page);
    const cell = first.locator('.evidence-cell').nth(3);
    const name = await cell.getAttribute('aria-label');
    await cell.focus();
    await page.keyboard.press('Space');
    await expect(cell).toHaveAttribute('aria-pressed', 'true');
    await expect(cell).toBeFocused();
    await expect(first.locator('.evidence-inspector')).toContainText(name.split('：')[0]);
    await expect(first.locator('.evidence-inspector')).toContainText('你的记录');
    await expect(first.locator('.evidence-inspector')).toContainText('参考记录');
    expect(await noOverflow(page)).toBe(true);
    const rect = await cell.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.width).toBeGreaterThanOrEqual(44);
    await first.screenshot({ path: info.outputPath(`reference-${width}.png`), style: '.app-header { visibility: hidden; }' });
    expect(await saved(page)).toBe(before);
  });
}

test('200% 版式放大、打印和减少动画模式保留状态文字', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  expect(await noOverflow(page)).toBe(true);
  await expect(page.locator('.atlas-state').first()).toContainText('不接受');
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.emulateMedia({ media: 'print' });
  const marks = page.locator('#result-workplace_cogovernance .boundary-track button');
  await expect(marks.nth(1)).toBeVisible();
  await expect(marks.nth(1)).toContainText('接受');
  await expect(marks.nth(2)).toContainText('未测试');
});

test('自填内容仅作文字显示，图表不执行 HTML', async ({ page }) => {
  const state = createUXFixture();
  state.policyResults.speech_restriction.mainPaths = [{ rootClaimId: 'c_speech_reject_substance', status: 'custom_unverified', steps: [], customReason: { text: '<img src=x onerror="window.visualInjected=true">' } }];
  await seed(page, state);
  const card = page.locator('#result-speech_restriction');
  await card.locator('.reasoning-detail > summary').click();
  await expect(card.locator('.reasoning-map')).toContainText('<img src=x');
  await expect(card.locator('.reasoning-map img')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.visualInjected))).toBe(false);
});
