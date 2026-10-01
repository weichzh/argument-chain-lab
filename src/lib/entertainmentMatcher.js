import { validatePolicyResults } from './formalValidator.js';

export const MATCHER_VERSION = 'entertainment-matcher-4.0';

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
  const retired = new Set(model.product.retiredReasonIds || []);
  const supportedMainPath = mainPath?.status === 'retracted'
    || mainPath?.steps?.some(step => retired.has(step.reasonId)) ? null : mainPath;
  const mainReasonIds = supportedMainPath?.steps?.map((step) => step.reasonId) || [];
  const terminalValueId = ['accepted', 'qualified'].includes(supportedMainPath?.status)
    ? supportedMainPath?.stress?.claimId || supportedMainPath?.steps?.at(-1)?.bridgeClaimId || null
    : null;
  const supportedCounterPath = result.counterPath?.status === 'retracted'
    || result.counterPath?.steps?.some(step => retired.has(step.reasonId)) ? null : result.counterPath;
  const counterReasonIds = supportedCounterPath?.steps?.map((step) => step.reasonId) || [];
  const counterTerminalValueId = ['accepted', 'qualified'].includes(supportedCounterPath?.status)
    ? supportedCounterPath?.stress?.claimId || supportedCounterPath?.steps?.at(-1)?.bridgeClaimId || null
    : null;
  const features = {
    policyId: result.policyId,
    rootAnswer: result.rootAnswer ?? null,
    finalRootAnswer: result.finalRootAnswer ?? result.rootAnswer ?? null,
    revisionKnown: result.rootAnswer === 'no' && Boolean(result.diagnosisClaimId)
      && !(result.sourceModelVersion && result.sourceModelVersion !== model.meta.version
        && (model.product.revisedFramePolicyIds || []).includes(result.policyId)),
    acceptedRevisionFrameId: result.acceptedRevisionFrameId ?? null,
    diagnosisClaimId: result.diagnosisClaimId ?? null,
    primaryReasonId: mainReasonIds[0] ?? null,
    reasonIds: mainReasonIds,
    reasonFamilies: reasonFamilies(model, mainReasonIds),
    terminalValueId,
    stressResponse: mainPath?.steps?.some(step => retired.has(step.reasonId)) ? null : comparableStressResponse(model, result, mainPath),
    counterClaimId: result.counterClaimId ?? null,
    counterReasonIds,
    counterFamilies: reasonFamilies(model, counterReasonIds),
    counterTerminalValueId,
    counterImpact: result.counterImpact ?? null,
  };
  if (result.sourceModelVersion && result.sourceModelVersion !== model.meta.version
    && (model.product.revisedFramePolicyIds || []).includes(result.policyId)) {
    return { ...features, revisionKnown: false, acceptedRevisionFrameId: null,
      diagnosisClaimId: null, primaryReasonId: null, reasonIds: [], reasonFamilies: [],
      terminalValueId: null, stressResponse: null, counterClaimId: null,
      counterReasonIds: [], counterFamilies: [], counterTerminalValueId: null, counterImpact: null };
  }
  return features;
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
  if (left == null || right == null || left === 'uncertain' || right === 'uncertain') return null;
  if (left === right) return 1;
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
  if (left == null || right == null || left === 'uncertain' || right === 'uncertain') return null;
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
  let userFeatureWeight = 0;
  let answeredPolicyWeight = 0;
  const policyDetails = {};
  for (const [policyId, user] of Object.entries(userByPolicy)) {
    if (!user.rootAnswer) continue;
    const policyWeight = policyWeights[policyId] ?? 1;
    answeredPolicyWeight += policyWeight;
    userFeatureWeight += policyWeight * policySimilarity(user, user, weights).coverage;
    const profile = profileByPolicy[policyId];
    if (!profile) continue;
    const result = policySimilarity(user, profile, weights);
    const coveredWeight = policyWeight * result.coverage;
    availableFeatureWeight += coveredWeight;
    if (result.score != null) obtained += coveredWeight * result.score;
    policyDetails[policyId] = result;
  }
  return {
    similarity: availableFeatureWeight ? obtained / availableFeatureWeight : 0,
    // Missing reference data is not disagreement. It does reduce how much
    // agreement has actually been demonstrated against a common user denominator.
    supportedAgreement: userFeatureWeight ? obtained / userFeatureWeight : 0,
    comparisonCoverage: userFeatureWeight ? availableFeatureWeight / userFeatureWeight : 0,
    reasoningDepth: answeredPolicyWeight ? availableFeatureWeight / answeredPolicyWeight : 0,
    answeredPolicyWeight,
    policyDetails,
  };
};

