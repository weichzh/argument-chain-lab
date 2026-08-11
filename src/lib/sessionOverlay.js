import { arglogicCatalog, normalizeSessionOverlay } from '../data/model.js';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasText = (value, max = 2400) => (
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
);

const exactKeys = (value, allowed) => (
  isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key))
);

export const validateArgumentCandidate = (candidate, expectedScope, expectedDirection = null) => {
  if (!exactKeys(candidate, ['scope', 'direction', 'schemeId', 'target', 'argument', 'facts', 'bridge', 'stressTest'])) {
    return { ok: false, error: 'AI 返回的候选包含未知字段或结构不完整。' };
  }
  if (candidate.scope !== expectedScope) {
    return { ok: false, error: 'AI 返回了不适用于当前步骤的候选。' };
  }
  if (!['support', 'oppose'].includes(candidate.direction)) {
    return { ok: false, error: '候选方向无效。' };
  }
  if (expectedDirection && candidate.direction !== expectedDirection) {
    return { ok: false, error: '候选方向与当前论证方向不一致。' };
  }
  if (!arglogicCatalog?.schemes?.some((scheme) => scheme.id === candidate.schemeId)) {
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
    return { ok: false, error: '候选规范原则的结构不完整。' };
  }
  if (!exactKeys(candidate.stressTest, ['scenario', 'question'])
    || !hasText(candidate.stressTest.scenario, 3200)
    || !hasText(candidate.stressTest.question, 1600)) {
    return { ok: false, error: '候选压力测试不完整。' };
  }
  return { ok: true, value: candidate };
};

export const candidateRequestMatchesState = (state, context) => Boolean(context)
  && state.updatedAt === context.updatedAt
  && state.policyIndex === context.policyIndex
  && state.phase === context.phase
  && (state.currentChain?.id || null) === context.chainId
  && state.currentTargetClaimId === context.targetClaimId
  && state.currentArgumentId === context.argumentId
  && state.currentFactIndex === context.factIndex
  && (state.currentChain?.steps.length || 0) === context.stepCount;

const localId = (kind) => `local_${kind}_${crypto.randomUUID()}`;

export const mergeCandidateIntoOverlay = (
  currentOverlay,
  candidate,
  { currentTargetClaimId = null } = {},
) => {
  const overlay = normalizeSessionOverlay(currentOverlay);
  const next = {
    facts: { ...overlay.facts },
    claims: { ...overlay.claims },
    arguments: { ...overlay.arguments },
    policies: [...overlay.policies],
    dilemmas: [...overlay.dilemmas],
  };
  const isRoot = candidate.scope === 'new_root';
  const policyId = isRoot ? localId('policy') : null;
  const targetClaimId = currentTargetClaimId || localId('claim');
  const bridgeClaimId = localId('claim');
  const argumentId = localId('argument');
  const factIds = candidate.facts.map((fact) => {
    const id = localId('fact');
    next.facts[id] = {
      id,
      kind: fact.kind,
      statement: fact.statement.trim(),
      plainExplanation: fact.plainExplanation.trim(),
      truthConditions: fact.truthConditions.trim(),
      plainTruthConditions: fact.truthConditions.trim(),
      falsifier: fact.falsifier.trim(),
      plainFalsifier: fact.falsifier.trim(),
      responseGuide: '这里只判断这句话是否符合事实，不判断最终结论。',
      origin: 'session_overlay',
    };
    return id;
  });

  if (isRoot) {
    next.claims[targetClaimId] = {
      id: targetClaimId,
      kind: 'policy',
      policyId,
      direction: candidate.direction,
      shortLabel: candidate.target.shortLabel.trim(),
      text: candidate.target.text.trim(),
      explanation: '这是你确认后加入本轮会话扩展的结构化判断。',
      origin: 'session_overlay',
    };
    const oppositeClaimId = localId('claim');
    next.claims[oppositeClaimId] = {
      id: oppositeClaimId,
      kind: 'policy',
      policyId,
      direction: candidate.direction === 'support' ? 'oppose' : 'support',
      shortLabel: '相反方向',
      text: `不接受上述判断：${candidate.target.text.trim()}`,
      explanation: '当前会话扩展尚未为相反方向生成理由。',
      origin: 'session_overlay',
    };
    next.policies.push({
      id: policyId,
      number: '自定',
      title: candidate.target.shortLabel.trim(),
      shortTitle: candidate.target.shortLabel.trim(),
      proposition: candidate.target.text.trim(),
      scope: '由你提出、经 AI 结构化并由你确认；原始输入和 AI 对话没有写入本地进度。',
      supportClaimId: candidate.direction === 'support' ? targetClaimId : oppositeClaimId,
      opposeClaimId: candidate.direction === 'oppose' ? targetClaimId : oppositeClaimId,
      question: '继续逐项确认这份结构化论证。',
      origin: 'session_overlay',
    });
  }

  next.claims[bridgeClaimId] = {
    id: bridgeClaimId,
    kind: candidate.bridge.kind === 'terminal' ? 'terminal' : 'bridge',
    shortLabel: candidate.bridge.shortLabel.trim(),
    text: candidate.bridge.text.trim(),
    explanation: candidate.bridge.explanation.trim(),
    example: candidate.bridge.example.trim(),
    stressTest: {
      scenario: candidate.stressTest.scenario.trim(),
      question: candidate.stressTest.question.trim(),
      distinctions: [],
    },
    nominatable: true,
    origin: 'session_overlay',
  };
  next.arguments[argumentId] = {
    id: argumentId,
    targetClaimId,
    title: candidate.argument.title.trim(),
    summary: candidate.argument.summary.trim(),
    factIds,
    bridgeClaimId,
    plainSteps: {
      facts: candidate.facts.map((fact) => fact.statement.trim()),
      bridge: candidate.bridge.text.trim(),
      result: candidate.target.text.trim(),
    },
    proposedSchemeId: candidate.schemeId,
    origin: 'session_overlay',
  };

  return {
    overlay: next,
    policyId,
    targetClaimId,
    argumentId,
    direction: candidate.direction,
  };
};
