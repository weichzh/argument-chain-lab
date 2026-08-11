import {
  MODEL_META,
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getPolicyElements,
  policies,
  configureFormalModel,
} from '../src/data/model.js';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const { model } = await loadCurrentFormalModel();
configureFormalModel(model);

const failures = [];
const warnings = [];
const forbiddenNormativeTerms = [
  '应当', '应该', '应予', '有理由', '正当', '不正当', '公平', '不公平',
  '权利', '善', '恶', '值得', '合理', '不合理', '可接受', '不可接受', '优先',
];
const allowedFactKinds = new Set(['stipulated', 'empirical', 'descriptive']);
const allowedEvaluationModes = new Set(['scenario_assumption', 'empirical_claim_inside_scenario', 'descriptive_claim']);
const allowedClaimKinds = new Set(['policy', 'bridge', 'terminal']);
const sourceIdSet = new Set(model.sources.map((source) => source.id));

const ids = new Set();
const registerId = (id, category) => {
  if (!id || typeof id !== 'string') failures.push(`${category} has an invalid id.`);
  if (ids.has(id)) failures.push(`Duplicate global id ${id}.`);
  ids.add(id);
};

for (const id of Object.keys(facts)) registerId(id, 'Fact');
for (const id of Object.keys(claims)) registerId(id, 'Claim');
for (const id of Object.keys(argumentsById)) registerId(id, 'Argument');
for (const policy of policies) registerId(policy.id, 'Policy');
for (const dilemma of dilemmas) registerId(dilemma.id, 'Dilemma');

for (const [id, item] of Object.entries(facts)) {
  if (item.id !== id) failures.push(`Fact key ${id} does not match item.id ${item.id}.`);
  for (const field of ['statement', 'truthConditions', 'falsifier', 'plainExplanation', 'plainTruthConditions', 'plainFalsifier']) {
    if (!item[field] || typeof item[field] !== 'string') failures.push(`Fact ${id} is missing ${field}.`);
  }
  if (item.statement.length > 120) warnings.push(`Fact ${id} is longer than 120 Chinese characters and should be reviewed for readability.`);
  if (!allowedFactKinds.has(item.kind)) failures.push(`Fact ${id} has invalid kind ${item.kind}.`);
  if (!allowedEvaluationModes.has(item.evaluationMode)) failures.push(`Fact ${id} has invalid evaluationMode ${item.evaluationMode}.`);
  if (!item.scenarioProfile || typeof item.scenarioProfile !== 'string') failures.push(`Fact ${id} has no scenarioProfile.`);
  if (!Array.isArray(item.mutuallyExclusiveWith) || !Array.isArray(item.dependsOn) || !Array.isArray(item.sourceIds)) {
    failures.push(`Fact ${id} needs structured compatibility and source arrays.`);
  }
  for (const relatedId of [...(item.mutuallyExclusiveWith || []), ...(item.dependsOn || [])]) {
    if (!facts[relatedId]) failures.push(`Fact ${id} references unknown compatibility fact ${relatedId}.`);
  }
  for (const sourceId of item.sourceIds || []) if (!sourceIdSet.has(sourceId)) failures.push(`Fact ${id} references unknown source ${sourceId}.`);
  for (const otherId of item.mutuallyExclusiveWith || []) {
    if (!facts[otherId]?.mutuallyExclusiveWith?.includes(id)) failures.push(`Fact exclusivity ${id} -> ${otherId} is not symmetric.`);
  }
  if (item.sensitivity) {
    if (!item.sensitivity.label || !item.sensitivity.baseline || item.sensitivity.scenarios?.length !== 2) {
      failures.push(`Fact ${id} has an incomplete low/high sensitivity test.`);
    }
    if (new Set(item.sensitivity.scenarios?.map((scenario) => scenario.id)).size !== item.sensitivity.scenarios?.length) {
      failures.push(`Fact ${id} has duplicate sensitivity scenarios.`);
    }
  }
  const searchable = [item.statement, item.truthConditions, item.falsifier, item.note].filter(Boolean).join(' ');
  for (const term of forbiddenNormativeTerms) {
    if (searchable.includes(term)) failures.push(`Fact ${id} contains normative term “${term}”: ${item.statement}`);
  }
  if (item.statement?.includes('我认为') || item.statement?.includes('我相信')) {
    warnings.push(`Fact ${id} is phrased as a report of belief rather than the object-level proposition.`);
  }
}

