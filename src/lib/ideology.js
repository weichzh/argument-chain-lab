import {
  adaptiveAssessment,
  argumentsById,
  claims,
  ideologyBenchmarks,
  policies,
} from '../data/model.js';

const WEIGHT_KEYS = {
  stance: 'policyStance',
  components: 'componentPosition',
  reason: 'reasonFamily',
  fixedPoint: 'fixedPoint',
  stress: 'stressBoundary',
  dilemmas: 'dilemmaRelation',
};

const defaultWeights = {
  policyStance: 10,
  componentPosition: 15,
  reasonFamily: 30,
  fixedPoint: 25,
  stressBoundary: 10,
  dilemmaRelation: 10,
};

const latestChain = (record) => record?.chains?.at(-1) || null;
const valueFamily = (claimId) => claims[claimId]?.valueFamilyId || claimId || null;
const relationFamily = (response) => {
  if (response?.startsWith('left_')) return 'left';
  if (response?.startsWith('right_')) return 'right';
  return response || null;
};

const userFeatures = (state) => {
  const policiesById = {};
  Object.entries(state.records || {}).forEach(([policyId, record]) => {
    const chain = latestChain(record);
    if (!chain) return;
    const firstArgument = argumentsById[chain?.steps?.[0]?.argumentId];
    policiesById[policyId] = {
      stance: record.stance || record.direction || chain?.direction || null,
      components: record.componentPositions || {},
      reason: firstArgument?.reasonFamilyId || firstArgument?.bridgeClaimId || null,
      fixedPoint: valueFamily(chain?.terminal?.claimId),
      stress: chain?.stress?.response || null,
    };
  });
  return { policies: policiesById, dilemmas: state.dilemmaResponses || {} };
};

export const profilePositionForPolicy = (profile, variant, policy) => {
  const exact = variant.policyPositions?.[policy.id];
  if (exact) return exact;
  const tags = new Set(profile.tags || []);
  const signals = policy.selection?.prototypeSignals || {};
  const support = (signals.supportTags || []).filter((tag) => tags.has(tag)).length;
  const oppose = (signals.opposeTags || []).filter((tag) => tags.has(tag)).length;
  if (support === oppose) return 'conditional';
  return support > oppose ? 'support' : 'oppose';
};

const stanceSimilarity = (left, right) => {
  if (!left || !right) return null;
  if (left === right) return 1;
  if (['conditional', 'undecided'].includes(left) || ['conditional', 'undecided'].includes(right)) return 0.5;
  return 0;
};

const exactSimilarity = (left, right) => {
  if (!left || !right) return null;
  return left === right ? 1 : 0;
};

const reasonSimilarity = (left, right) => {
  if (!left || !right) return null;
  if (left === right) return 1;
  return valueFamily(left) === valueFamily(right) ? 0.65 : 0;
};

const averageComparable = (pairs, compare = exactSimilarity) => {
  const scores = pairs.map(([left, right]) => compare(left, right)).filter((value) => value !== null);
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
};

const scoreVariant = (state, profile, variant) => {
  const features = userFeatures(state);
  const categoryScores = { stance: [], components: [], reason: [], fixedPoint: [], stress: [], dilemmas: [] };

  Object.entries(features.policies).forEach(([policyId, user]) => {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;
    categoryScores.stance.push([user.stance, profilePositionForPolicy(profile, variant, policy)]);
    Object.entries(user.components).forEach(([componentId, response]) => {
      categoryScores.components.push([response, variant.componentPositions?.[componentId]]);
    });
    categoryScores.reason.push([user.reason, variant.primaryReasons?.[policyId]]);
    categoryScores.fixedPoint.push([user.fixedPoint, valueFamily(variant.fixedPoints?.[policyId])]);
    categoryScores.stress.push([user.stress, variant.stressBoundaries?.[policyId]]);
  });
  Object.entries(features.dilemmas).forEach(([dilemmaId, response]) => {
    categoryScores.dilemmas.push([
      relationFamily(response?.response),
      relationFamily(variant.dilemmas?.[dilemmaId]),
    ]);
  });

  const scores = {
    stance: averageComparable(categoryScores.stance, stanceSimilarity),
    components: averageComparable(categoryScores.components, stanceSimilarity),
    reason: averageComparable(categoryScores.reason, reasonSimilarity),
    fixedPoint: averageComparable(categoryScores.fixedPoint),
    stress: averageComparable(categoryScores.stress, (left, right) => {
      if (!left || !right) return null;
      if (left === right) return 1;
      const qualified = new Set(['qualified', 'qualified_exception', 'unexplained_exception']);
      return qualified.has(left) && qualified.has(right) ? 0.5 : 0;
    }),
    dilemmas: averageComparable(categoryScores.dilemmas),
  };
  const weights = { ...defaultWeights, ...(adaptiveAssessment.matchingWeights || {}) };
  let earned = 0;
  let compared = 0;
  Object.entries(scores).forEach(([category, score]) => {
    if (score === null) return;
    const weight = weights[WEIGHT_KEYS[category]];
    earned += score * weight;
    compared += weight;
  });
  const coreTotal = policies.filter((policy) => policy.selection?.tier === 'core').length;
  const targetPolicyCount = coreTotal + (adaptiveAssessment.adaptiveMin || 2);
  const breadth = Math.min(1, Object.keys(features.policies).length / targetPolicyCount);
  return {
    similarity: compared ? Math.round((earned / compared) * 100) : 0,
    coverage: Math.round(compared * breadth),
    breakdown: scores,
  };
};

