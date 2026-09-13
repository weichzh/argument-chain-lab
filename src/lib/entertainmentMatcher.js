import { validatePolicyResults } from './formalValidator.js';

export const MATCHER_VERSION = 'entertainment-matcher-3.3';

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

export const comparableStressResponse = (model, result, path) => {
  const revisedCases = new Set(['n_hierarchical_authority', 'v_hierarchical_order', 'n_sacred_public_order', 'n_expertise_can_delay', 'n_institutional_learning', 'n_emergency_power_strictly_limited']);
  const oldEdition = result.sourceModelVersion && result.sourceModelVersion !== model.meta.version;
  return oldEdition && revisedCases.has(path?.stress?.claimId) ? null : path?.stress?.response ?? null;
};

const enginePathFeatures = (model, result) => {
  const mainPath = first(result.mainPaths) || null;
  const supportedMainPath = mainPath?.status === 'retracted' ? null : mainPath;
  const mainReasonIds = supportedMainPath?.steps?.map((step) => step.reasonId) || [];
  const terminalValueId = ['accepted', 'qualified'].includes(supportedMainPath?.status)
    ? supportedMainPath?.stress?.claimId || supportedMainPath?.steps?.at(-1)?.bridgeClaimId || null
    : null;
  const supportedCounterPath = result.counterPath?.status === 'retracted' ? null : result.counterPath;
  const counterReasonIds = supportedCounterPath?.steps?.map((step) => step.reasonId) || [];
  const counterTerminalValueId = ['accepted', 'qualified'].includes(supportedCounterPath?.status)
    ? supportedCounterPath?.stress?.claimId || supportedCounterPath?.steps?.at(-1)?.bridgeClaimId || null
    : null;
  return {
    policyId: result.policyId,
    rootAnswer: result.rootAnswer ?? null,
    finalRootAnswer: result.finalRootAnswer ?? result.rootAnswer ?? null,
    revisionKnown: result.rootAnswer === 'no' && Boolean(result.diagnosisClaimId),
    acceptedRevisionFrameId: result.acceptedRevisionFrameId ?? null,
    diagnosisClaimId: result.diagnosisClaimId ?? null,
    primaryReasonId: mainReasonIds[0] ?? null,
    reasonIds: mainReasonIds,
    reasonFamilies: reasonFamilies(model, mainReasonIds),
    terminalValueId,
    stressResponse: comparableStressResponse(model, result, mainPath),
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
  revisionKnown: path.rootAnswer === 'no' && Boolean(
    path.revisionBasis || path.diagnosisClaimId || path.revisionAnswers,
  ),
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
  if (!user.revisionKnown || !profile.revisionKnown) return null;
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
  source_anchored: {
    band: '依据代表文本整理',
    note: '以一项代表文本或著作为参考；不表示这一思想传统只有一种解释。',
  },
  tradition_reconstruction: {
    band: '依据常见思想概述整理',
    note: '包含编辑性概括；结果应当同时说明具体相似点和差异。',
  },
  synthetic_stress_fixture: {
    band: '仅供测试的假想参考',
    note: '这是为了检查系统边界而构造的参考，不是历史身份判断。',
  },
  site_label_provisional: {
    band: '参考名称，尚待独立整理',
    note: '名称来自其他政治测试，目前只借用相邻参考检查候选范围，不能单独作为唯一结果。',
  },
}[status] || { band: '来源说明缺失', note: '这个参考名称尚未补充整理依据。' });

const eligibleForUniqueResult = (profile) => (
  profile?.allowUniqueResult !== false
  && profile?.referenceStatus !== 'provisional_reference_variant'
);

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
    explanation: `当前最接近的 ${candidates.length} 个参考立场，在这道题上的回答、可接受修改和主要理由分成 ${best.uniqueExpectedPaths} 组。`,
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

const firstDifferentReason = (left = [], right = []) => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return [left[index] || null, right[index] || null];
  }
  return [null, null];
};

const reasonTitle = (model, reasonId) => reasonId ? model.reasons[reasonId]?.title || reasonId : null;

