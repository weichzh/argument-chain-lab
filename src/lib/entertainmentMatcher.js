export const MATCHER_VERSION = 'entertainment-matcher-2.0';

export const DEFAULT_FEATURE_WEIGHTS = Object.freeze({
  rootAnswer: 0.10,
  acceptedRevision: 0.18,
  diagnosis: 0.14,
  primaryReason: 0.10,
  reasonFamilies: 0.14,
  terminalValue: 0.14,
  stressResponse: 0.05,
  counterFamilies: 0.07,
  counterImpact: 0.08,
});

const unique = (items) => [...new Set(items.filter(Boolean))];
const first = (items) => Array.isArray(items) && items.length ? items[0] : null;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ROOT_ANSWERS = new Set(['yes', 'no', 'uncertain']);

const reasonFamilies = (model, reasonIds = []) => unique(reasonIds.flatMap((reasonId) => (
  model.reasons?.[reasonId]?.tags?.filter((tag) => tag.startsWith('reason-family:')) || []
)));

const jaccard = (left = [], right = []) => {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / new Set([...a, ...b]).size;
};

const enginePathFeatures = (model, result) => {
  const mainPath = first(result.mainPaths) || null;
  const mainReasonIds = mainPath?.steps?.map((step) => step.reasonId) || [];
  const terminalValueId = mainPath?.stress?.claimId
    || mainPath?.steps?.at(-1)?.bridgeClaimId
    || null;
  const counterReasonIds = result.counterPath?.steps?.map((step) => step.reasonId) || [];
  const counterTerminalValueId = result.counterPath?.stress?.claimId
    || result.counterPath?.steps?.at(-1)?.bridgeClaimId
    || null;
  return {
    policyId: result.policyId,
    rootAnswer: result.rootAnswer ?? null,
    finalRootAnswer: result.finalRootAnswer ?? result.rootAnswer ?? null,
    acceptedRevisionFrameId: result.acceptedRevisionFrameId ?? null,
    diagnosisClaimId: result.diagnosisClaimId ?? null,
    primaryReasonId: mainReasonIds[0] ?? null,
    reasonIds: mainReasonIds,
    reasonFamilies: reasonFamilies(model, mainReasonIds),
    terminalValueId,
    stressResponse: mainPath?.stress?.response ?? null,
    counterClaimId: result.counterClaimId ?? null,
    counterReasonIds,
    counterFamilies: reasonFamilies(model, counterReasonIds),
    counterTerminalValueId,
    counterImpact: result.counterImpact ?? null,
  };
};

const benchmarkPathFeatures = (model, path) => ({
  policyId: path.policyId,
  rootAnswer: path.rootAnswer ?? null,
  finalRootAnswer: path.rootAnswer ?? null,
  acceptedRevisionFrameId: path.acceptedRevisionFrameId ?? null,
  diagnosisClaimId: path.diagnosisClaimId ?? null,
  primaryReasonId: path.canonicalReasonPath?.[0] ?? null,
  reasonIds: path.canonicalReasonPath || [],
  reasonFamilies: reasonFamilies(model, path.canonicalReasonPath || []),
  terminalValueId: path.terminalValueId ?? null,
  stressResponse: path.stressResponse ?? null,
  counterClaimId: path.counterClaimId ?? null,
  counterReasonIds: path.canonicalCounterReasonPath || [],
  counterFamilies: reasonFamilies(model, path.canonicalCounterReasonPath || []),
  counterTerminalValueId: path.counterTerminalValueId ?? null,
  counterImpact: path.counterImpact ?? null,
});

const equalityScore = (left, right, { uncertainPartial = 0.4 } = {}) => {
  if (left == null || right == null) return null;
  if (left === right) return 1;
  if (left === 'uncertain' || right === 'uncertain') return uncertainPartial;
  return 0;
};

const revisionScore = (user, profile) => {
  if (user.rootAnswer !== 'no' || profile.rootAnswer !== 'no') return null;
  if (!user.acceptedRevisionFrameId && !profile.acceptedRevisionFrameId) return 1;
  if (user.acceptedRevisionFrameId === profile.acceptedRevisionFrameId) return 1;
  if (!user.acceptedRevisionFrameId || !profile.acceptedRevisionFrameId) return 0.15;
  if (user.diagnosisClaimId && user.diagnosisClaimId === profile.diagnosisClaimId) return 0.8;
  return 0.25;
};

