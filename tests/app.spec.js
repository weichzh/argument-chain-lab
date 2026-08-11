import { expect, test } from 'playwright/test';

const finishComponents = async (page) => {
  await page.getByRole('button', { name: '其余项目暂不判断', exact: true }).click();
};

const acceptBothSensitivityScenarios = async (page) => {
  await page.getByRole('button', { name: '这个幅度仍足以采用当前理由', exact: true }).click();
  await page.getByRole('button', { name: '这个幅度仍足以采用当前理由', exact: true }).click();
};

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
  await page.getByRole('radio', { name: '现实判断模式', exact: true }).check();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^开始/ }).click();
  await expect(page.getByText('回答方式：现实判断模式', { exact: true })).toBeVisible();
  await finishComponents(page);
  await page.getByRole('button', { name: /现实判断：支持/ }).click();
  await page.getByRole('button', { name: /因为禁令确实能减少针对群体的重伤/ }).click();
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await acceptBothSensitivityScenarios(page);
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await page.getByRole('button', { name: '接受这条原则', exact: true }).click();
  await page.getByRole('button', { name: /继续追问为什么/ }).click();
  await expect(page.getByText('没有合适选项')).toBeVisible();
  await page.getByRole('button', { name: /因为死亡和重伤会大幅减少人的行动能力/ }).click();
  await page.getByRole('button', { name: '成立', exact: true }).click();
  await page.getByRole('button', { name: '接受这条原则', exact: true }).click();
  await page.getByRole('button', { name: '是，我现在直接接受它', exact: true }).click();
  await page.getByRole('button', { name: '仍然适用', exact: true }).click();
  await page.getByRole('button', { name: '题库中没有我认为成立的反方理由', exact: true }).click();
  await page.getByRole('button', { name: '查看阶段结果', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByText('查看详细报告', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '本轮机械报告' })).toBeVisible();
  await page.locator('.report-chain > summary').first().click();
  await expect(page.locator('.report-step')).toHaveCount(2);
  await expect(page.getByText('正式题库 0.8.1').first()).toBeVisible();
  await expect(page.locator('.report-list').filter({ hasText: '已确认' })).toContainText('避免人的死亡、重伤和严重身体损害');
  expect(requests).toHaveLength(0);

  await expect(page.getByRole('heading', { name: '论证谱系' })).toBeVisible();
  await page.getByRole('checkbox', { name: '启用基准匹配', exact: true }).check();
  await expect(page.getByText('覆盖不足，暂不生成历史标签', { exact: true })).toBeVisible();
  await expect(page.getByText('你的唯一化论证型', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '相同政策答案，不等于相同论证' })).toHaveCount(0);

  await page.getByText('导出或贡献所选论证', { exact: true }).click();
  await page.getByRole('checkbox', { name: /我已检查完整预览/ }).check();
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: '贡献到公开题库', exact: true }).click();
  await expect(page.getByText('已进入公开审核候选区。')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].version).toBe(2);
  expect(requests[0].argument.defeaterReview.effect).toBe('none_accepted');

  await page.reload();
  await page.getByText('查看详细报告', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '本轮机械报告' })).toBeVisible();
  await page.locator('.report-chain > summary').first().click();
  await expect(page.locator('.report-step')).toHaveCount(2);
  expect(browserErrors).toEqual([]);
});