const differenceForPolicy = (model, policyId, user, profile) => {
  const policyTitle = model.policies.find((item) => item.id === policyId)?.shortTitle || policyId;
  if (user.rootAnswer !== profile.rootAnswer) {
    return {
      kind: 'different_answer', policyId, policyTitle,
      userAnswer: user.rootAnswer, profileAnswer: profile.rootAnswer,
    };
  }
  if (user.revisionKnown && profile.revisionKnown
    && user.acceptedRevisionFrameId !== profile.acceptedRevisionFrameId) {
    return {
      kind: 'different_revision_boundary', policyId, policyTitle,
      userRevision: user.acceptedRevisionFrameId,
      profileRevision: profile.acceptedRevisionFrameId,
    };
  }
  if (user.diagnosisClaimId && profile.diagnosisClaimId
    && user.diagnosisClaimId !== profile.diagnosisClaimId) {
    return {
      kind: 'different_diagnosis', policyId, policyTitle,
      userDiagnosis: model.claims[user.diagnosisClaimId]?.plain || user.diagnosisClaimId,
      profileDiagnosis: model.claims[profile.diagnosisClaimId]?.plain || profile.diagnosisClaimId,
    };
  }
  if (user.terminalValueId && profile.terminalValueId
    && user.terminalValueId !== profile.terminalValueId) {
    return {
      kind: 'different_terminal_value', policyId, policyTitle,
      userTerminal: model.claims[user.terminalValueId]?.plain || user.terminalValueId,
      profileTerminal: model.claims[profile.terminalValueId]?.plain || profile.terminalValueId,
    };
  }
  if (user.primaryReasonId && profile.primaryReasonId
    && user.primaryReasonId !== profile.primaryReasonId) {
    return {
      kind: 'different_primary_reason', policyId, policyTitle,
      userReason: reasonTitle(model, user.primaryReasonId),
      profileReason: reasonTitle(model, profile.primaryReasonId),
    };
  }
  if (user.reasonFamilies?.length && profile.reasonFamilies?.length
    && jaccard(user.reasonFamilies, profile.reasonFamilies) < 1) {
    const [userReasonId, profileReasonId] = firstDifferentReason(user.reasonIds, profile.reasonIds);
    return {
      kind: 'different_reason_path', policyId, policyTitle,
      userReason: reasonTitle(model, userReasonId) || '未记录后续理由',
      profileReason: reasonTitle(model, profileReasonId) || '未记录后续理由',
    };
  }
  if (user.stressResponse && profile.stressResponse
    && user.stressResponse !== profile.stressResponse) {
    return {
      kind: 'different_stress_response', policyId, policyTitle,
      userStressResponse: user.stressResponse,
      profileStressResponse: profile.stressResponse,
    };
  }
  if (user.counterFamilies?.length && profile.counterFamilies?.length
    && jaccard(user.counterFamilies, profile.counterFamilies) < 1) {
    const [userReasonId, profileReasonId] = firstDifferentReason(
      user.counterReasonIds,
      profile.counterReasonIds,
    );
    return {
      kind: 'different_counter_reason', policyId, policyTitle,
      userReason: reasonTitle(model, userReasonId) || '未记录相反理由',
      profileReason: reasonTitle(model, profileReasonId) || '未记录相反理由',
    };
  }
  if (user.counterImpact && profile.counterImpact
    && user.counterImpact !== profile.counterImpact) {
    return {
      kind: 'different_counter_response', policyId, policyTitle,
      userCounterImpact: user.counterImpact,
      profileCounterImpact: profile.counterImpact,
    };
  }
  return null;
};