const reasonScore = (user, profile) => {
  if (!user.primaryReasonId || !profile.primaryReasonId) return null;
  if (user.primaryReasonId === profile.primaryReasonId) return 1;
  if (!user.reasonFamilies?.length || !profile.reasonFamilies?.length) return 0;
  const family = jaccard(user.reasonFamilies, profile.reasonFamilies);
  return family ? 0.45 + 0.45 * family : 0;
};

const impactOrder = {
  no_change: 0,
  weaken: 1,
  uncertain: 1.5,
  offset: 2,
  reverse: 3,
};
const impactScore = (left, right) => {
  if (left == null || right == null) return null;
  if (left === right) return 1;
  const a = impactOrder[left];
  const b = impactOrder[right];
  if (a == null || b == null) return 0;
  return clamp01(1 - Math.abs(a - b) / 3);
};

const featureScores = (user, profile) => ({
  rootAnswer: equalityScore(user.rootAnswer, profile.rootAnswer, { uncertainPartial: 0.45 }),
  acceptedRevision: revisionScore(user, profile),
  diagnosis: equalityScore(user.diagnosisClaimId, profile.diagnosisClaimId, { uncertainPartial: 0 }),
  primaryReason: reasonScore(user, profile),
  reasonFamilies: user.reasonFamilies?.length && profile.reasonFamilies?.length
    ? jaccard(user.reasonFamilies, profile.reasonFamilies) : null,
  terminalValue: equalityScore(user.terminalValueId, profile.terminalValueId, { uncertainPartial: 0 }),
  stressResponse: equalityScore(user.stressResponse, profile.stressResponse, { uncertainPartial: 0.45 }),
  counterFamilies: user.counterFamilies?.length && profile.counterFamilies?.length
    ? jaccard(user.counterFamilies, profile.counterFamilies) : null,
  counterImpact: impactScore(user.counterImpact, profile.counterImpact),
});

const policySimilarity = (user, profile, weights) => {
  const scores = featureScores(user, profile);
  let obtained = 0;
  let available = 0;
  let possible = 0;
  for (const [feature, weight] of Object.entries(weights)) {
    possible += weight;
    const value = scores[feature];
    if (value == null) continue;
    available += weight;
    obtained += weight * value;
  }
  return {
    score: available ? obtained / available : null,
    coverage: possible ? available / possible : 0,
    featureScores: scores,
  };
};

const sourceQuality = (status) => ({
  source_anchored: { band: '文本锚定夹具', note: '以一项代表文本或著作为测试锚点。' },
  tradition_reconstruction: { band: '传统重建夹具', note: '以人物或思想传统作编辑性重建。' },
  synthetic_stress_fixture: { band: '合成压力夹具', note: '这是合成或刻板压力夹具，不是历史身份判断。' },
}[status] || { band: '未标注夹具', note: '基准来源状态未标注。' });

const normalizeUserResults = (model, policyResults) => Object.fromEntries(
  Object.entries(policyResults || {}).flatMap(([policyId, result]) => {
    const features = result?.canonicalReasonPath || result?.rootBasis
      ? benchmarkPathFeatures(model, { policyId, ...result })
      : enginePathFeatures(model, { policyId, ...result });
    return ROOT_ANSWERS.has(features.rootAnswer) ? [[policyId, features]] : [];
  }),
);

const profileFeatures = (model, profile) => Object.fromEntries(
  Object.entries(profile.expectedPaths || {}).map(([policyId, path]) => [
    policyId,
    benchmarkPathFeatures(model, path),
  ]),
);

const weightedProfileScore = (userByPolicy, profileByPolicy, weights, policyWeights = {}) => {
  let obtained = 0;
  let availableFeatureWeight = 0;
  let answeredPolicyWeight = 0;
  const policyDetails = {};
  for (const [policyId, user] of Object.entries(userByPolicy)) {
    const profile = profileByPolicy[policyId];
    if (!profile || !user.rootAnswer) continue;
    const policyWeight = policyWeights[policyId] ?? 1;
    const result = policySimilarity(user, profile, weights);
    const coveredWeight = policyWeight * result.coverage;
    answeredPolicyWeight += policyWeight;
    availableFeatureWeight += coveredWeight;
    if (result.score != null) obtained += coveredWeight * result.score;
    policyDetails[policyId] = result;
  }
  return {
    similarity: availableFeatureWeight ? obtained / availableFeatureWeight : 0,
    reasoningDepth: answeredPolicyWeight ? availableFeatureWeight / answeredPolicyWeight : 0,
    answeredPolicyWeight,
    policyDetails,
  };
};