for (const [id, claim] of Object.entries(claims)) {
  if (claim.id !== id) failures.push(`Claim key ${id} does not match claim.id ${claim.id}.`);
  if (!allowedClaimKinds.has(claim.kind)) failures.push(`Claim ${id} has invalid kind ${claim.kind}.`);
  if (!claim.text || typeof claim.text !== 'string') failures.push(`Claim ${id} has no text.`);
  if (!claim.explanation || typeof claim.explanation !== 'string') failures.push(`Claim ${id} has no plain-language explanation.`);
  if (claim.kind !== 'policy' && (!claim.example || typeof claim.example !== 'string')) failures.push(`Normative claim ${id} has no concrete example.`);
  if (claim.text?.length > 130) warnings.push(`Claim ${id} is longer than 130 Chinese characters and should be reviewed for readability.`);
  if (claim.kind === 'policy' && !claim.policyId) failures.push(`Policy claim ${id} has no policyId.`);
  if (claim.kind !== 'policy' && typeof claim.nominatable !== 'boolean') failures.push(`Normative claim ${id} has no nominatable flag.`);
  if (claim.kind !== 'policy' && !claim.valueFamilyId) failures.push(`Normative claim ${id} has no valueFamilyId.`);
  for (const sourceId of claim.sourceIds || []) if (!sourceIdSet.has(sourceId)) failures.push(`Claim ${id} references unknown source ${sourceId}.`);
}

for (const [id, argument] of Object.entries(argumentsById)) {
  if (argument.id !== id) failures.push(`Argument key ${id} does not match argument.id ${argument.id}.`);
  const target = claims[argument.targetClaimId];
  if (!target) failures.push(`Argument ${id} has unknown target ${argument.targetClaimId}.`);
  if (target?.kind === 'terminal') failures.push(`Argument ${id} targets terminal ${argument.targetClaimId}; terminal nodes must be stopping candidates.`);
  const bridge = claims[argument.bridgeClaimId];
  if (!bridge) failures.push(`Argument ${id} has unknown bridge ${argument.bridgeClaimId}.`);
  if (bridge && !['bridge', 'terminal'].includes(bridge.kind)) failures.push(`Argument ${id} uses non-normative bridge kind ${bridge.kind}.`);
  if (!Array.isArray(argument.factIds) || !argument.factIds.length) failures.push(`Argument ${id} has no descriptive premises.`);
  for (const factId of argument.factIds || []) if (!facts[factId]) failures.push(`Argument ${id} has unknown fact ${factId}.`);
  if (!argument.summary || typeof argument.summary !== 'string') failures.push(`Argument ${id} has no human-readable summary.`);
  if (!argument.plainSteps || !Array.isArray(argument.plainSteps.facts)) failures.push(`Argument ${id} has no readable step breakdown.`);
  if (!argument.reasonFamilyId || !claims[argument.reasonFamilyId]) failures.push(`Argument ${id} has no valid reasonFamilyId.`);
  for (const sourceId of argument.sourceIds || []) if (!sourceIdSet.has(sourceId)) failures.push(`Argument ${id} references unknown source ${sourceId}.`);
  if (argument.summary?.length > 110) warnings.push(`Argument ${id} summary is longer than 110 Chinese characters.`);
}

const policyIds = new Set(policies.map((policy) => policy.id));
for (const policy of policies) {
  for (const field of ['title', 'proposition', 'scope', 'question']) {
    if (!policy[field]) failures.push(`Policy ${policy.id} is missing ${field}.`);
  }
  for (const [direction, claimId] of [['support', policy.supportClaimId], ['oppose', policy.opposeClaimId]]) {
    const claim = claims[claimId];
    if (!claim) failures.push(`Policy ${policy.id} references unknown ${direction} claim ${claimId}.`);
    if (claim?.kind !== 'policy') failures.push(`Policy ${policy.id} ${direction} claim ${claimId} is not kind=policy.`);
    if (claim?.policyId !== policy.id) failures.push(`Policy claim ${claimId} points to ${claim?.policyId}, expected ${policy.id}.`);
    if (claim?.direction !== direction) failures.push(`Policy claim ${claimId} has direction ${claim?.direction}, expected ${direction}.`);
    const candidates = getArgumentsForClaim(claimId);
    if (candidates.length < 3) failures.push(`Policy claim ${claimId} needs at least 3 candidate arguments; found ${candidates.length}.`);
  }
  const elements = getPolicyElements(policy);
  const interactiveElements = getPolicyElements(policy, ['policy_choice', 'safeguard', 'parameter']);
  if (interactiveElements.length < 1) failures.push(`Policy ${policy.id} needs an independently reviewable policy element.`);
  if (new Set(elements.map((element) => element.id)).size !== elements.length) failures.push(`Policy ${policy.id} has duplicate policy element ids.`);
  for (const element of elements) {
    if (!['scenario_condition', 'policy_choice', 'safeguard', 'parameter'].includes(element.kind)) failures.push(`Policy element ${element.id} has invalid kind ${element.kind}.`);
    if (!element.label || !element.plainExplanation || !element.whyItMatters) failures.push(`Policy element ${element.id} is missing plain-language metadata.`);
  }
  if (!['core', 'adaptive'].includes(policy.selection?.tier) || !policy.selection?.domain || !Number.isFinite(policy.selection?.priority)) {
    failures.push(`Policy ${policy.id} needs adaptive selection metadata.`);
  }
  if (!Array.isArray(policy.selection?.prototypeSignals?.supportTags) || !Array.isArray(policy.selection?.prototypeSignals?.opposeTags)) {
    failures.push(`Policy ${policy.id} needs prototype signal arrays.`);
  }
}

