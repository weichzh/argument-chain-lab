import { expect, test } from 'playwright/test';
import fs from 'node:fs';

const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.0.json', import.meta.url)));
const principle = model.claims.n_proportionate_burden.text;
const storageKey = 'argument-chain-lab:progress:v10';
const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
const enterRevision = async (page) => {
  await page.goto('/');
  await click(page, '开始答题');
  await click(page, '不应当');
};
const enterDeeperCustom = async (page) => {
  await enterRevision(page);
  await click(page, '这样改以后可以接受');
  await click(page, '罚款或拘留超过了必要程度');
  for (const _premise of model.reasons.r_speech_sanction_disproportionate.premises) {
    await click(page, '先按这个情况继续');
  }
  await click(page, '是，这能成为一个理由');
  await click(page, '继续，但题库里没有我的理由');
  await expect(page.locator('.v4-question-card header')).toContainText(principle);
};
const showResults = async (page) => {
  await click(page, '这些理由都不影响我的判断');
  await click(page, '现在查看结果');
};

test('更深自定义理由刷新后仍说明当前原则，摘要、详情和导出保留完整路径', async ({ page }) => {
  const text = '任何人都不应仅因公共目标而承担本来可以避免的严重负担。';
  await enterDeeperCustom(page);
  await page.getByLabel('写下你的理由').fill(text);
  await page.reload();
  await expect(page.locator('.v4-question-card header')).toContainText(principle);
  await expect(page.getByLabel('写下你的理由')).toHaveValue(text);
  await click(page, '保存这条理由');
  await showResults(page);
  const result = page.locator('.v4-result-item').first();
  await expect(result).toContainText(`更深理由：${text}`);
  await expect(result).toContainText('主要理由：罚款或拘留超过了必要程度');
  await expect(result).toContainText('尚未经过题库校验');
  await result.getByText('查看详细推理记录', { exact: true }).click();
  await expect(result.locator('.v4-proof-path ol')).toContainText('罚款或拘留超过了必要程度');
  await expect(result.locator('.v4-custom-detail')).toContainText(principle);
  await expect(result.locator('.v4-custom-detail')).toContainText(text);
  const downloaded = page.waitForEvent('download');
  await click(page, '导出结果');
  const download = await downloaded;
  const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  const path = payload.policyResults.speech_restriction.mainPaths[0];
  expect(path.steps).toHaveLength(1);
  expect(path.customTargetClaimId).toBe('n_proportionate_burden');
  expect(path.customReason.text).toBe(text);
});

test('修改方案不确定不会被摘要改写为全部拒绝，也不会阻止娱乐比较', async ({ page }) => {
  await enterRevision(page);
  await click(page, '不确定');
  await click(page, '现在查看结果');
  await expect(page.locator('.v4-result-item')).toContainText('还没有确定哪些修改能改变判断');
  await expect(page.locator('.v4-result-item')).toContainText('尚未确定是否接受的修改：只允许民事责任');
  await expect(page.locator('.v4-result-item')).not.toContainText('修改都不足以');
  await click(page, '生成娱乐匹配');
  await expect(page.locator('.entertainment-profile code')).toHaveText(/^[0-9A-F]{16}$/);
  await expect(page.locator('.entertainment-error')).toHaveCount(0);
});

test('未解决的更深理由保留前面的步骤并明确提醒尚未补全', async ({ page }) => {
  await enterDeeperCustom(page);
  await click(page, '暂时保留为未解决');
  await click(page, '现在查看结果');
  const result = page.locator('.v4-result-item');
  await expect(result).toContainText('判断已记录，理由尚未补全；这不代表你没有理由。');
  await result.getByText('查看详细推理记录', { exact: true }).click();
  await expect(result.locator('.v4-proof-path ol')).toContainText(principle);
});

test('保存空间不足时明确告知，内存中仍能完成和导出', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'argument-chain-lab:progress:v10') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('暂时无法保存进度');
  await click(page, '开始答题');
  await click(page, '不确定');
  await click(page, '现在查看结果');
  const downloaded = page.waitForEvent('download');
  await click(page, '导出结果');
  expect((await downloaded).suggestedFilename()).toContain('argument-chain-results');
});

test('AI 成功候选只说明当前原则，等待确认且不保存密钥或原始输入', async ({ page }) => {
  const candidate = {
    scope: 'current_target', direction: 'support', schemeId: 'proportionality',
    target: { shortLabel: '负担应与目标相称', text: principle },
    argument: { title: '避免不必要的严重负担', summary: '在效果相近时，选择造成负担更小的手段。' },
    facts: [{ kind: 'stipulated', statement: '存在效果相近且负担更小的办法。', plainExplanation: '比较两种实现同一目标的办法。', truthConditions: '替代办法能达到相近效果。', falsifier: '替代办法无法实现目标。' }],
    bridge: { kind: 'terminal', shortLabel: '负担相称', text: '公共手段造成的负担应当与目标相称。', explanation: '目标本身不能免除说明手段的责任。', example: '同样效果下优先采用较轻限制。' },
    stressTest: { scenario: '某市为了减少深夜噪声，准备拘留第一次在住宅区大声播放音乐的人，但罚款已经能达到相同效果。', question: '在这个具体案例里，你仍认为拘留造成的负担超过了实现目标所需的程度吗？' },
  };
  let requestBody;
  await page.route('https://ai-fixture.invalid/**', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requestBody = route.request().postDataJSON();
    const item = { id: 'fc_fixture', type: 'function_call', call_id: 'call_fixture', name: 'propose_argument_candidate', arguments: JSON.stringify(candidate), status: 'completed' };
    const events = [
      { type: 'response.created', response: { id: 'resp_fixture', status: 'in_progress' } },
      { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '', status: 'in_progress' } },
      { type: 'response.function_call_arguments.done', output_index: 0, arguments: item.arguments },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: { id: 'resp_fixture', status: 'completed', output: [item], usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } } },
    ];
    await route.fulfill({ status: 200, contentType: 'text/event-stream', headers, body: events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await enterDeeperCustom(page);
  const raw = '仅供这次整理的原始草稿，不应作为完整对话持久保存。';
  await page.getByLabel('写下你的理由').fill(raw);
  const before = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await click(page, '交给 AI 整理');
  await page.getByLabel('粘贴配置文本').fill(JSON.stringify({ schema: 'argument-chain-ai-config', version: 1, provider: 'openai', model: 'gpt-4.1', apiKey: 'test-only-secret-sentinel', baseUrl: 'https://ai-fixture.invalid/v1', providerOptions: {} }));
  await click(page, '解析并应用');
  const dialog = page.getByRole('dialog', { name: '检查 AI 整理结果' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before);
  await expect(dialog.getByLabel('当前说明的判断或原则')).toHaveValue(principle);
  expect(JSON.stringify(requestBody)).toContain(principle);
  await click(page, '确认并继续答题');
  await showResults(page);
  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(saved).not.toContain('test-only-secret-sentinel');
  expect(saved).not.toContain(raw);
  expect(JSON.parse(saved).policyResults.speech_restriction.mainPaths[0].customTargetClaimId).toBe('n_proportionate_burden');
  await expect(page.locator('.v4-result-item')).toContainText('更深理由：避免不必要的严重负担');
});

for (const width of [320, 390, 768, 1440]) {
  test(`读者界面在 ${width}px 下无横向溢出，核心提示可读`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.landing-guide')).toContainText('不必一次答完');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await enterDeeperCustom(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 768) {
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await click(page, '暂时保留为未解决');
    await click(page, '现在查看结果');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