export const matchIdeologyProfiles = (state) => {
  const profiles = ideologyBenchmarks.profiles || [];
  const matches = profiles.map((profile) => {
    const variants = (profile.variants || []).map((variant) => ({
      variant,
      ...scoreVariant(state, profile, variant),
    })).sort((left, right) => right.similarity - left.similarity || right.coverage - left.coverage);
    return { profile, ...(variants[0] || { similarity: 0, coverage: 0, breakdown: {}, variant: null }) };
  }).sort((left, right) => right.similarity - left.similarity || right.coverage - left.coverage || left.profile.id.localeCompare(right.profile.id));

  const gap = Math.max(0, (matches[0]?.similarity || 0) - (matches[1]?.similarity || 0));
  const coverage = matches[0]?.coverage || 0;
  const stability = coverage < 35 ? '低' : gap >= 12 && coverage >= 65 ? '高' : gap >= 6 ? '中高' : gap >= 3 ? '中' : '低';
  return { matches, gap, coverage, stability };
};

const entropy = (values) => {
  if (!values.length) return 0;
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.values()].reduce((sum, count) => {
    const probability = count / values.length;
    return sum - probability * Math.log2(probability);
  }, 0);
};

const finishedPolicyIds = (state) => new Set(Object.entries(state.records || {})
  .filter(([, record]) => record.chains?.length)
  .map(([policyId]) => policyId));

export const adaptiveProgress = (state) => {
  const finished = finishedPolicyIds(state);
  const core = policies.filter((policy) => policy.selection?.tier === 'core');
  const adaptive = policies.filter((policy) => policy.selection?.tier === 'adaptive');
  return {
    finished,
    coreDone: core.filter((policy) => finished.has(policy.id)).length,
    coreTotal: core.length,
    adaptiveDone: adaptive.filter((policy) => finished.has(policy.id)).length,
    adaptiveMin: adaptiveAssessment.adaptiveMin || 2,
    adaptiveMax: adaptiveAssessment.adaptiveMax || 4,
  };
};

export const selectNextAdaptivePolicy = (state) => {
  const progress = adaptiveProgress(state);
  const core = policies
    .filter((policy) => policy.selection?.tier === 'core' && !progress.finished.has(policy.id))
    .sort((left, right) => left.selection.priority - right.selection.priority);
  if (core.length) return core[0];
  if (progress.adaptiveDone >= progress.adaptiveMax) return null;

  const matching = matchIdeologyProfiles(state);
  if (progress.adaptiveDone >= progress.adaptiveMin && matching.gap >= 12 && matching.coverage >= 65) return null;
  const candidates = policies.filter((policy) => policy.selection?.tier === 'adaptive' && !progress.finished.has(policy.id));
  const topProfiles = matching.matches.slice(0, 12);
  const answeredDomains = new Set([...progress.finished].map((id) => policies.find((policy) => policy.id === id)?.selection?.domain));
  return candidates.sort((left, right) => {
    const score = (policy) => {
      const split = topProfiles.map(({ profile, variant }) => profilePositionForPolicy(profile, variant || {}, policy));
      const domainBonus = answeredDomains.has(policy.selection.domain) ? 0 : 0.2;
      return entropy(split) + domainBonus - (policy.selection.priority || 0) / 1000;
    };
    return score(right) - score(left) || left.selection.priority - right.selection.priority;
  })[0] || null;
};

const stableHash = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

const mostCommon = (values) => {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || null;
};

export const buildArgumentType = (state, matching = matchIdeologyProfiles(state)) => {
  const chains = Object.values(state.records || {}).flatMap((record) => record.chains || []);
  const terminalId = mostCommon(chains.map((chain) => chain.terminal?.claimId));
  const reasonId = mostCommon(chains.map((chain) => argumentsById[chain.steps?.[0]?.argumentId]?.reasonFamilyId));
  const qualified = chains.filter((chain) => ['qualified_exception', 'unexplained_exception'].includes(chain.stress?.response)).length;
  const scope = qualified ? '条件修订型' : chains.length && chains.every((chain) => chain.stress?.response === 'apply') ? '普遍检验型' : '开放边界型';
  const profile = matching.matches[0]?.profile;
  const canonical = JSON.stringify({
    records: Object.entries(state.records || {}).sort(([left], [right]) => left.localeCompare(right)).map(([policyId, record]) => ({
      policyId,
      stance: record.stance,
      components: Object.entries(record.componentPositions || {}).sort(),
      reason: argumentsById[latestChain(record)?.steps?.[0]?.argumentId]?.reasonFamilyId || null,
      fixedPoint: latestChain(record)?.terminal?.claimId || null,
      stress: latestChain(record)?.stress?.response || null,
    })),
    dilemmas: Object.entries(state.dilemmaResponses || {}).sort().map(([id, response]) => [id, response.response]),
  });
  const valueLabel = claims[terminalId]?.shortLabel || '多重价值';
  const reasonLabel = claims[reasonId]?.shortLabel || '多路径论证';
  return {
    label: `${profile?.displayName || '开放谱系'}·${valueLabel}·${reasonLabel}·${scope}`,
    code: `${profile?.id?.replace('prototype_', 'P') || 'PX'}-${stableHash(canonical).slice(0, 4)}`,
  };
};