export const recordCompleteness = (model, policyResults, expectedPolicyIds = model.product.defaultPolicyIds) => {
  const records = Object.values(policyResults || {}).filter(result => ROOT_ANSWERS.has(result.rootAnswer)
    && (!expectedPolicyIds?.length || expectedPolicyIds.includes(result.policyId)));
  let sum = 0;
  let selectedReasons = 0;
  let checkedReasons = 0;
  let checkedCases = 0;
  let counterReasons = 0;
  for (const result of records) {
    const main = result.mainPaths?.[0];
    const steps = main?.steps || [];
    const canonical = result.canonicalReasonPath || [];
    const selected = Boolean(steps.length || canonical.length || main?.selectedReasonId || main?.customReason);
    const checked = Boolean(steps.length || canonical.length);
    const cases = Boolean(main?.stress || result.stressResponse);
    const counter = Boolean(result.counterPath?.steps?.length || result.canonicalCounterReasonPath?.length
      || result.counterPath?.selectedReasonId || result.counterPath?.customReason);
    selectedReasons += Number(selected || result.rejectedReasonAttempts?.some(attempt => attempt.chainMode === 'main'));
    checkedReasons += Number(checked);
    checkedCases += Number(cases);
    counterReasons += Number(counter || result.rejectedReasonAttempts?.some(attempt => attempt.chainMode === 'counter'));
    const present = {
      rootAnswer: true,
      acceptedRevision: result.rootAnswer === 'no' && Boolean(result.diagnosisClaimId || result.revisionBasis),
      diagnosis: Boolean(result.diagnosisClaimId),
      primaryReason: selected,
      reasonFamilies: checked,
      terminalValue: Boolean(result.terminalValueId || (['accepted', 'qualified'].includes(main?.status) && steps.length)),
      stressResponse: cases,
      counterFamilies: counter,
      counterImpact: result.counterImpact != null,
    };
    sum += Object.entries(DEFAULT_FEATURE_WEIGHTS).reduce((total, [key, weight]) => total + (present[key] ? weight : 0), 0);
  }
  return {
    percent: records.length ? Math.round(sum / records.length * 10000) / 100 : 0,
    policyCount: records.length,
    selectedReasons, checkedReasons, checkedCases, counterReasons,
    uncertainPolicies: records.filter(result => result.rootAnswer === 'uncertain').length,
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
    || item.supportedAgreement >= ranked[0].supportedAgreement - (options.candidateWindow || 8) / 100
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
    label: `本轮 ${Object.keys(userByPolicy).length} 项判断的记录`,
    fingerprint: await fingerprint(JSON.stringify(fingerprintInput)),
    topValues: values,
    institutionalStyle: institution,
    boundaryStyle: boundary,
    caveat: '指纹用于核对可比较的已确认结构，不包含全部自由文本；不是身份、人格类型或科学分类。',
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
    if (user.rootAnswer === 'uncertain' || user.rootAnswer !== reference.rootAnswer) continue;
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
    if (user.counterImpact && user.counterImpact !== 'uncertain' && user.counterImpact === reference.counterImpact) {
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
  if (!user || !profile || user.rootAnswer === 'uncertain' || user.rootAnswer !== profile.rootAnswer) return false;
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
    return Boolean(user.counterImpact) && user.counterImpact !== 'uncertain'
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
      || (index && item.supportedAgreement > result.ranked[index - 1].supportedAgreement)) {
      errors.push(`ranked/${item.profileId}: 排名或覆盖率数值不自洽。`);
    }
  }
  const top = result.ranked[0] || null;
  const second = result.ranked[1] || null;
  const expectedMargin = top && second
    ? Math.round((top.supportedAgreement - second.supportedAgreement) * 10000) / 100
    : 0;
  if (result.closestReference?.profileId !== top?.profileId
    || result.reasoningDepthPercent !== recordCompleteness(model, policyResults, []).percent
    || JSON.stringify(result.recordCompleteness) !== JSON.stringify(recordCompleteness(model, policyResults, []))
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
    if (JSON.stringify(candidate.evidenceRows) !== JSON.stringify(referenceEvidenceRows(model, policyResults, profiles[candidate.profileId]))) {
      errors.push(`candidate/${candidate.profileId}: 字段对照与实际记录不一致。`);
    }
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
  if (Object.values(weights).some(weight => !Number.isFinite(weight) || weight < 0)
    || !Object.values(weights).some(weight => weight > 0)
    || Object.values(options.policyWeights || {}).some(weight => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('比较权重必须是有限的非负数，政策权重必须大于零。');
  }
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

  // Optional questions are still user records. Only core policy coverage uses
  // expectedPolicyIds; completing an extra question must not disappear here.
  const completeness = recordCompleteness(model, policyResults, []);
  const eligibleProfiles = benchmark.profiles.filter(profile => options.includeNonProductionReferences === true
    || (['source_anchored', 'tradition_reconstruction'].includes(profile.source?.status)
      && profile.allowUniqueResult !== false && profile.referenceStatus !== 'provisional_reference_variant'));
  const ranked = eligibleProfiles.map((profile) => {
    const scored = weightedProfileScore(userByPolicy, profileFeatures(model, profile), weights, options.policyWeights);
    const evidenceCoverage = policyCoverage * scored.reasoningDepth;
    return {
      profileId: profile.id,
      label: profile.label,
      labelZh: profile.labelZh,
      similarity: scored.similarity,
      similarityPercent: Math.round(scored.similarity * 10000) / 100,
      supportedAgreement: scored.supportedAgreement,
      comparisonCoveragePercent: Math.round(scored.comparisonCoverage * 10000) / 100,
      comparisonKind: Object.values(scored.policyDetails).some(item => Object.entries(item.featureScores)
        .some(([key, value]) => !['rootAnswer', 'diagnosis', 'acceptedRevision'].includes(key) && value != null))
        ? 'reason_paths' : 'policy_answers',
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
  }).sort((a, b) => b.supportedAgreement - a.supportedAgreement
    || b.evidenceCoverage - a.evidenceCoverage
    || a.label.localeCompare(b.label));
  ranked.forEach((item, index) => { item.rank = index + 1; });
  const top = ranked[0];
  const second = ranked[1];
  const margin = top && second ? (top.supportedAgreement - second.supportedAgreement) * 100 : 0;
  const candidateWindow = options.candidateDisplayWindow ?? 3;
  const candidateGroup = top && top.supportedAgreement > 0 && top.comparisonCoveragePercent >= 40
    ? ranked.filter((item) => item.supportedAgreement * 100 >= top.supportedAgreement * 100 - candidateWindow
      && item.comparisonCoveragePercent >= 40)
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
    similarities: explainMatches(model, userByPolicy, profileById[candidate.profileId], 3),
    evidenceRows: referenceEvidenceRows(model, policyResults, profileById[candidate.profileId]),
  } : null;
  const closestReference = decorateCandidate(top);
  const nearestPrototype = uniquenessBlocked ? null : closestReference;
  const alternatives = ranked
    .slice(1, options.alternativeCount ? options.alternativeCount + 1 : 5)
    .map(decorateCandidate);
  const displayedCandidates = candidateGroup.map(decorateCandidate);
  const tieBreaker = recommendTieBreaker(model, benchmark, ranked, answeredPolicyIds, options);
  const displayStrategy = !top || !candidateGroup.length || policyCoverage < 0.4
    ? {
        id: 'argument_profile_only',
        note: '当前可比较的明确记录不足。你已保存的回答仍然有效；不确定或参考资料缺失不会被当作相同立场。',
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
    policyCoveragePercent: Math.round(policyCoverage * 10000) / 100,
    reasoningDepthPercent: completeness.percent,
    recordCompleteness: completeness,
    evidenceCoveragePercent: top?.evidenceCoveragePercent ?? 0,
    comparisonCoveragePercent: top?.comparisonCoveragePercent ?? 0,
    eligibleReferenceCount: eligibleProfiles.length,
    excludedReferenceCount: benchmark.profiles.length - eligibleProfiles.length,
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
      exploratory: '双方可比较的信息暂时不足，可能来自尚未回答、未确定或参考资料缺失；不据此评价你的思考。',
    }[confidence],
    coverageExplanation: {
      policyCoverage: '在建议回答的政策中，你已经完成了多少道。',
      reasoningDepth: '已记录字段的加权完整度，只由你的记录计算；不是思想深度、能力分数或立场强度。',
      evidenceCoverage: '与某个参考双方都具备的可比信息；参考资料不足不代表你的回答不足。',
    },
    tieBreaker,
    resultStage: {
      id: completeness.checkedReasons ? 'main_reasons_known' : 'policy_answers_only',
      label: `已选择 ${completeness.selectedReasons} 条主要理由，核对了 ${completeness.checkedCases} 个相似案例`,
      note: '这些数量描述记录状态，不评价思考质量。未完成的部分仍可继续。',
    },
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

// This presentation compares exact recorded fields. It does not change scoring.
export const referenceEvidenceRows = (model, policyResults, profile) => {
  const labels = { yes: '接受原方案', no: '不接受原方案', uncertain: '不确定', skipped: '已跳过' };
  const impacts = { no_change: '不改变判断', weaken: '有所犹豫', offset: '暂时抵消', reverse: '改变判断', uncertain: '影响不确定' };
  const pathText = (record, path, ids) => {
    const text = ids?.length ? ids.map(id => model.reasons[id]?.title || id).join(' → ')
      : path?.customReason?.text || path?.customReason?.argument?.title
        || model.reasons[path?.selectedReasonId]?.title || '尚无已核对的理由';
    return path?.status === 'retracted' ? `已撤回：${text}`
      : path?.customReason ? `自填、未校验：${text}` : path?.selectedReasonId ? `尚未检验：${text}` : text;
  };
  const cell = (key, label, userText, referenceText, a, b, note = '', comparable = true, overlap = false) => ({
    key, label, userText, referenceText,
    status: !comparable ? 'incomparable' : a == null || b == null ? 'missing' : a === b ? 'same' : overlap ? 'overlap' : 'different',
    note,
  });
  const normalized = normalizeUserResults(model, policyResults);
  return model.policies.filter(policy => Object.hasOwn(policyResults || {}, policy.id)).map(policy => {
    const record = policyResults[policy.id];
    const expected = profile?.expectedPaths?.[policy.id];
    const user = normalized[policy.id] || enginePathFeatures(model, record);
    const reference = expected ? benchmarkPathFeatures(model, expected) : {};
    const main = record.mainPaths?.[0];
    const historicalChange = record.sourceModelVersion && record.sourceModelVersion !== model.meta.version
      && (model.product.revisedFramePolicyIds || []).includes(policy.id);
    const retired = (model.product.retiredReasonIds || []).some(id => (main?.steps || []).some(step => step.reasonId === id));
    const sameTarget = Boolean(user.diagnosisClaimId && user.diagnosisClaimId === reference.diagnosisClaimId);
    const reasonComparable = !historicalChange && !retired && main?.status !== 'retracted'
      && (!user.diagnosisClaimId || !reference.diagnosisClaimId || sameTarget);
    const original = cell('original', '初始判断', labels[record.rootAnswer] || '未记录', labels[reference.rootAnswer] || '参考未记录',
      ['yes', 'no'].includes(user.rootAnswer) ? user.rootAnswer : null,
      ['yes', 'no'].includes(reference.rootAnswer) ? reference.rootAnswer : null,
      '这里只比较初始判断。复核后的变化另见“反方影响”；不确定不作为相同立场的证据。');
    const revisionText = value => value.rootAnswer !== 'no' ? '未进入反对后的修改比较'
      : !value.revisionKnown ? '修改边界未确认' : value.acceptedRevisionFrameId
        ? policy.frames[value.acceptedRevisionFrameId]?.label || value.acceptedRevisionFrameId : '未接受已比较的修改';
    const revision = cell('revision', '修改边界', historicalChange ? '旧版方案，保留原定义' : revisionText(user), revisionText(reference),
      user.revisionKnown ? user.acceptedRevisionFrameId || 'none' : null,
      reference.revisionKnown ? reference.acceptedRevisionFrameId || 'none' : null,
      historicalChange ? '旧版专家权限与现版不同，不能直接比较。'
        : '只有双方都明确反对原方案且确认了修改边界时，才比较接受的完整修改方案。',
      !historicalChange && (!expected || (user.rootAnswer === 'no' && reference.rootAnswer === 'no')));
    const mainReason = cell('reason', '主要理由', pathText(record, main, (record.canonicalReasonPath || main?.steps?.map(step => step.reasonId))?.slice(0, 1)),
      expected ? pathText(expected, null, expected.canonicalReasonPath?.slice(0, 1)) : '参考未记录',
      user.primaryReasonId, reference.primaryReasonId,
      !reasonComparable ? '说明的判断对象不同，或记录已撤回/属于旧版修订，不能当作同一理由比较。'
        : '这里只对照第一条已核对的主要理由；“主题交集”不表示同一理由。自填或未检验内容保留原文，不自动判断其语义。',
      reasonComparable, Boolean(user.reasonFamilies?.length && reference.reasonFamilies?.length && jaccard(user.reasonFamilies, reference.reasonFamilies) > 0));
    const principleComparable = reasonComparable && main?.status !== 'qualified' && expected?.stressResponse !== 'qualified';
    const principle = cell('principle', '停止点',
      user.terminalValueId ? model.claims[user.terminalValueId]?.text || user.terminalValueId : '尚无可比较的已确认停止点',
      reference.terminalValueId ? model.claims[reference.terminalValueId]?.text || reference.terminalValueId : '参考未记录停止点',
      user.terminalValueId, reference.terminalValueId,
      principleComparable ? '比较本轮愿意停下来的原则，不把它解释为不可质疑的最终价值。'
        : '适用范围有保留、判断对象不同或记录已撤回，不能据相同名称判为相同原则。', principleComparable);
    const counter = record.counterPath;
    const sameCounter = user.counterReasonIds?.length && reference.counterReasonIds?.length
      && user.counterClaimId === reference.counterClaimId
      && user.counterReasonIds.join('|') === reference.counterReasonIds.join('|');
    const effect = cell('counter', '反方影响',
      record.counterImpact === 'no_change' && !counter ? '未选择相反理由，未记录改判'
        : record.counterImpact ? impacts[record.counterImpact] || '未记录' : '尚未检查',
      reference.counterImpact ? impacts[reference.counterImpact] || '未记录' : '参考未记录',
      counter && record.counterImpact !== 'uncertain' ? record.counterImpact : null,
      reference.counterImpact !== 'uncertain' ? reference.counterImpact : null,
      '只有针对同一判断、核对同一路径后的影响才直接比较。没有选择相反理由，不表示已经检查过它。',
      !historicalChange && counter?.status !== 'retracted' && (!counter || !reference.counterReasonIds?.length || Boolean(sameCounter)));
    return { policyId: policy.id, title: policy.shortTitle, cells: [original, revision, mainReason, principle, effect] };
  });
};

export const buildRootOnlyResults = (benchmarkProfile, policyIds) => Object.fromEntries(policyIds.map((policyId) => [
  policyId,
  { policyId, rootAnswer: benchmarkProfile.expectedPaths[policyId].rootAnswer },
]));
