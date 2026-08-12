import { expect, test } from 'playwright/test';

const startFirstQuestion = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: '开始答题', exact: true }).click();
};

test('根判断只有应当、不应当和不确定，固定题设不接受作答', async ({ page }) => {
  await startFirstQuestion(page);
  await expect(page.getByRole('heading', { name: '国家是否应当处罚公开场合中严重侮辱或贬低某个群体、但不包含威胁、骚扰、造谣或组织暴力的表达？' })).toBeVisible();
  await expect(page.getByRole('button', { name: '应当', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '不应当', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '不确定', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /有条件/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '题目中的完整方案包括' })).toBeVisible();
  await expect(page.getByText(/这道题只讨论排除威胁、骚扰、造谣和组织暴力以后/)).toBeVisible();
  await expect(page.getByText('可以罚款或拘留', { exact: true })).toBeVisible();
  expect(await page.locator('.v4-question-card').evaluate((card) => (
    [...card.children].findIndex((element) => element.classList.contains('v4-question-prelude'))
    < [...card.children].findIndex((element) => element.tagName === 'HEADER')
  ))).toBe(true);
  await expect(page.getByRole('button', { name: '民事责任', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('反对原方案后一次只测试一个完整修改方案', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这样修改以后，你可以接受吗？' })).toBeVisible();
  await expect(page.getByText(/先只改处罚方式：不再罚款或拘留/)).toBeVisible();
  await expect(page.getByText('没有列出的安排保持不变。', { exact: true })).toBeVisible();
  await expect(page.getByText('处罚方式', { exact: true })).toBeVisible();
  await expect(page.locator('.v4-revision-prelude dd')).toContainText('可以罚款或拘留 → 只允许较轻的民事责任');

  await page.getByRole('button', { name: '这样改以后可以接受', exact: true }).click();
  await expect(page.getByText(/关键在于：罚款或拘留/)).toBeVisible();
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
  await page.getByRole('button', { name: '这样改以后可以接受', exact: true }).click();
  await page.getByRole('button', { name: '这些都不是我的主要原因', exact: true }).click();
  await page.getByLabel('写下你的理由').fill('较强处罚在这里造成了不必要的负担。');
  await page.getByRole('button', { name: '保存这条理由', exact: true }).click();
  await expect(page.getByRole('heading', { name: '下面哪条相反理由最值得你认真考虑？' })).toBeVisible();
  await page.getByRole('button', { name: '这些理由都不影响我的判断', exact: true }).click();
  await page.getByRole('button', { name: '现在查看结果', exact: true }).click();

  await expect(page.getByRole('heading', { name: '已记录 1 道题' })).toBeVisible();
  await expect(page.getByText('可接受的修改方案：只允许民事责任')).toBeVisible();
  await expect(page.getByText('主要理由：较强处罚在这里造成了不必要的负担。')).toBeVisible();
  await expect(page.getByText('可以罚款或拘留 → 只允许较轻的民事责任')).toBeVisible();
  await expect(page.getByText('formalStatus')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('上一题、修改已答和刷新只保留当前有效路径', async ({ page }) => {
  await startFirstQuestion(page);
  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(page.getByRole('heading', { name: /国家是否应当处罚公开场合/ })).toBeVisible();

  await page.getByRole('button', { name: '不应当', exact: true }).click();
  await page.getByRole('button', { name: '这样改以后可以接受', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你这样判断的最主要原因是什么？' })).toBeVisible();
  await page.getByText('查看已答（2）', { exact: true }).click();
  await page.getByRole('button', { name: '修改：不应当', exact: true }).click();
  await expect(page.getByRole('heading', { name: /国家是否应当处罚公开场合/ })).toBeVisible();
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

test('娱乐基准只在主动启用后加载，并且一次只追加一道精度题', async ({ page }) => {
  const benchmarkRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('ideology-benchmark-1.2.0.json')) benchmarkRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const policyIds = [
      'speech_restriction',
      'metadata_surveillance',
      'education_opportunity_fund',
      'carbon_fee',
      'workplace_cogovernance',
      'income_floor',
      'emergency_powers',
      'expert_referendum_delay',
    ];
    const policyResults = Object.fromEntries(policyIds.map((policyId) => [policyId, {
      policyId,
      rootAnswer: 'uncertain',
      finalRootAnswer: 'uncertain',
      acceptedRevisionFrameId: null,
      diagnosisClaimId: null,
      mainPaths: [],
      counterPath: null,
      counterImpact: null,
    }]));
    localStorage.setItem('argument-chain-lab:progress:v10', JSON.stringify({
      storageVersion: 10,
      modelVersion: '1.1.0',
      policyIds,
      policyPosition: 7,
      currentPolicyId: policyIds[7],
      policyResults,
      phase: 'results',
      history: [],
      answerLog: [],
      notes: [],
      startedAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
      entertainmentEnabled: false,
      view: 'results',
    }));
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: '生成娱乐匹配', exact: true })).toBeVisible();
  expect(benchmarkRequests).toHaveLength(0);
  await page.getByRole('button', { name: '生成娱乐匹配', exact: true }).click();
  await expect(page.getByRole('heading', { name: '只看目前的信息，你位于以下几个参考立场之间。' })).toBeVisible();
  await expect(page.locator('.entertainment-profile code')).toHaveText(/^[0-9A-F]{16}$/);
  await expect(page.locator('.entertainment-prototype-list strong').first()).toHaveText(/[\u3400-\u9fff]+（[A-Za-z]/u);
  await expect(page.getByText(/主要理由方向接近/)).toHaveCount(0);
  expect(benchmarkRequests).toHaveLength(1);

  await page.getByRole('button', { name: '再答一题：公民资格', exact: true }).click();
  await expect(page.getByRole('heading', { name: /一个长期守法居住并承担公共义务的人.*完整公民资格/ })).toBeVisible();
  await expect(page.getByText('公民资格 · 9 / 9')).toBeVisible();
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await page.getByRole('button', { name: '继续精度题', exact: true }).click();
  await expect(page.getByText('公民资格 · 9 / 9')).toBeVisible();
});

test('1.0 结构化进度原样进入兼容的 1.2 模型', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('argument-chain-lab:progress:v10', JSON.stringify({
      storageVersion: 10,
      modelVersion: '1.0.0',
      policyIds: ['speech_restriction'],
      policyPosition: 0,
      currentPolicyId: 'speech_restriction',
      policyResults: {
        speech_restriction: {
          policyId: 'speech_restriction',
          rootAnswer: 'uncertain',
          finalRootAnswer: 'uncertain',
          acceptedRevisionFrameId: null,
          diagnosisClaimId: null,
          mainPaths: [],
          counterPath: null,
          counterImpact: null,
        },
      },
      phase: 'results',
      history: [],
      answerLog: [],
      notes: [],
      startedAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z',
      view: 'results',
    }));
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '已记录 1 道题' })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('argument-chain-lab:progress:v10')));
  expect(state.modelVersion).toBe('1.2.0');
  expect(state.policyResults.speech_restriction.rootAnswer).toBe('uncertain');
  expect(state.policyIds).toHaveLength(8);
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
  await page.getByRole('button', { name: '这样改以后可以接受', exact: true }).click();
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

  const term = page.getByRole('button', { name: '独立审查', exact: true }).first();
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
