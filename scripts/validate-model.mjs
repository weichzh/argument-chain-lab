import {
  MODEL_META,
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  policies,
} from '../src/data/model.js';

const failures = [];
const warnings = [];
const forbiddenNormativeTerms = [
  '应当', '应该', '应予', '有理由', '正当', '不正当', '公平', '不公平',
  '权利', '善', '恶', '值得', '合理', '不合理', '可接受', '不可接受', '优先',
];
const allowedFactKinds = new Set(['stipulated', 'empirical', 'descriptive']);
const allowedClaimKinds = new Set(['policy', 'bridge', 'terminal']);

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
  if (claim.kind === 'terminal' && !claim.stressTest) failures.push(`Terminal claim ${id} has no stress test.`);
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
