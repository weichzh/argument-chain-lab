import { getArgumentSchemesV4 } from './modelV4.js';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasText = (value, max = 2400) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const exactKeys = (value, allowed) => isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));

export const validateArgumentCandidate = (candidate, expectedScope, expectedDirection = null) => {
  if (!exactKeys(candidate, ['scope', 'direction', 'schemeId', 'target', 'argument', 'facts', 'bridge', 'stressTest'])) {
    return { ok: false, error: 'AI 返回的候选包含未知字段或结构不完整。' };
  }
  if (candidate.scope !== expectedScope) return { ok: false, error: 'AI 返回了不适用于当前步骤的候选。' };
  if (!['support', 'oppose'].includes(candidate.direction)) return { ok: false, error: '候选方向无效。' };
  if (expectedDirection && candidate.direction !== expectedDirection) {
    return { ok: false, error: '候选方向与当前论证方向不一致。' };
  }
  if (!getArgumentSchemesV4().some((scheme) => scheme.id === candidate.schemeId)) {
    return { ok: false, error: '候选使用了方案目录之外的论证方案。' };
  }
  if (!exactKeys(candidate.target, ['shortLabel', 'text'])
    || !hasText(candidate.target.shortLabel, 160)
    || !hasText(candidate.target.text, 1200)) {
    return { ok: false, error: '候选结论不完整。' };
  }
  if (!exactKeys(candidate.argument, ['title', 'summary'])
    || !hasText(candidate.argument.title, 240)
    || !hasText(candidate.argument.summary, 1600)) {
    return { ok: false, error: '候选理由说明不完整。' };
  }
  if (!Array.isArray(candidate.facts) || candidate.facts.length < 1 || candidate.facts.length > 8) {
    return { ok: false, error: '候选必须包含 1 到 8 项事实。' };
  }
  for (const fact of candidate.facts) {
    if (!exactKeys(fact, ['kind', 'statement', 'plainExplanation', 'truthConditions', 'falsifier'])
      || !['stipulated', 'empirical', 'descriptive'].includes(fact.kind)
      || !hasText(fact.statement, 1200)
      || !hasText(fact.plainExplanation)
      || !hasText(fact.truthConditions)
      || !hasText(fact.falsifier)) {
      return { ok: false, error: '候选事实的结构不完整。' };
    }
  }
  if (!exactKeys(candidate.bridge, ['kind', 'shortLabel', 'text', 'explanation', 'example'])
    || !['bridge', 'terminal'].includes(candidate.bridge.kind)
    || !hasText(candidate.bridge.shortLabel, 160)
    || !hasText(candidate.bridge.text, 1600)
    || !hasText(candidate.bridge.explanation)
    || !hasText(candidate.bridge.example)) {
    return { ok: false, error: '候选判断依据的结构不完整。' };
  }
  if (!exactKeys(candidate.stressTest, ['scenario', 'question'])
    || !hasText(candidate.stressTest.scenario, 3200)
    || candidate.stressTest.scenario.trim().length < 35
    || !hasText(candidate.stressTest.question, 1600)
    || candidate.stressTest.question.trim().length < 12
    || /对象不同|关键结构相同|立场、身份或群体不同/.test(candidate.stressTest.scenario)) {
    return { ok: false, error: '候选相似案例不完整。' };
  }
  return { ok: true, value: candidate };
};
