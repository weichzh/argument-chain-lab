import { expect, test } from 'playwright/test';

test('完整论证只在明确同意后提交，并可刷新恢复报告', async ({ page }) => {
  const requests = [];
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.route('**/runtime-config.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: "window.__ARGUMENT_CHAIN_BANK_ENDPOINT__ = 'https://bank.test';",
  }));
  await page.route('https://bank.test/**', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ accepted: true, duplicate: false, contentHash: `sha256:${'a'.repeat(64)}` }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '从题库开始', exact: true }).click();
  await page.getByRole('button', { name: /^支持/ }).click();
  await page.getByRole('button', { name: /因为禁令确实能减少针对群体的重伤/ }).click();
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await page.getByRole('button', { name: '接受这条原则', exact: true }).click();
  await expect(page.getByLabel('这些都不符合我的想法')).toHaveCount(0);
  await page.getByRole('button', { name: /继续追问为什么/ }).click();
  await expect(page.getByLabel('这些都不符合我的想法')).toBeVisible();
  await page.getByRole('button', { name: /因为死亡和重伤会大幅减少人的行动能力/ }).click();
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await page.getByRole('button', { name: '接受这条原则', exact: true }).click();
  await page.getByRole('button', { name: '是，我现在直接接受它', exact: true }).click();
  await page.getByRole('button', { name: '仍然适用', exact: true }).click();
  await page.getByRole('button', { name: '查看完整预览', exact: true }).click();

  await expect(page.getByRole('heading', { name: '本轮机械报告' })).toBeVisible();
  await expect(page.locator('.report-step')).toHaveCount(2);
  await expect(page.getByText('正式题库 0.5.0').first()).toBeVisible();
  await expect(page.locator('.report-list').filter({ hasText: '已确认' })).toContainText('避免人的死亡、重伤和严重身体损害');
  expect(requests).toHaveLength(0);

  await page.getByRole('checkbox', { name: /我已检查完整预览/ }).check();
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: '贡献到公开题库', exact: true }).click();
  await expect(page.getByText('已进入公开审核候选区。')).toBeVisible();
  expect(requests).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { name: '本轮机械报告' })).toBeVisible();
  await expect(page.locator('.report-step')).toHaveCount(2);
  expect(browserErrors).toEqual([]);
});

test('移动端配置清除后不保留明文密钥且页面无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTitle('AI 配置').click();
  await page.getByLabel('粘贴配置文本').fill(JSON.stringify({
    schema: 'argument-chain-ai-config',
    version: 1,
    provider: 'openai',
    model: 'gpt-5-mini',
    apiKey: 'test-secret-must-be-cleared',
    baseUrl: null,
    providerOptions: {},
  }));
  await page.getByRole('button', { name: '解析并应用', exact: true }).click();
  await page.getByTitle('AI 已配置').click();
  await page.getByRole('button', { name: '生成配置文本', exact: true }).click();
  await expect(page.getByLabel('生成的 AI 配置文本')).toContainText('test-secret-must-be-cleared');
  await page.getByRole('button', { name: '移除当前配置', exact: true }).click();

  await expect(page.getByLabel('生成的 AI 配置文本')).toHaveCount(0);
  await expect(page.getByLabel('API Key')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