test('移动端配置清除后不保留明文密钥且页面无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '从题库开始', exact: true }).click();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^开始/ }).click();
  expect(await page.locator('.stage-rail').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const configButton = page.getByTitle('AI 配置');
  await configButton.click();
  await page.keyboard.press('Escape');
  await expect(configButton).toBeFocused();
  await configButton.click();
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

test('对话框限制焦点、关闭后归还焦点并尊重减少动态效果', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const opener = page.getByTitle('方法');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '方法与边界' });
  const focusable = dialog.locator('button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
  await expect(focusable.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(focusable.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(focusable.first()).toBeFocused();
  expect(await dialog.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('短桌面视口可点击底部立场，并可在无 AI 时记录题库缺口', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: '从题库开始', exact: true }).click();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^开始/ }).click();
  await finishComponents(page);
  await page.getByRole('button', { name: /^暂时没有立场/ }).click();
  await page.getByRole('button', { name: '检查反对题设的理由', exact: true }).click();
  await page.getByText('没有合适选项', { exact: true }).click();
  await page.getByLabel('补充我的想法').fill('现有理由没有覆盖我的实际理由。');
  await expect(page.getByRole('checkbox', { name: /另存一段可编辑的题库缺口摘要/ })).not.toBeChecked();
  await page.getByRole('button', { name: '记录题库缺口并结束本题', exact: true }).click();

  await expect(page.getByRole('heading', { name: '这条论证仍未解决' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`
      .includes('现有理由没有覆盖我的实际理由。')
  ))).toBe(false);
  await page.getByRole('button', { name: '查看阶段结果', exact: true }).click();
  await page.getByText('查看详细报告', { exact: true }).click();
  await expect(page.getByText('预设理由没有覆盖用户的实际理由')).toBeVisible();
  await expect(page.getByText('现有理由没有覆盖我的实际理由。')).toHaveCount(0);
});

test('可自由切换题目、退出，并从精确步骤继续', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '从题库开始', exact: true }).click();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^开始/ }).click();
  await finishComponents(page);
  await page.getByRole('button', { name: /题设内：支持/ }).click();
  await page.getByRole('button', { name: /因为禁令确实能减少针对群体的重伤/ }).click();
  await page.getByRole('button', { name: '作为题设条件采用', exact: true }).click();
  await acceptBothSensitivityScenarios(page);
  await expect(page.getByText('事实 2 / 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await expect(page.locator('[data-policy-id="speech_restriction"]')).toContainText('进行中');
  await page.locator('[data-policy-id="education_opportunity_fund"]').getByRole('button', { name: /^开始/ }).click();
  await finishComponents(page);
  await expect(page.getByRole('heading', { name: /你目前倾向支持还是反对/ })).toBeVisible();
  await page.getByRole('button', { name: '题目列表', exact: true }).click();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^继续/ }).click();
  await expect(page.getByText('事实 2 / 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续上次进度', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续上次进度', exact: true }).click();
  await expect(page.locator('[data-policy-id="speech_restriction"]')).toContainText('进行中');

  await page.evaluate(() => {
    const currentKey = 'argument-chain-lab:progress:v6';
    const legacyKey = 'argument-chain-lab:progress:v5';
    const state = JSON.parse(window.localStorage.getItem(currentKey));
    state.storageVersion = 4;
    state.modelVersion = '0.7.0';
    delete state.assessmentMode;
    Object.values(state.records).forEach((record) => {
      record.chains.forEach((chain) => chain.steps.forEach((step) => delete step.assessmentMode));
      record.draft?.currentChain?.steps.forEach((step) => delete step.assessmentMode);
    });
    state.currentChain?.steps.forEach((step) => delete step.assessmentMode);
    window.localStorage.setItem(legacyKey, JSON.stringify(state));
    window.localStorage.removeItem(currentKey);
  });
  await page.reload();
  await page.locator('[data-policy-id="speech_restriction"]').getByRole('button', { name: /^继续/ }).click();
  await expect(page.getByText('事实 2 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '成立', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(window.localStorage.getItem('argument-chain-lab:progress:v6')).modelVersion
  ))).toBe('0.8.1');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('argument-chain-lab:progress:v5'))).toBe(null);
});

test('两难题区分同等重要与无法比较', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '从题库开始', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = 'argument-chain-lab:progress:v6';
    const state = JSON.parse(window.localStorage.getItem(key));
    window.localStorage.setItem(key, JSON.stringify({
      ...state,
      phase: 'dilemma',
      dilemmaQueue: ['agency_vs_security'],
      dilemmaIndex: 0,
      dilemmaResponses: {},
      startedAt: new Date().toISOString(),
    }));
  });
  await page.reload();

  await expect(page.getByRole('button', { name: '取决于尚未说明的条件', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '两者在本题中不可通约', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '我暂时无法判断', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'A 与 B 同等重要', exact: true }).click();
  await page.getByRole('button', { name: 'A 与 B 同等重要', exact: true }).click();
  await page.getByRole('button', { name: 'A 与 B 同等重要', exact: true }).click();
  await page.getByText('查看详细报告', { exact: true }).click();
  await expect(page.locator('.relation-graph')).toContainText('≈');
  await expect(page.locator('.relation-graph')).toContainText('本题中同等重要');
});

test('推荐路径不会展开全部题库，政策选择冲突进入明确取舍', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '从题库开始', exact: true }).click();
  await expect(page.getByText(/候选库有 20 个场景/)).toBeVisible();
  await page.getByRole('button', { name: '开始推荐路径', exact: true }).click();
  await expect(page.getByRole('heading', { name: '先分别判断这项政策里的决定' })).toBeVisible();
  await page.getByRole('button', { name: '题目列表', exact: true }).click();

  await page.locator('[data-policy-id="carbon_fee"]').getByRole('button', { name: /^开始/ }).click();
  const components = page.locator('.component-question');
  await components.nth(0).getByRole('button', { name: '赞成', exact: true }).click();
  await components.nth(1).getByRole('button', { name: '反对', exact: true }).click();
  await finishComponents(page);
  await page.getByRole('button', { name: /题设内：支持/ }).click();
  await expect(page.getByRole('heading', { name: '哪些政策选择是底线，哪些可以交换？' })).toBeVisible();

  const tradeoffs = page.locator('.component-question');
  await tradeoffs.nth(0).getByRole('button', { name: '必须保留', exact: true }).click();
  await tradeoffs.nth(1).getByRole('button', { name: '可为其他选择让步', exact: true }).click();
  await page.getByRole('button', { name: /记录取舍并检查理由/ }).click();
  await expect(page.getByRole('heading', { name: '哪一条最接近你实际采用的理由？' })).toBeVisible();
});

test('移动端同答异因使用纵向卡片并显示基准依据', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(async () => {
    const [model, benchmarks] = await Promise.all([
      fetch('/bank/model-0.8.1.json').then((response) => response.json()),
      fetch('/bank/ideology-benchmarks-0.8.1.json').then((response) => response.json()),
    ]);
    const variant = benchmarks.profiles[0].variants[0];
    const state = JSON.parse(localStorage.getItem('argument-chain-lab:progress:v6'));
    const records = {};
    Object.entries(variant.policyPositions).forEach(([policyId, position], index) => {
      const policy = model.policies.find((item) => item.id === policyId);
      const targetClaimId = position.stance === 'oppose' ? policy.opposeClaimId : policy.supportClaimId;
      const argument = Object.values(model.arguments).find((item) => item.targetClaimId === targetClaimId && item.reasonFamilyId === variant.primaryReasons[policyId]);
      const chainId = `matrix_chain_${index}`;
      records[policyId] = {
        policyId,
        stance: position.stance,
        direction: position.stance,
        packageStanceBeforeDefeater: position.stance,
        packageStanceAfterDefeater: position.stance,
        policyChoiceResponses: {},
        safeguardResponses: {},
        parameterResponses: {},
        chains: [{
          id: chainId,
          policyId,
          direction: position.stance,
          targetClaimId,
          steps: [{
            id: `matrix_step_${index}`,
            targetClaimId,
            argumentId: argument.id,
            factResponses: Object.fromEntries(argument.factIds.map((factId) => [factId, 'true'])),
            factSensitivity: {},
            bridgeClaimId: argument.bridgeClaimId,
            bridgeResponse: 'accept',
            assessmentMode: 'real_world_belief',
          }],
          terminal: { claimId: variant.fixedPoints[policyId], status: 'provisional_fixed_point' },
          stress: { response: 'apply' },
          defeaterReview: { effect: 'none_accepted', stanceBefore: position.stance, stanceAfter: position.stance },
          status: 'complete',
          argumentClosure: 'closed',
          matchingStatus: 'active',
          compatibilityIssues: [],
          scopeConflicts: [],
          completedAt: new Date().toISOString(),
        }],
        activeChainIds: [chainId],
      };
    });
    localStorage.setItem('argument-chain-lab:progress:v6', JSON.stringify({
      ...state,
      modelVersion: '0.8.1',
      storageVersion: 6,
      assessmentMode: 'real_world_belief',
      phase: 'results',
      records,
      selectedChainId: 'matrix_chain_0',
      startedAt: new Date().toISOString(),
    }));
  });
  await page.reload();
  await page.getByRole('checkbox', { name: '启用基准匹配', exact: true }).check();
  await expect(page.getByRole('heading', { name: '相同政策答案，不等于相同论证' })).toBeVisible();
  await expect(page.getByText('依据：保守重建 · 中').first()).toBeVisible();
  expect(await page.locator('.reason-matrix tbody tr').first().evaluate((element) => getComputedStyle(element).display)).toBe('block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('没有政策拆分的会话论证也能打开详细报告', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const key = 'argument-chain-lab:progress:v6';
    const state = JSON.parse(localStorage.getItem(key));
    const chainId = 'local_chain_report';
    localStorage.setItem(key, JSON.stringify({
      ...state,
      modelVersion: '0.8.1',
      storageVersion: 6,
      phase: 'results',
      startedAt: new Date().toISOString(),
      selectedChainId: chainId,
      sessionOverlay: {
        facts: {
          local_fact_report: {
            id: 'local_fact_report',
            kind: 'descriptive',
            statement: '这是一项由用户确认的会话事实。',
            plainExplanation: '只用于检查无政策拆分时的报告。',
            truthConditions: '用户明确确认。',
            plainTruthConditions: '用户明确确认。',
            falsifier: '用户撤回确认。',
            plainFalsifier: '用户撤回确认。',
            mutuallyExclusiveWith: [],
            dependsOn: [],
            sourceIds: [],
          },
        },
        claims: {
          local_policy_claim_report: { id: 'local_policy_claim_report', kind: 'policy', policyId: 'local_policy_report', direction: 'support', text: '采用这项会话政策。', explanation: '会话政策结论。' },
          local_terminal_report: { id: 'local_terminal_report', kind: 'terminal', text: '相同结构应得到相同判断。', shortLabel: '一致判断', explanation: '保持判断一致。', example: '对象变化但结构不变。', nominatable: true, valueFamilyId: 'local_terminal_report' },
        },
        arguments: {
          local_argument_report: { id: 'local_argument_report', title: '会话论证', summary: '用于报告兼容性检查。', targetClaimId: 'local_policy_claim_report', factIds: ['local_fact_report'], bridgeClaimId: 'local_terminal_report', reasonFamilyId: 'local_terminal_report', plainSteps: { facts: ['这是一项由用户确认的会话事实。'] } },
        },
        policies: [{ id: 'local_policy_report', origin: 'session_overlay', title: '没有政策拆分的会话论证', shortTitle: '会话论证', proposition: '采用这项会话政策。', supportClaimId: 'local_policy_claim_report', opposeClaimId: null }],
        dilemmas: [],
      },
      records: {
        local_policy_report: {
          policyId: 'local_policy_report',
          stance: 'support',
          direction: 'support',
          packageStanceBeforeDefeater: 'support',
          packageStanceAfterDefeater: 'support',
          chains: [{
            id: chainId,
            policyId: 'local_policy_report',
            direction: 'support',
            targetClaimId: 'local_policy_claim_report',
            steps: [{ id: 'local_step_report', targetClaimId: 'local_policy_claim_report', argumentId: 'local_argument_report', factResponses: { local_fact_report: 'true' }, factSensitivity: {}, bridgeClaimId: 'local_terminal_report', bridgeResponse: 'accept', assessmentMode: 'real_world_belief' }],
            terminal: { claimId: 'local_terminal_report', status: 'provisional_fixed_point' },
            stress: { response: 'apply' },
            defeaterReview: { effect: 'none_accepted', stanceBefore: 'support', stanceAfter: 'support' },
            status: 'complete',
            argumentClosure: 'closed',
            matchingStatus: 'active',
            compatibilityIssues: [],
            scopeConflicts: [],
            completedAt: new Date().toISOString(),
          }],
          activeChainIds: [chainId],
        },
      },
    }));
  });
  await page.reload();
  await page.getByText('查看详细报告', { exact: true }).click();
  await page.locator('.package-report-list summary').click();
  await expect(page.getByText('这份论证没有政策元素拆分；只展示其论证结构，不纳入意识形态匹配。')).toBeVisible();
});
