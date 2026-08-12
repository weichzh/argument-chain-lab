import { expect, test } from 'playwright/test';

const startFirstQuestion = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: '开始答题', exact: true }).click();
};

test('根判断只有应当、不应当和不确定，固定题设不接受作答', async ({ page }) => {
  await startFirstQuestion(page);
  await expect(page.getByRole('heading', { name: '在上述范围内，国家应当允许法律处罚这类表达吗？' })).toBeVisible();
  await expect(page.getByRole('button', { name: '应当', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '不应当', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '不确定', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /有条件/ })).toHaveCount(0);
  await expect(page.getByText('直接威胁、针对个人的骚扰、可核实的虚假事实陈述和指挥组织暴力已经排除。')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('反对原方案后一次只测试一个完整修改方案', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await expect(page.getByRole('heading', { name: '如果不再允许罚款或拘留，只保留较轻的民事责任，这样可以接受吗？' })).toBeVisible();
  await expect(page.getByText('这里只改变处罚强度，其他题设保持不变。')).toBeVisible();
  await expect(page.getByText('处罚方式')).toBeVisible();

  await page.getByRole('button', { name: '这样可以接受', exact: true }).click();
  await expect(page.getByText('原方案不可接受，罚款或拘留是其中一个足以改变判断的原因。')).toBeVisible();
  await expect(page.getByRole('button', { name: /罚款或拘留超过了必要程度/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /强制程度越高，说明责任越重/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /禁令能够减少严重暴力伤害/ })).toHaveCount(0);
});

test('自定义理由走完整条路径并生成普通语言结果', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '这样可以接受', exact: true }).click();
  await page.getByRole('button', { name: '这些都不是我的主要原因', exact: true }).click();
  await page.getByLabel('写下你的理由').fill('较强处罚在这里造成了不必要的负担。');
  await page.getByRole('button', { name: '保存这条理由', exact: true }).click();
  await expect(page.getByRole('heading', { name: '下面哪条相反理由最值得你认真考虑？' })).toBeVisible();
  await page.getByRole('button', { name: '这些理由都不影响我的判断', exact: true }).click();
  await page.getByRole('button', { name: '现在查看结果', exact: true }).click();

  await expect(page.getByRole('heading', { name: '已记录 1 道题' })).toBeVisible();
  await expect(page.getByText('可接受的修改方案：只允许民事责任')).toBeVisible();
  await expect(page.getByText('主要理由：较强处罚在这里造成了不必要的负担。')).toBeVisible();
  await expect(page.getByText('罚款或拘留 → 只允许较轻的民事责任')).toBeVisible();
  await expect(page.getByText('formalStatus')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('上一题、修改已答和刷新只保留当前有效路径', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(page.getByRole('heading', { name: '在上述范围内，国家应当允许法律处罚这类表达吗？' })).toBeVisible();

  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '这样可以接受', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你这样判断的最主要原因是什么？' })).toBeVisible();
  await page.getByText('查看已答（2）', { exact: true }).click();
  await page.getByRole('button', { name: '修改：不应当', exact: true }).click();
  await expect(page.getByRole('heading', { name: '在上述范围内，国家应当允许法律处罚这类表达吗？' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('argument-chain-lab:progress:v10')).answerLog.length)).toBe(0);
});

test('跳过、题目列表和中止查看结果保持单一问卷', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '跳过', exact: true }).click();
  await expect(page.getByText('元数据收集 · 2 / 8')).toBeVisible();
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await expect(page.locator('[data-policy-id="speech_restriction"]')).toContainText('已跳过');
  await page.locator('[data-policy-id="metadata_surveillance"]').getByRole('button', { name: /从这里开始/ }).click();
  await page.getByRole('button', { name: '中止并看结果', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已记录 1 道题' })).toBeVisible();
  await expect(page.getByText('当前题停在中途，回答仍保存在这个浏览器中。')).toBeVisible();
});

test('0.9 会话只读归档，不会提升为新版结果', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('argument-chain-lab:progress:v8', JSON.stringify({
      modelVersion: '0.9.0',
      records: { speech_restriction: { stance: 'conditional', policyChoiceResponses: { penalty_power: 'civil_only' }, chains: [] } },
    }));
  });
  await page.goto('/');
  await expect(page.getByText(/旧版回答已保留为只读记录/)).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('argument-chain-lab:progress:v10')));
  expect(state.policyResults).toEqual({});
  expect(state.legacyArchive.policies[0].oldStance).toBe('conditional');
  expect(state.legacyArchive.snapshot.records.speech_restriction.policyChoiceResponses.penalty_power).toBe('civil_only');
  expect(await page.evaluate(() => localStorage.getItem('argument-chain-lab:progress:v8'))).toBeNull();
});

test('AI 请求失败不会改变当前进度或清空自定义理由', async ({ page }) => {
  await page.route('http://127.0.0.1:9/**', (route) => route.abort());
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '这样可以接受', exact: true }).click();
  await page.getByRole('button', { name: '这些都不是我的主要原因', exact: true }).click();
  const reason = '较强处罚在这里造成了不必要的负担。';
  await page.getByLabel('写下你的理由').fill(reason);
  const before = await page.evaluate(() => localStorage.getItem('argument-chain-lab:progress:v10'));

  await page.getByRole('button', { name: '交给 AI 整理', exact: true }).click();
  await page.getByLabel('粘贴配置文本').fill(JSON.stringify({
    schema: 'argument-chain-ai-config',
    version: 1,
    provider: 'openai',
    model: 'gpt-5',
    apiKey: 'test-only-placeholder',
    baseUrl: 'http://127.0.0.1:9/v1',
    providerOptions: {},
  }));
  await page.getByRole('button', { name: '解析并应用', exact: true }).click();

  await expect(page.locator('.global-alert')).toBeVisible();
  await expect(page.getByLabel('写下你的理由')).toHaveValue(reason);
  expect(await page.evaluate(() => localStorage.getItem('argument-chain-lab:progress:v10'))).toBe(before);
});

test('移动端无横向溢出，术语解释和配置对话框可用键盘关闭', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFirstQuestion(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const term = page.getByRole('button', { name: '民事责任', exact: true });
  await term.click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(term).toBeFocused();

  const config = page.getByTitle('AI 配置');
  await config.click();
  await expect(page.getByRole('dialog', { name: 'AI 配置' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(config).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