const explainDifferences = (model, userByPolicy, profile, limit = 4) => {
  const items = [];
  for (const [policyId, user] of Object.entries(userByPolicy)) {
    const expected = profile.expectedPaths[policyId];
    if (!expected) continue;
    const profilePath = benchmarkPathFeatures(model, expected);
    const difference = differenceForPolicy(model, policyId, user, profilePath);
    if (difference) items.push(difference);
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

const validSimilarity = (model, item, user, profile) => {
  if (!user || !profile || user.rootAnswer !== profile.rootAnswer) return false;
  if (item.kind === 'shared_revision_boundary') {
    return user.revisionKnown && profile.revisionKnown
      && user.acceptedRevisionFrameId === item.frameId
      && profile.acceptedRevisionFrameId === item.frameId;
  }
  if (item.kind === 'shared_terminal_value') {
    return user.terminalValueId === item.valueId
      && profile.terminalValueId === item.valueId
      && item.valueLabel === (model.claims[item.valueId]?.plain || item.valueId);
  }
  if (item.kind === 'shared_reason_family') {
    const similarity = user.reasonFamilies?.length && profile.reasonFamilies?.length
      ? Math.round(jaccard(user.reasonFamilies, profile.reasonFamilies) * 100)
      : 0;
    return similarity > 0 && similarity === item.familySimilarity;
  }
  if (item.kind === 'shared_counter_response') {
    return Boolean(user.counterImpact)
      && user.counterImpact === profile.counterImpact
      && item.counterImpact === user.counterImpact;
  }
  return item.kind === 'shared_root_answer' && item.rootAnswer === user.rootAnswer;
};

export const validateEntertainmentResult = (model, benchmark, policyResults, result) => {
  const errors = [];
  const userByPolicy = normalizeUserResults(model, policyResults);
  const profiles = Object.fromEntries(benchmark.profiles.map((profile) => [profile.id, profile]));
  const roundPercent = (value) => Math.round(value * 10000) / 100;
  const answeredExpected = Object.keys(userByPolicy).filter((policyId) => (
    result.expectedPolicyIds.includes(policyId)
  )).length;
  const expectedCoverage = result.expectedPolicyIds.length
    ? roundPercent(answeredExpected / result.expectedPolicyIds.length)
    : Object.keys(userByPolicy).length ? 100 : 0;
  if (result.policyCoveragePercent !== expectedCoverage) {
    errors.push('policyCoveragePercent: 政策覆盖率与已回答题目不一致。');
  }
  for (let index = 0; index < result.ranked.length; index += 1) {
    const item = result.ranked[index];
    if (item.rank !== index + 1
      || item.similarityPercent !== roundPercent(item.similarity)
      || item.evidenceCoveragePercent !== roundPercent(item.policyCoverage * item.reasoningDepth)
      || (index && item.similarity > result.ranked[index - 1].similarity)) {
      errors.push(`ranked/${item.profileId}: 排名或覆盖率数值不自洽。`);
    }
  }
  const top = result.ranked[0] || null;
  const second = result.ranked[1] || null;
  const expectedMargin = top && second
    ? Math.round((top.similarityPercent - second.similarityPercent) * 100) / 100
    : 0;
  if (result.closestReference?.profileId !== top?.profileId
    || result.reasoningDepthPercent !== (top?.reasoningDepthPercent ?? 0)
    || result.evidenceCoveragePercent !== (top?.evidenceCoveragePercent ?? 0)
    || result.marginToSecond !== expectedMargin) {
    errors.push('closestReference: 最近参考或第一、第二名差距与排名不一致。');
  }
  const featuresFor = (profileId, policyId) => {
    const path = profiles[profileId]?.expectedPaths?.[policyId];
    return path ? benchmarkPathFeatures(model, path) : null;
  };
  const validateDifferences = (profileId, items, location) => {
    for (const item of items || []) {
      const user = userByPolicy[item.policyId];
      const profile = featuresFor(profileId, item.policyId);
      const expected = user && profile ? differenceForPolicy(model, item.policyId, user, profile) : null;
      if (JSON.stringify(item) !== JSON.stringify(expected)) {
        errors.push(`${location}/${item.policyId}: 差异说明没有对应到实际不同的特征。`);
      }
    }
  };

  const topProfileId = result.closestReference?.profileId || null;
  if (topProfileId) {
    validateDifferences(topProfileId, result.closestReference.differences, 'closestReference');
    validateDifferences(topProfileId, result.differencesFromNearest, 'differencesFromNearest');
    for (const item of result.decisiveSimilarities || []) {
      if (!validSimilarity(
        model,
        item,
        userByPolicy[item.policyId],
        featuresFor(topProfileId, item.policyId),
      )) {
        errors.push(`decisiveSimilarities/${item.policyId}: 相似说明没有对应到实际相同的特征。`);
      }
    }
  }
  for (const candidate of [...(result.candidateGroup || []), ...(result.alternatives || [])]) {
    validateDifferences(candidate.profileId, candidate.differences, `candidate/${candidate.profileId}`);
  }
  if (result.comparisonWithSecond) {
    validateDifferences(
      result.comparisonWithSecond.profileId,
      result.comparisonWithSecond.differences,
      'comparisonWithSecond',
    );
  }
  return { ok: errors.length === 0, errors };
};

const resultStage = (reasoningDepthPercent) => {
  if (reasoningDepthPercent < 25) return {
    id: 'policy_answers_only',
    label: '目前主要知道你的政策答案',
    note: '这时只能显示一组接近的参考立场，不适合挑出唯一名称。',
  };
  if (reasoningDepthPercent < 45) return {
    id: 'revision_preferences_known',
    label: '已经知道哪些修改会改变你的判断',
    note: '这比只看支持或反对更有区分力，但还不知道足够多的主要理由。',
  };
  if (reasoningDepthPercent < 65) return {
    id: 'main_reasons_known',
    label: '已经知道你的主要理由',
    note: '可以给出暂时最接近的参考，同时保留其他相近结果。',
  };
  return {
    id: 'deeper_reasons_reviewed',
    label: '已经检查到更深理由和相反理由',
    note: '信息相对充分，但结果仍然只是参考库中的相似比较。',
  };
};

const presentationPolicy = (profile) => {
  const highRiskTags = new Set(['totalitarian', 'fascist', 'racialist']);
  const highRisk = profile.tags?.some((tag) => highRiskTags.has(tag))
    || profile.derivedTraits?.authoritarianism >= 85;
  return highRisk
    ? { mode: 'neutral_contextualized', celebratoryEffectsAllowed: false, note: '使用中性说明并同时展示实质差异，不使用成就式动画或英雄化文案。' }
    : { mode: 'playful_but_qualified', celebratoryEffectsAllowed: true, note: '可以使用轻量娱乐化呈现，但必须同时说明用户回答了多少题、理由核对到哪一步，以及其他候选有多接近。' };
};

export const matchEntertainment = async (model, benchmark, policyResults, options = {}) => {
  const completedResults = Object.fromEntries(Object.entries(policyResults || {}).filter(([, result]) => (
    Object.hasOwn(result || {}, 'finalRootAnswer')
  )));
  const policyResultValidation = validatePolicyResults(model, completedResults);
  if (!policyResultValidation.ok) {
    throw new Error(`政策结果未通过形式校验：${policyResultValidation.errors[0]}`);
  }
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
      labelZh: profile.labelZh,
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
      referenceStatus: profile.referenceStatus || 'reviewed_reference',
      referenceFamilyId: profile.referenceFamilyId || profile.id,
      allowUniqueResult: eligibleForUniqueResult(profile),
      sourceMemberships: profile.sourceMemberships || [],
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
  const candidateWindow = options.candidateDisplayWindow ?? 3;
  const candidateGroup = top
    ? ranked.filter((item) => item.similarityPercent >= top.similarityPercent - candidateWindow)
      .slice(0, options.maxDisplayedCandidates || 8)
    : [];
  const provisionalNearTop = candidateGroup.some((item) => !item.allowUniqueResult);
  const uniquenessBlocked = !top?.allowUniqueResult || (provisionalNearTop && margin < 7);
  const confidence = !top || top.policyCoveragePercent < 40 || top.reasoningDepthPercent < 20
    ? 'exploratory'
    : uniquenessBlocked
      ? 'ambiguous'
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
  const closestReference = decorateCandidate(top);
  const nearestPrototype = uniquenessBlocked ? null : closestReference;
  const alternatives = ranked
    .slice(1, options.alternativeCount ? options.alternativeCount + 1 : 5)
    .map(decorateCandidate);
  const displayedCandidates = candidateGroup.map(decorateCandidate);
  const tieBreaker = recommendTieBreaker(model, benchmark, ranked, answeredPolicyIds, options);
  const displayStrategy = top?.policyCoveragePercent < 40
    ? {
        id: 'argument_profile_only',
        note: '已回答的政策还太少。只显示你自己的判断特点，不显示单一历史名称。',
      }
    : ['stable', 'provisional'].includes(confidence) && !uniquenessBlocked
      ? {
          id: 'nearest_with_alternatives',
          note: '显示一个目前最接近的参考，同时保留其他相近结果、差距和信息覆盖。',
        }
      : {
          id: 'candidate_group',
          note: provisionalNearTop
            ? '当前候选中包含尚未完成独立整理的细分名称，因此只显示候选组，不挑出唯一名称。'
            : '当前有多个参考立场十分接近，只显示候选组，并推荐一题继续区分。',
        };
  const result = {
    matcherVersion: MATCHER_VERSION,
    expectedPolicyIds,
    answeredPolicyIds,
    optionalAnsweredPolicyIds,
    policyCoveragePercent: top?.policyCoveragePercent ?? 0,
    reasoningDepthPercent: top?.reasoningDepthPercent ?? 0,
    evidenceCoveragePercent: top?.evidenceCoveragePercent ?? 0,
    closestReference,
    nearestPrototype: displayStrategy.id === 'nearest_with_alternatives' ? nearestPrototype : null,
    candidateGroup: displayedCandidates,
    provisionalCandidates: displayedCandidates.filter((item) => !item.allowUniqueResult),
    alternatives,
    marginToSecond: Math.round(margin * 100) / 100,
    confidence,
    displayStrategy,
    confidenceExplanation: {
      stable: '已回答的政策和理由比较充分，而且最接近的参考与其他候选有明显差距。',
      provisional: '目前有一个较接近的参考，但仍有未回答或没有深入核对的部分。',
      ambiguous: uniquenessBlocked
        ? '当前最接近的候选中包含尚待独立整理的细分名称，或多个候选差距很小，因此不应挑出唯一名称。'
        : '多个参考立场目前十分接近，不应强行解释为唯一历史标签。',
      exploratory: '当前只回答了少量政策，或者还没有说明足够多的理由，暂时无法稳定比较。',
    }[confidence],
    coverageExplanation: {
      policyCoverage: '在建议回答的政策中，你已经完成了多少道。',
      reasoningDepth: '在已经回答的题目里，你是否只选了应当或不应当，还是已经继续说明可接受的修改、主要理由和相反理由。',
      evidenceCoverage: '把已回答题数和理由核对程度合在一起，用来判断当前信息是否足够。',
    },
    tieBreaker,
    resultStage: resultStage(top?.reasoningDepthPercent ?? 0),
    argumentProfile: await buildArgumentProfile(model, userByPolicy),
    decisiveSimilarities: top ? explainMatches(model, userByPolicy, profileById[top.profileId]) : [],
    differencesFromNearest: top ? explainDifferences(model, userByPolicy, profileById[top.profileId]) : [],
    referenceSourceNote: top ? {
      label: top.sourceQuality.band,
      note: top.sourceQuality.note,
      anchor: top.anchor,
      showByDefault: false,
    } : null,
    comparisonWithSecond: second ? {
      profileId: second.profileId,
      label: second.label,
      labelZh: second.labelZh,
      similarityPercent: second.similarityPercent,
      differences: explainDifferences(model, userByPolicy, profileById[second.profileId]),
    } : null,
    presentation: top?.presentation || null,
    displayCaveat: '这里比较的是你目前的政策答案、可接受修改和理由，与参考库中哪些整理结果比较接近。它不是政治身份概率，也不能概括你的全部价值观。',
    ranked,
  };
  const resultValidation = validateEntertainmentResult(
    model,
    benchmark,
    policyResults,
    result,
  );
  if (!resultValidation.ok) {
    throw new Error(`娱乐结果未通过形式校验：${resultValidation.errors[0]}`);
  }
  return result;
};

export const buildRootOnlyResults = (benchmarkProfile, policyIds) => Object.fromEntries(policyIds.map((policyId) => [
  policyId,
  { policyId, rootAnswer: benchmarkProfile.expectedPaths[policyId].rootAnswer },
]));