const corePolicies = policies.filter((policy) => policy.selection?.tier === 'core');
const adaptivePolicies = policies.filter((policy) => policy.selection?.tier === 'adaptive');
if (policies.length < 20 || policies.length > 30) failures.push(`Adaptive candidate bank needs 20-30 policies; found ${policies.length}.`);
if (corePolicies.length !== model.adaptiveAssessment?.coreCount || corePolicies.length !== 8) failures.push(`Core policy count must be 8; found ${corePolicies.length}.`);
if (adaptivePolicies.length < model.adaptiveAssessment?.adaptiveMax) failures.push('Adaptive bank has fewer candidates than the maximum adaptive path length.');
const matchingWeightTotal = Object.values(model.adaptiveAssessment?.matchingWeights || {}).reduce((sum, weight) => sum + weight, 0);
if (matchingWeightTotal <= 0 || matchingWeightTotal > 100) failures.push(`Ideology matching weights must total between 1 and 100; found ${matchingWeightTotal}.`);
if (model.adaptiveAssessment?.matchingWeights?.dilemmaRelation !== 0) failures.push('Dilemma matching weight must stay zero until benchmark dilemma responses exist.');

for (const mode of ['conditional_scenario', 'real_world_belief']) {
  if (!model.assessmentModes?.[mode]?.label || !model.assessmentModes?.[mode]?.instruction) {
    failures.push(`Assessment mode ${mode} is incomplete.`);
  }
}
if (!['conditional_scenario', 'real_world_belief'].includes(model.assessmentModes?.default)) {
  failures.push('Assessment modes need a supported default.');
}
if (!['equal', 'depends_on_context', 'incomparable', 'undecided'].every((response) => model.dilemmaResponseScale?.allowed?.includes(response))) {
  failures.push('Dilemma response scale must distinguish equal, contextual, incomparable and undecided responses.');
}

for (const claim of Object.values(claims)) {
  if (claim.kind === 'policy' && !policyIds.has(claim.policyId)) failures.push(`Policy claim ${claim.id} references unknown policy ${claim.policyId}.`);
  if (claim.kind === 'terminal' && getArgumentsForClaim(claim.id).length) failures.push(`Terminal claim ${claim.id} has outgoing justification paths.`);
}

// Check that the recursive justification graph is acyclic and compute depth.
const visiting = new Set();
const visited = new Set();
function visit(claimId, path = []) {
  if (visiting.has(claimId)) {
    failures.push(`Normative justification cycle: ${[...path, claimId].join(' -> ')}`);
    return;
  }
  if (visited.has(claimId)) return;
  visiting.add(claimId);
  for (const argument of getArgumentsForClaim(claimId)) visit(argument.bridgeClaimId, [...path, claimId]);
  visiting.delete(claimId);
  visited.add(claimId);
}
for (const policy of policies) {
  visit(policy.supportClaimId);
  visit(policy.opposeClaimId);
}

const depthMemo = new Map();
function maxDepth(claimId, stack = new Set()) {
  if (depthMemo.has(claimId)) return depthMemo.get(claimId);
  if (stack.has(claimId)) return 0;
  const candidates = getArgumentsForClaim(claimId);
  if (!candidates.length) return 0;
  const nextStack = new Set([...stack, claimId]);
  const value = Math.max(...candidates.map((argument) => 1 + maxDepth(argument.bridgeClaimId, nextStack)));
  depthMemo.set(claimId, value);
  return value;
}
const rootDepths = policies.flatMap((policy) => [
  maxDepth(policy.supportClaimId),
  maxDepth(policy.opposeClaimId),
]);
const deepestPath = Math.max(...rootDepths);
if (deepestPath < 4) failures.push(`The model needs at least one four-layer recursive path; current maximum is ${deepestPath}.`);

