import {
  adaptiveAssessment,
  argumentsById,
  claims,
  getPolicyElements,
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

const valueFamily = (claimId) => claims[claimId]?.valueFamilyId || claimId || null;
const relationFamily = (response) => {
  if (response?.startsWith('left_')) return 'left';
  if (response?.startsWith('right_')) return 'right';
  return response || null;
};

const activeChains = (record) => (record?.chains || []).filter((chain) => (
  chain.matchingStatus === 'active'
  || (!chain.matchingStatus && ['complete', 'conditional'].includes(chain.status) && chain.defeaterReview)
));

const normalizeElementResponse = (response) => ({
  required: 'support',
  preferred: 'conditional',
  not_required: 'oppose',
  accept: 'support',
  adjust: 'conditional',
  reject: 'oppose',
  uncertain: null,
  undecided: null,
}[response] ?? response);

const userFeatures = (state) => {
  const policiesById = {};
  Object.entries(state.records || {}).forEach(([policyId, record]) => {
    const chains = activeChains(record);
    if (!chains.length) return;
    const policy = policies.find((item) => item.id === policyId);
    if (!policy || policy.origin === 'community' || policy.origin === 'session_overlay') return;
    const components = {};
    getPolicyElements(policy, ['policy_choice', 'safeguard', 'parameter']).forEach((element) => {
      const field = element.kind === 'policy_choice'
        ? 'policyChoiceResponses'
        : element.kind === 'safeguard' ? 'safeguardResponses' : 'parameterResponses';
      const response = normalizeElementResponse(record[field]?.[element.id]);
      if (response) components[element.id] = response;
    });
    policiesById[policyId] = {
      stance: record.packageStanceAfterDefeater || record.stance || chains.at(-1)?.direction || null,
      components,
      reasons: [...new Set(chains.map((chain) => {
        const firstArgument = argumentsById[chain.steps?.[0]?.argumentId];
        return firstArgument?.reasonFamilyId || firstArgument?.bridgeClaimId || null;
      }).filter(Boolean))],
      fixedPoints: [...new Set(chains.map((chain) => valueFamily(chain.terminal?.claimId)).filter(Boolean))],
      stress: [...new Set(chains.map((chain) => chain.stress?.response).filter(Boolean))],
    };
  });
  return { policies: policiesById, dilemmas: state.dilemmaResponses || {} };
};

export const profilePositionForPolicy = (profile, variant, policy, { allowHeuristic = false } = {}) => {
  const exact = variant.policyPositions?.[policy.id];
  if (exact) return typeof exact === 'string'
    ? { stance: exact, basis: 'reconstruction', confidence: 'low', sourceLocation: null, rationale: '旧版基准项，尚待补充审计元数据。' }
    : exact;
  if (!allowHeuristic) return null;
  const tags = new Set(profile.tags || []);
  const signals = policy.selection?.prototypeSignals || {};
  const support = (signals.supportTags || []).filter((tag) => tags.has(tag)).length;
  const oppose = (signals.opposeTags || []).filter((tag) => tags.has(tag)).length;
  return {
    stance: support === oppose ? 'conditional' : support > oppose ? 'support' : 'oppose',
    basis: 'tag_heuristic',
    confidence: 'low',
    sourceLocation: null,
    rationale: '只用于选择下一道区分题，不进入最终相似度或覆盖度。',
  };
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

const bestComparable = (values, expected, compare = exactSimilarity) => {
  const scores = values.map((value) => compare(value, expected)).filter((score) => score !== null);
  return scores.length ? Math.max(...scores) : null;
};

const scoreVariant = (state, profile, variant) => {
  const features = userFeatures(state);
  const evidence = Object.fromEntries(['stance', 'components', 'reason', 'fixedPoint', 'stress', 'dilemmas'].map((key) => [key, {
    earned: 0,
    compared: 0,
    possible: 0,
  }]));
  const add = (category, score, possible = true) => {
    if (possible) evidence[category].possible += 1;
    if (score === null) return;
    evidence[category].earned += score;
    evidence[category].compared += 1;
  };

  Object.entries(features.policies).forEach(([policyId, user]) => {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;
    const benchmarkPosition = profilePositionForPolicy(profile, variant, policy);
    add('stance', stanceSimilarity(user.stance, benchmarkPosition?.stance));
    Object.entries(user.components).forEach(([componentId, response]) => {
      add('components', stanceSimilarity(response, variant.componentPositions?.[componentId]));
    });
    add('reason', bestComparable(user.reasons, variant.primaryReasons?.[policyId], reasonSimilarity));
    add('fixedPoint', bestComparable(user.fixedPoints, valueFamily(variant.fixedPoints?.[policyId])));
    add('stress', bestComparable(user.stress, variant.stressBoundaries?.[policyId], (left, right) => {
      if (!left || !right) return null;
      if (left === right) return 1;
      const qualified = new Set(['qualified', 'qualified_exception', 'unexplained_exception']);
      return qualified.has(left) && qualified.has(right) ? 0.5 : 0;
    }));
  });
  if ((adaptiveAssessment.matchingWeights?.dilemmaRelation ?? defaultWeights.dilemmaRelation) > 0) {
    Object.entries(features.dilemmas).forEach(([dilemmaId, response]) => {
      add('dilemmas', exactSimilarity(
        relationFamily(response?.response),
        relationFamily(variant.dilemmas?.[dilemmaId]),
      ));
    });
  }

  const scores = Object.fromEntries(Object.entries(evidence).map(([category, item]) => [
    category,
    item.compared ? item.earned / item.compared : null,
  ]));
  const weights = { ...defaultWeights, ...(adaptiveAssessment.matchingWeights || {}) };
  let earned = 0;
  let compared = 0;
  let covered = 0;
  let available = 0;
  Object.entries(scores).forEach(([category, score]) => {
    const weight = weights[WEIGHT_KEYS[category]];
    if (!weight) return;
    available += weight;
    const categoryCoverage = evidence[category].possible
      ? evidence[category].compared / evidence[category].possible
      : 0;
    covered += weight * categoryCoverage;
    if (score !== null) {
      earned += score * weight * categoryCoverage;
      compared += weight * categoryCoverage;
    }
  });
  const coreTotal = policies.filter((policy) => policy.selection?.tier === 'core').length;
  const targetPolicyCount = coreTotal + (adaptiveAssessment.adaptiveMin || 2);
  const breadth = Math.min(1, Object.keys(features.policies).length / targetPolicyCount);
  return {
    similarity: compared ? Math.round((earned / compared) * 100) : 0,
    coverage: available ? Math.round((covered / available) * breadth * 100) : 0,
    breakdown: scores,
    evidence,
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
  const presentation = coverage < 35 ? 'insufficient' : coverage >= 65 && gap >= 8 ? 'unique' : 'family';
  return { matches, gap, coverage, stability, presentation };
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
      const split = topProfiles.map(({ profile, variant }) => (
        profilePositionForPolicy(profile, variant || {}, policy, { allowHeuristic: true })?.stance
      ));
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
  const chains = Object.values(state.records || {}).flatMap(activeChains);
  const terminalId = mostCommon(chains.map((chain) => chain.terminal?.claimId));
  const reasonId = mostCommon(chains.map((chain) => argumentsById[chain.steps?.[0]?.argumentId]?.reasonFamilyId));
  const domain = mostCommon(chains.map((chain) => policies.find((policy) => policy.id === chain.policyId)?.selection?.domain));
  const qualified = chains.filter((chain) => ['qualified_exception', 'unexplained_exception'].includes(chain.stress?.response)).length;
  const scope = qualified ? '条件修订型' : chains.length && chains.every((chain) => chain.stress?.response === 'apply') ? '普遍检验型' : '开放边界型';
  const canonical = JSON.stringify({
    chains: chains.sort((left, right) => left.id.localeCompare(right.id)).map((chain) => ({
      policyId: chain.policyId,
      direction: chain.direction,
      reasons: chain.steps.map((step) => argumentsById[step.argumentId]?.reasonFamilyId || step.bridgeClaimId),
      fixedPoint: chain.terminal?.claimId || null,
      stress: chain.stress?.response || null,
      defeater: chain.defeaterReview?.effect || null,
    })),
    dilemmas: Object.entries(state.dilemmaResponses || {}).sort().map(([id, response]) => [id, response.response]),
  });
  const valueLabel = claims[terminalId]?.shortLabel || '多重价值';
  const reasonLabel = claims[reasonId]?.shortLabel || '多路径论证';
  return {
    label: `${valueLabel}·${reasonLabel}·${domain || '跨领域'}·${scope}`,
    code: `ARG-${stableHash(canonical)}`,
  };
};
