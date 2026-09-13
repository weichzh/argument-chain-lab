import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import { PHASES, answer, createSession, startSession, getQuestion } from '../src/lib/decisionEngine.js';
const model = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.2.json', import.meta.url)));
const previous = JSON.parse(fs.readFileSync(new URL('../public/bank/model-1.2.0.json', import.meta.url)));
const key = 'argument-chain-lab:progress:v10';
const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
const start = () => startSession(model, createSession(model, { policyIds: ['speech_restriction'] }));
const advance = (state, id, extra) => answer(model, { ...state, history: [] }, id, extra);
const confirm = (state) => {
  let s = advance(state, getQuestion(model, state).options.find((item) => model.reasons[item.id]).id);
  while (s.phase === PHASES.PREMISE_CHECK) s = advance(s, 'accept');
  return advance(s, 'accept');
};
const seed = async (page, state) => {
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key, state: { storageVersion: 10, view: 'questionnaire', entertainmentEnabled: false, ...state } });
};

test('修改不叠加：第二次比较仍保留原处罚，原方案随时可回看', async ({ page }) => {
  await page.goto('/');
  await click(page, '开始答题');
  await click(page, '不应当');
  await expect(page.locator('.revision-progress')).toContainText('1 / 3');
  await click(page, '这样改以后仍不能接受');
  await expect(page.locator('.revision-progress')).toContainText('2 / 3');
  await page.locator('.revision-unchanged > summary').click();
  await expect(page.locator('.revision-unchanged')).toContainText('可以罚款或拘留');
  await expect(page.locator('.revision-unchanged')).not.toContainText('只允许较轻的民事责任');
  await page.locator('.policy-reminder > summary').click();
  await expect(page.locator('.policy-reminder')).toContainText('题目中的完整方案包括');
  await expect(page.locator('.policy-reminder')).toContainText('可以罚款或拘留');
  await click(page, '这样改以后可以接受');
  await expect(page.locator('.v4-question-card > header')).toContainText('不代表找到了唯一原因');
});

test('固定条件不混入可以修改的安排，相反理由明确辩护原方案', async ({ page }) => {
  await page.goto('/');
  await click(page, '开始答题');
  await expect(page.locator('section[aria-labelledby="fixed-conditions-title"]')).not.toContainText('完整方案允许罚款或拘留');
  await click(page, '不应当');
  await click(page, '这样改以后可以接受');
  await click(page, '这些都不是我的主要原因');
  await page.getByLabel('写下你的理由').fill('更轻的措施已经足够。');
  await click(page, '保存这条理由');
  await expect(page.locator('.v4-question-card > header')).toContainText('保留这些原有安排：处罚方式：可以罚款或拘留');
});

for (const part of ['premise', 'rule']) {
  test(`相反理由的更深${part}被否定后回到当前原则而不是政策根结论`, async ({ page }) => {
    let s = confirm(advance(advance(start(), 'no'), 'accept'));
    s = confirm(advance(advance(s, 'stop_here'), 'apply'));
    const target = s.currentBridgeClaimId;
    const deeper = getQuestion(model, s).options.find((item) => model.reasons[item.id]);
    s = advance(s, deeper.id);
    if (part === 'rule') while (s.phase === PHASES.PREMISE_CHECK) s = advance(s, 'accept');
    await seed(page, s);
    await page.goto('/');
    await click(page, part === 'premise' ? '我不接受这个情况' : '不是，这还不足以成为理由');
    await expect(page.locator('.v4-question-card > header')).toContainText(model.claims[target].text);
    await expect(page.getByRole('button', { name: '这就是我目前愿意停下来的理由', exact: true })).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
    expect(saved.currentBridgeClaimId).toBe(target);
    expect(saved.currentPath.steps).toEqual(s.currentPath.steps);
    await click(page, '这就是我目前愿意停下来的理由');
    await expect(page.locator('.v4-question-card > header')).toContainText(model.claims[target].stressTest.question);
  });
}

test('旧题库的自定义候选原文和来源保留，刷新后仍可比较', async ({ page }) => {
  let s = advance(advance(start(), 'no'), 'accept');
  s = advance(s, 'no_match');
  s = advance(s, 'save_custom', { text: '这是当时记录的个人理由。' });
  s = advance(s, 'none');
  const oldText = previous.claims.c_speech_reject_sanction.text;
  s.policyResults.speech_restriction.mainPaths[0].customReason = {
    scope: 'current_target', direction: 'oppose', schemeId: 'proportionality',
    target: { shortLabel: '反对较强处罚', text: oldText },
    argument: { title: '这是当时记录的个人理由。', summary: '较轻的措施已足够。' },
    facts: [{ kind: 'stipulated', statement: '存在较轻的替代措施。', plainExplanation: '比较其他措施。', truthConditions: '替代措施有效。', falsifier: '替代措施无效。' }],
    bridge: { kind: 'bridge', shortLabel: '负担相称', text: '负担应与目标相称。', explanation: '考虑手段的成本。', example: '有效时使用较轻措施。' },
    stressTest: { scenario: '某市为了减少深夜噪声，准备拘留第一次在住宅区大声播放音乐的人，但罚款已经能达到相同效果。', question: '在这个具体案例里，你仍认为拘留造成的负担超过了实现目标所需的程度吗？' },
  };
  delete s.policyResults.speech_restriction.sourceModelVersion;
  await seed(page, { ...s, modelVersion: '1.2.0', phase: PHASES.RESULTS, view: 'results' });
  await page.goto('/');
  await page.getByText('查看详细推理记录', { exact: true }).click();
  await expect(page.locator('.v4-custom-detail')).toContainText(oldText);
  await expect(page.locator('.v4-custom-detail')).toContainText('来自题库 1.2.0');
  await click(page, '生成娱乐匹配');
  await expect(page.locator('.entertainment-profile code')).toHaveText(/^[0-9A-F]{16}$/);
  await page.reload();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  expect(saved.modelVersion).toBe('1.2.2');
  expect(saved.policyResults.speech_restriction.sourceModelVersion).toBe('1.2.0');
  expect(saved.policyResults.speech_restriction.mainPaths[0].customReason.target.text).toBe(oldText);
});

test('小屏导航保留文字，每次作答后焦点回到新问题的阅读起点', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await click(page, '开始答题');
  await expect(page.locator('.v4-question-card')).toBeFocused();
  const button = page.getByRole('button', { name: '题目列表', exact: true });
  expect(await button.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
  await click(page, '不应当');
  await expect(page.locator('.v4-question-card')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