const entropy = (values) => {
  if (!values.length) return 0;
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.values()].reduce((sum, count) => {
    const p = count / values.length;
    return sum - p * Math.log2(p);
  }, 0);
};

const pathDistinguishingKey = (path) => [
  path.rootAnswer,
  path.acceptedRevisionFrameId || '-',
  path.diagnosisClaimId || '-',
  path.canonicalReasonPath?.[0] || '-',
  path.terminalValueId || '-',
].join('|');

export const recommendTieBreaker = (model, benchmark, ranked, answeredPolicyIds, options = {}) => {
  const answered = new Set(answeredPolicyIds);
  const candidates = ranked.filter((item) => (
    item.rank <= (options.maxCandidates || 6)
    || item.similarityPercent >= ranked[0].similarityPercent - (options.candidateWindow || 8)
  ));
  if (candidates.length <= 1) return null;
  const profileById = Object.fromEntries(benchmark.profiles.map((profile) => [profile.id, profile]));
  const choices = benchmark.tieBreakerPolicyIds
    .filter((policyId) => !answered.has(policyId))
    .map((policyId) => {
      const keys = candidates.map((candidate) => (
        pathDistinguishingKey(profileById[candidate.profileId].expectedPaths[policyId])
      ));
      return {
        policyId,
        entropy: entropy(keys),
        uniqueExpectedPaths: new Set(keys).size,
        candidateCount: candidates.length,
      };
    })
    .sort((left, right) => right.entropy - left.entropy || right.uniqueExpectedPaths - left.uniqueExpectedPaths);
  const best = choices[0];
  if (!best || best.uniqueExpectedPaths <= 1) return null;
  const policy = model.policies.find((item) => item.id === best.policyId);
  return {
    ...best,
    title: policy?.shortTitle || policy?.title || best.policyId,
    question: policy?.entry?.question || null,
    explanation: `当前接近的 ${candidates.length} 个原型在这道题上的完整路径分成 ${best.uniqueExpectedPaths} 组。`,
  };
};

