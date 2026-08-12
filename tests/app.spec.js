import { expect, test } from 'playwright/test';

const startFirstQuestion = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: '开始答题', exact: true }).click();
};

const satisfyFollowUpQuestions = async (page) => {
  const answer = page.getByRole('button', { name: '是，继续', exact: true });
  while (await answer.count()) await answer.click();
};

test('每道题在作答前都会显示完整题设', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.locator('[data-policy-id="metadata_surveillance"]').getByRole('button', { name: /从这里开始/ }).click();
  await expect(page.getByText(/拟议制度要求通信服务商保存所有成年人的通信时间/)).toBeVisible();
  await page.getByRole('button', { name: '跳过这题', exact: true }).click();
  await expect(page.getByText('是否发放不附带工作条件的基本现金').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('argument-chain-lab:progress:v6'));
    return [state.records.metadata_surveillance.status, state.records.metadata_surveillance.chains.length];
  })).toEqual(['skipped', 0]);
});

test('按顺序答题，并且下位问题只在相关回答后出现', async ({ page }) => {
  await startFirstQuestion(page);
  await expect(page.getByRole('heading', { name: /国家是否应当用法律处罚这类表达/ })).toBeVisible();
  await page.getByRole('button', { name: '只在某些条件下处罚', exact: true }).click();
  await expect(page.getByRole('heading', { name: '哪些处罚方式可以接受？' })).toBeVisible();
  await expect(page.getByRole('button', { name: '只允许民事责任', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '上一题', exact: true }).click();

  await page.getByRole('button', { name: '不应处罚', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你反对这项决定的最主要原因是什么？' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '哪些处罚方式可以接受？' })).toHaveCount(0);
  await page.getByRole('button', { name: /查看已答/ }).click();
  await page.getByRole('button', { name: '修改：你的判断：不应处罚', exact: true }).click();

  await page.getByRole('button', { name: '暂时不能判断', exact: true }).click();
  await expect(page.getByText('是否保存所有成年人的通信记录五年').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('argument-chain-lab:progress:v6')).selectedPolicyPosition
  ))).toBe(1);
});

test('上一题、查看已答、中止和刷新续答保持同一条流程', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应处罚', exact: true }).click();
  await page.getByRole('button', { name: /因为模糊标准会让执法机关选择性处理不同说话者/ }).click();
  await expect(page.getByRole('heading', { name: /下面先假设这件事确实发生/ })).toBeVisible();
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你反对这项决定的最主要原因是什么？' })).toBeVisible();

  await page.getByRole('button', { name: /查看已答/ }).click();
  await expect(page.getByRole('button', { name: '修改：你的判断：不应处罚', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await page.reload();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /继续/ }).click();
  await expect(page.getByRole('heading', { name: '你反对这项决定的最主要原因是什么？' })).toBeVisible();
  await page.getByRole('button', { name: /查看已答/ }).click();
  await expect(page.getByRole('button', { name: '修改：你的判断：不应处罚', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '中止并看结果', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这次还没有完成题目' })).toBeVisible();
  await expect(page.getByText('1 道题停在中途，回答仍保存在这个浏览器中。')).toBeVisible();
});

test('可以回到主页并确认重新开始', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应处罚', exact: true }).click();
  await page.getByRole('button', { name: '回到主页', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续答题', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await expect(page.getByText('这会清除当前答题进度和临时草稿。')).toBeVisible();
  await page.getByRole('button', { name: '确认重新开始', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始答题', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('argument-chain-lab:progress:v6'));
    return [state.startedAt, Object.keys(state.records).length];
  })).toEqual([null, 0]);
});

test('完成后默认只显示普通语言摘要，详细结构按需展开', async ({ page }) => {
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应处罚', exact: true }).click();
  await page.getByRole('button', { name: '因为法律处罚的是没有直接伤害他人的表达', exact: true }).click();
  await page.getByRole('button', { name: '接受这个假设，继续判断', exact: true }).click();
  await page.getByRole('button', { name: '是，这足以成为理由', exact: true }).click();
  await satisfyFollowUpQuestions(page);
  await page.getByRole('button', { name: '这就是我目前最根本的理由', exact: true }).click();
  await page.getByRole('button', { name: '仍然适用', exact: true }).click();
  await page.getByRole('button', { name: '这些理由都不会改变我的判断', exact: true }).click();

  await expect(page.getByText('是否保存所有成年人的通信记录五年').first()).toBeVisible();
  await page.getByRole('button', { name: '中止并看结果', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已完成 1 道题' })).toBeVisible();
  await expect(page.getByText('你的判断：')).toContainText('不应处罚');
  await expect(page.getByText(/主要原因是：因为法律处罚的是没有直接伤害他人的表达/)).toBeVisible();
  await expect(page.getByText('本轮机械报告')).not.toBeVisible();
  await expect(page.getByText(/这些结果建立在题目中采用的效果假设上/)).toBeVisible();

  await page.getByText('查看详细推理过程', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '本轮机械报告' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '论证谱系' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('移动端题目列表、答题页和配置对话框没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /从这里开始/ }).click();
  await expect(page.getByRole('heading', { name: /国家是否应当用法律处罚这类表达/ })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const opener = page.getByTitle('AI 配置');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'AI 配置' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