const terminalIds = new Set(Object.values(claims).filter((claim) => claim.kind === 'terminal').map((claim) => claim.id));
const dilemmaIds = new Set();
for (const dilemma of dilemmas) {
  if (dilemmaIds.has(dilemma.id)) failures.push(`Duplicate dilemma id ${dilemma.id}.`);
  dilemmaIds.add(dilemma.id);
  if (dilemma.left === dilemma.right) failures.push(`Dilemma ${dilemma.id} compares a value with itself.`);
  if (!terminalIds.has(dilemma.left)) failures.push(`Dilemma ${dilemma.id} left endpoint ${dilemma.left} is not terminal.`);
  if (!terminalIds.has(dilemma.right)) failures.push(`Dilemma ${dilemma.id} right endpoint ${dilemma.right} is not terminal.`);
  if (!Array.isArray(dilemma.fixedFacts) || dilemma.fixedFacts.length < 2) failures.push(`Dilemma ${dilemma.id} needs explicit fixed facts.`);
  for (const field of ['title', 'scenario', 'leftAction', 'rightAction']) {
    if (!dilemma[field]) failures.push(`Dilemma ${dilemma.id} is missing ${field}.`);
  }
  if (dilemma.sensitivity?.scenarios?.length !== 2) failures.push(`Dilemma ${dilemma.id} needs low/high sensitivity scenarios.`);
}

const benchmarks = model.ideologyBenchmarks;
if (benchmarks?.schema !== 'argument-chain-ideology-benchmarks' || benchmarks?.modelVersion !== MODEL_META.version) {
  failures.push('Ideology benchmark schema or model version does not match the formal bank.');
} else {
  if (benchmarks.profiles?.length !== 52) failures.push(`Ideology benchmark needs 52 prototypes; found ${benchmarks.profiles?.length || 0}.`);
  const profileIds = new Set();
  for (const profile of benchmarks.profiles || []) {
    if (profileIds.has(profile.id)) failures.push(`Duplicate ideology profile ${profile.id}.`);
    profileIds.add(profile.id);
    if (!profile.displayName || !Array.isArray(profile.tags) || !profile.variants?.length) failures.push(`Ideology profile ${profile.id} is incomplete.`);
    const variantIds = new Set();
    for (const variant of profile.variants || []) {
      if (variantIds.has(variant.id)) failures.push(`Duplicate variant ${profile.id}/${variant.id}.`);
      variantIds.add(variant.id);
      if (!variant.source?.label || !variant.source?.caveat) failures.push(`Variant ${profile.id}/${variant.id} has no source boundary.`);
      for (const [policyId, position] of Object.entries(variant.policyPositions || {})) {
        if (!policyIds.has(policyId)) failures.push(`Variant ${profile.id}/${variant.id} references unknown policy ${policyId}.`);
        if (!['support', 'oppose', 'conditional', 'undecided'].includes(position?.stance)) failures.push(`Variant ${profile.id}/${variant.id} has an invalid stance for ${policyId}.`);
        if (!['explicit', 'reconstruction'].includes(position?.basis) || !['low', 'medium', 'high'].includes(position?.confidence) || typeof position?.rationale !== 'string') {
          failures.push(`Variant ${profile.id}/${variant.id} has no auditable basis for ${policyId}.`);
        }
      }
      for (const reasonId of Object.values(variant.primaryReasons || {}).filter(Boolean)) if (!claims[reasonId]) failures.push(`Variant ${profile.id}/${variant.id} references unknown reason family ${reasonId}.`);
      for (const claimId of Object.values(variant.fixedPoints || {}).filter(Boolean)) if (!claims[claimId]) failures.push(`Variant ${profile.id}/${variant.id} references unknown fixed point ${claimId}.`);
    }
  }
}

const usedAsBridge = new Set(Object.values(argumentsById).map((argument) => argument.bridgeClaimId));
const targeted = new Set(Object.values(argumentsById).map((argument) => argument.targetClaimId));
for (const claim of Object.values(claims)) {
  if (claim.kind !== 'policy' && !usedAsBridge.has(claim.id)) warnings.push(`Normative claim ${claim.id} is never used as a bridge.`);
  if (claim.kind === 'bridge' && !targeted.has(claim.id)) warnings.push(`Bridge ${claim.id} has no deeper justification path.`);
}

if (failures.length) {
  console.error(`Model validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Model validation warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

console.log(
  `Model ${MODEL_META.version} validation passed: ${Object.keys(facts).length} facts, `
  + `${Object.keys(argumentsById).length} arguments, ${Object.keys(claims).length} claims, `
  + `${policies.length} policies, ${terminalIds.size} terminal candidates, ${dilemmas.length} dilemmas, max depth ${deepestPath}.`,
);