const topTerminalValues = (model, userByPolicy, limit = 2) => {
  const counts = new Map();
  Object.values(userByPolicy).forEach((path) => {
    if (path.terminalValueId) counts.set(path.terminalValueId, (counts.get(path.terminalValueId) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => ({ id, label: model.claims?.[id]?.plain || id }));
};

const institutionalStyle = (model, userByPolicy) => {
  const counts = new Map();
  const mapFamily = {
    'reason-family:rule_of_law': '程序约束',
    'reason-family:answerability': '权力问责',
    'reason-family:local_autonomy': '地方自治',
    'reason-family:market_order': '市场自愿',
    'reason-family:market_coordination': '市场协调',
    'reason-family:common_ownership': '共同治理',
    'reason-family:class_emancipation': '反阶级支配',
    'reason-family:state_capacity': '国家能力',
    'reason-family:democratic_authority': '民主授权',
    'reason-family:popular_sovereignty': '多数授权',
    'reason-family:self_ownership': '自我所有',
    'reason-family:personal_sovereignty': '个人主权',
    'reason-family:tradition': '传统延续',
    'reason-family:sacred_order': '神圣秩序',
    'reason-family:nonviolence': '非暴力',
  };
  Object.values(userByPolicy).forEach((path) => {
    [...(path.reasonFamilies || []), ...(path.counterFamilies || [])].forEach((family) => {
      const label = mapFamily[family];
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '情境判断';
};

const boundaryStyle = (userByPolicy) => {
  const impacts = Object.values(userByPolicy).map((item) => item.counterImpact).filter(Boolean);
  const revisions = Object.values(userByPolicy).filter((item) => item.acceptedRevisionFrameId).length;
  if (impacts.includes('reverse') || impacts.includes('offset')) return '竞争理由敏感';
  if (impacts.filter((item) => item === 'weaken').length >= 2) return '审慎权衡';
  if (revisions >= 2) return '条件校准';
  return '原则稳定';
};

const fingerprint = async (value) => {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持生成分享指纹。');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
    .toUpperCase();
};

export const buildArgumentProfile = async (model, userByPolicy) => {
  const values = topTerminalValues(model, userByPolicy, 2);
  const valuePart = values.map((item) => item.label).join('·') || '尚未形成核心价值';
  const institution = institutionalStyle(model, userByPolicy);
  const boundary = boundaryStyle(userByPolicy);
  const normalized = Object.fromEntries(Object.entries(userByPolicy)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([policyId, item]) => [
    policyId,
    {
      rootAnswer: item.rootAnswer,
      acceptedRevisionFrameId: item.acceptedRevisionFrameId,
      diagnosisClaimId: item.diagnosisClaimId,
      reasonFamilies: [...(item.reasonFamilies || [])].sort(),
      terminalValueId: item.terminalValueId,
      counterImpact: item.counterImpact,
    },
    ]));
  const fingerprintInput = { modelVersion: model.meta?.version || null, matcherVersion: MATCHER_VERSION, paths: normalized };
  return {
    label: `${valuePart}·${institution}·${boundary}型`,
    fingerprint: await fingerprint(JSON.stringify(fingerprintInput)),
    topValues: values,
    institutionalStyle: institution,
    boundaryStyle: boundary,
    caveat: '这是由本次已回答论证结构生成的稳定描述和指纹，不是人格类型或科学分类。',
  };
};

const explainDifferences = (model, userByPolicy, profile, limit = 4) => {
  const items = [];
  for (const [policyId, user] of Object.entries(userByPolicy)) {
    const expected = profile.expectedPaths[policyId];
    if (!expected) continue;
    const profilePath = benchmarkPathFeatures(model, expected);
    const policy = model.policies.find((item) => item.id === policyId);
    if (user.rootAnswer !== profilePath.rootAnswer) {
      items.push({
        kind: 'different_answer',
        policyId,
        policyTitle: policy?.shortTitle || policyId,
        userAnswer: user.rootAnswer,
        profileAnswer: profilePath.rootAnswer,
      });
    } else if (user.acceptedRevisionFrameId !== profilePath.acceptedRevisionFrameId) {
      items.push({
        kind: 'different_revision_boundary',
        policyId,
        policyTitle: policy?.shortTitle || policyId,
        userRevision: user.acceptedRevisionFrameId,
        profileRevision: profilePath.acceptedRevisionFrameId,
      });
    } else if (
      user.terminalValueId !== profilePath.terminalValueId
      || jaccard(user.reasonFamilies, profilePath.reasonFamilies) < 1
    ) {
      items.push({
        kind: 'same_answer_different_reason',
        policyId,
        policyTitle: policy?.shortTitle || policyId,
        userReason: user.primaryReasonId ? model.reasons[user.primaryReasonId]?.title : null,
        profileReason: profilePath.primaryReasonId ? model.reasons[profilePath.primaryReasonId]?.title : null,
        userTerminal: user.terminalValueId ? model.claims[user.terminalValueId]?.plain : null,
        profileTerminal: profilePath.terminalValueId ? model.claims[profilePath.terminalValueId]?.plain : null,
      });
    } else if (user.counterImpact !== profilePath.counterImpact) {
      items.push({
        kind: 'different_counter_response',
        policyId,
        policyTitle: policy?.shortTitle || policyId,
        userCounterImpact: user.counterImpact,
        profileCounterImpact: profilePath.counterImpact,
      });
    }
  }
  return items.slice(0, limit);
};

const explainMatches = (model, userByPolicy, profile, limit = 5) => {
  const items = [];
  for (const [policyId, user] of Object.entries(userByPolicy)) {
    const expected = profile.expectedPaths[policyId];
    if (!expected) continue;
    const reference = benchmarkPathFeatures(model, expected);
    const policyTitle = model.policies.find((item) => item.id === policyId)?.shortTitle || policyId;
    if (user.rootAnswer !== reference.rootAnswer) continue;
    if (user.acceptedRevisionFrameId && user.acceptedRevisionFrameId === reference.acceptedRevisionFrameId) {
      items.push({ kind: 'shared_revision_boundary', policyId, policyTitle, frameId: user.acceptedRevisionFrameId, strength: 4 });
    }
    if (user.terminalValueId && user.terminalValueId === reference.terminalValueId) {
      items.push({
        kind: 'shared_terminal_value',
        policyId,
        policyTitle,
        valueId: user.terminalValueId,
        valueLabel: model.claims[user.terminalValueId]?.plain || user.terminalValueId,
        strength: 3,
      });
    }
    const familySimilarity = user.reasonFamilies.length && reference.reasonFamilies.length
      ? jaccard(user.reasonFamilies, reference.reasonFamilies)
      : 0;
    if (familySimilarity > 0) {
      items.push({
        kind: 'shared_reason_family',
        policyId,
        policyTitle,
        familySimilarity: Math.round(familySimilarity * 100),
        strength: 2 + familySimilarity,
      });
    }
    if (user.counterImpact && user.counterImpact === reference.counterImpact) {
      items.push({ kind: 'shared_counter_response', policyId, policyTitle, counterImpact: user.counterImpact, strength: 2 });
    }
    items.push({ kind: 'shared_root_answer', policyId, policyTitle, rootAnswer: user.rootAnswer, strength: 1 });
  }
  return items
    .sort((a, b) => b.strength - a.strength || a.policyTitle.localeCompare(b.policyTitle))
    .slice(0, limit)
    .map(({ strength, ...item }) => item);
};

const resultStage = (reasoningDepthPercent) => {
  if (reasoningDepthPercent < 25) return { id: 'policy_outline', label: '政策外观', note: '主要依据政策答案，适合显示候选组，不适合唯一化。' };
  if (reasoningDepthPercent < 45) return { id: 'revision_boundary', label: '接受边界', note: '已经包含部分可接受修改，但理由与价值仍较浅。' };
  if (reasoningDepthPercent < 65) return { id: 'reason_profile', label: '理由轮廓', note: '已经包含主要理由，可给出暂定最近邻。' };
  return { id: 'audited_path', label: '论证路径', note: '已经包含较完整的理由、价值或相反理由复核。' };
};

const presentationPolicy = (profile) => {
  const highRiskTags = new Set(['totalitarian', 'fascist', 'racialist']);
  const highRisk = profile.tags?.some((tag) => highRiskTags.has(tag))
    || profile.derivedTraits?.authoritarianism >= 85;
  return highRisk
    ? { mode: 'neutral_contextualized', celebratoryEffectsAllowed: false, note: '使用中性说明并同时展示实质差异，不使用成就式动画或英雄化文案。' }
    : { mode: 'playful_but_qualified', celebratoryEffectsAllowed: true, note: '可以使用轻量娱乐化呈现，但必须保留覆盖度、差距和基准限制。' };
};

export const matchEntertainment = async (model, benchmark, policyResults, options = {}) => {
  const weights = { ...DEFAULT_FEATURE_WEIGHTS, ...(options.featureWeights || {}) };
  const userByPolicy = normalizeUserResults(model, policyResults);
  const expectedPolicyIds = unique(
    options.expectedPolicyIds
      || benchmark.corePolicyIds
      || model.product?.defaultPolicyIds
      || Object.keys(userByPolicy),
  );
  const answeredPolicyIds = Object.keys(userByPolicy).filter((policyId) => userByPolicy[policyId]?.rootAnswer);
  const expectedSet = new Set(expectedPolicyIds);
  const answeredExpected = answeredPolicyIds.filter((policyId) => expectedSet.has(policyId));
  const policyCoverage = expectedPolicyIds.length
    ? answeredExpected.length / expectedPolicyIds.length
    : answeredPolicyIds.length ? 1 : 0;
  const optionalAnsweredPolicyIds = answeredPolicyIds.filter((policyId) => !expectedSet.has(policyId));

  const ranked = benchmark.profiles.map((profile) => {
    const scored = weightedProfileScore(userByPolicy, profileFeatures(model, profile), weights, options.policyWeights);
    const evidenceCoverage = policyCoverage * scored.reasoningDepth;
    return {
      profileId: profile.id,
      label: profile.label,
      similarity: scored.similarity,
      similarityPercent: Math.round(scored.similarity * 10000) / 100,
      reasoningDepth: scored.reasoningDepth,
      reasoningDepthPercent: Math.round(scored.reasoningDepth * 10000) / 100,
      policyCoverage,
      policyCoveragePercent: Math.round(policyCoverage * 10000) / 100,
      evidenceCoverage,
      evidenceCoveragePercent: Math.round(evidenceCoverage * 10000) / 100,
      // Backward-compatible alias: coverage now means combined evidence coverage.
      coverage: evidenceCoverage,
      coveragePercent: Math.round(evidenceCoverage * 10000) / 100,
      sourceStatus: profile.source.status,
      sourceQuality: sourceQuality(profile.source.status),
      anchor: profile.source.anchor,
      presentation: presentationPolicy(profile),
      policyDetails: scored.policyDetails,
    };
  }).sort((a, b) => b.similarity - a.similarity
    || b.evidenceCoverage - a.evidenceCoverage
    || a.label.localeCompare(b.label));
  ranked.forEach((item, index) => { item.rank = index + 1; });
  const top = ranked[0];
  const second = ranked[1];
  const margin = top && second ? top.similarityPercent - second.similarityPercent : 0;
  const confidence = !top || top.policyCoveragePercent < 40 || top.reasoningDepthPercent < 20
    ? 'exploratory'
    : top.policyCoveragePercent >= 75 && top.reasoningDepthPercent >= 65 && margin >= 7
      ? 'stable'
      : top.policyCoveragePercent >= 60 && top.reasoningDepthPercent >= 45 && margin >= 3
        ? 'provisional'
        : 'ambiguous';
  const profileById = Object.fromEntries(benchmark.profiles.map((profile) => [profile.id, profile]));
  const decorateCandidate = (candidate) => candidate ? {
    ...candidate,
    differences: explainDifferences(model, userByPolicy, profileById[candidate.profileId]),
  } : null;
  const nearestPrototype = decorateCandidate(top);
  const alternatives = ranked
    .slice(1, options.alternativeCount ? options.alternativeCount + 1 : 5)
    .map(decorateCandidate);
  const tieBreaker = recommendTieBreaker(model, benchmark, ranked, answeredPolicyIds, options);
  const displayStrategy = top?.policyCoveragePercent < 40
    ? { id: 'argument_profile_only', note: '已答政策过少，只显示用户自己的论证型，不显示单一历史原型。' }
    : ['stable', 'provisional'].includes(confidence)
      ? { id: 'nearest_with_alternatives', note: '显示一个最近邻，同时保留替代原型、差距和覆盖度。' }
      : { id: 'candidate_group', note: '当前多个原型接近，显示候选组并建议一题区分，不强行唯一化历史标签。' };
  return {
    matcherVersion: MATCHER_VERSION,
    expectedPolicyIds,
    answeredPolicyIds,
    optionalAnsweredPolicyIds,
    policyCoveragePercent: top?.policyCoveragePercent ?? 0,
    reasoningDepthPercent: top?.reasoningDepthPercent ?? 0,
    evidenceCoveragePercent: top?.evidenceCoveragePercent ?? 0,
    nearestPrototype,
    alternatives,
    marginToSecond: Math.round(margin * 100) / 100,
    confidence,
    displayStrategy,
    confidenceExplanation: {
      stable: '已回答的政策和论证深度都较充分，且第一名与第二名有明显差距。',
      provisional: '当前第一名较清楚，但仍有未回答或未深入核对的部分。',
      ambiguous: '多个原型目前十分接近；不应强行解释为唯一历史标签。',
      exploratory: '当前信息只覆盖少量政策，或主要停留在政策答案层，尚不足以稳定比较完整论证路径。',
    }[confidence],
    coverageExplanation: {
      policyCoverage: '已回答的预期政策占比。',
      reasoningDepth: '在已回答政策中，修改边界、理由、价值与反方复核等可比较信息的完整程度。',
      evidenceCoverage: '政策覆盖与论证深度的合并指标。',
    },
    tieBreaker,
    resultStage: resultStage(top?.reasoningDepthPercent ?? 0),
    argumentProfile: await buildArgumentProfile(model, userByPolicy),
    decisiveSimilarities: top ? explainMatches(model, userByPolicy, profileById[top.profileId]) : [],
    differencesFromNearest: top ? explainDifferences(model, userByPolicy, profileById[top.profileId]) : [],
    comparisonWithSecond: second ? {
      profileId: second.profileId,
      label: second.label,
      similarityPercent: second.similarityPercent,
      differences: explainDifferences(model, userByPolicy, profileById[second.profileId]),
    } : null,
    presentation: top?.presentation || null,
    displayCaveat: '最近邻只表示在当前 benchmark 中的论证路径相似，不表示政治身份概率，也不表示该标签穷尽你的价值观。',
    ranked,
  };
};

export const buildRootOnlyResults = (benchmarkProfile, policyIds) => Object.fromEntries(policyIds.map((policyId) => [
  policyId,
  { policyId, rootAnswer: benchmarkProfile.expectedPaths[policyId].rootAnswer },
]));
