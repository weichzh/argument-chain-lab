import assert from 'node:assert/strict';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';

const judgmentKeys = [
  'schemeId',
  'requiredPremiseClaimIds',
  'targetElementIds',
  'rebuttalArgumentIds',
  'undercutterQuestionIds',
  'contentiousReconstruction',
];
const stableJudgment = (value) => JSON.stringify(Object.fromEntries(judgmentKeys.map((key) => [
  key,
  Array.isArray(value?.[key]) ? [...value[key]].sort() : value?.[key],
])));
const sameIds = (left = [], right = []) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

export const validateFormalReviewItem = (item, model, minimumReviewers = 2) => {
  const issues = [];
  const argument = model.arguments[item?.argumentId];
  if (!argument?.formalization) return [`${item?.argumentId || 'unknown'}: argument is not formalized.`];
  if (!item.tradition) issues.push(`${item.argumentId}: tradition is missing.`);
  if (!judgmentKeys.every((key) => Object.hasOwn(item.reference || {}, key))) {
    issues.push(`${item.argumentId}: reference dimensions are incomplete.`);
  }
  if (item.reference?.schemeId !== argument.formalization.schemeId) {
    issues.push(`${item.argumentId}: reference scheme is stale.`);
  }
  if (!sameIds(item.reference?.targetElementIds, argument.formalization.conclusion.targetElementIds)) {
    issues.push(`${item.argumentId}: reference scope is stale.`);
  }
  const expectedPremises = [...new Set(argument.formalization.premises.map((premise) => premise.claimRef).filter(Boolean))];
  if (!sameIds(item.reference?.requiredPremiseClaimIds, expectedPremises)) {
    issues.push(`${item.argumentId}: reference premises are stale.`);
  }
  const expectedRebuttals = [...new Set((model.formalIndex?.attacks || [])
    .filter((attack) => attack.kind === 'rebut' && (
      attack.sourceArgumentId === item.argumentId || attack.targetArgumentId === item.argumentId
    ))
    .map((attack) => attack.sourceArgumentId === item.argumentId
      ? attack.targetArgumentId
      : attack.sourceArgumentId))];
  if (!sameIds(item.reference?.rebuttalArgumentIds, expectedRebuttals)) {
    issues.push(`${item.argumentId}: reference rebuttals are stale.`);
  }
  const scheme = model.arglogicCatalog.schemes.find((candidate) => candidate.id === argument.formalization.schemeId);
  const expectedUndercutters = (scheme?.criticalQuestions || [])
    .filter((question) => question.attackKind === 'undercut')
    .map((question) => question.id);
  if (!sameIds(item.reference?.undercutterQuestionIds, expectedUndercutters)) {
    issues.push(`${item.argumentId}: reference undercutters are stale.`);
  }
  if (typeof item.reference?.contentiousReconstruction !== 'boolean') {
    issues.push(`${item.argumentId}: contentious reconstruction must be boolean.`);
  }

  const reviews = item.reviews || [];
  if (!reviews.length) {
    if (item.resolution !== 'pending') issues.push(`${item.argumentId}: unreviewed item must remain pending.`);
    return issues;
  }
  const reviewerIds = new Set();
  for (const review of reviews) {
    if (!review.reviewerId || reviewerIds.has(review.reviewerId)) issues.push(`${item.argumentId}: reviewer ids must be distinct.`);
    reviewerIds.add(review.reviewerId);
    if (review.reviewerKind !== 'human' || review.independent !== true) {
      issues.push(`${item.argumentId}/${review.reviewerId}: review must be independent human annotation.`);
    }
    if (!judgmentKeys.every((key) => Object.hasOwn(review.judgment || {}, key))) {
      issues.push(`${item.argumentId}/${review.reviewerId}: judgment dimensions are incomplete.`);
    }
  }
  if (reviewerIds.size < minimumReviewers) issues.push(`${item.argumentId}: fewer than ${minimumReviewers} reviewers.`);
  const judgments = new Set(reviews.map((review) => stableJudgment(review.judgment)));
  if (judgments.size === 1 && item.resolution !== 'consensus') {
    issues.push(`${item.argumentId}: agreeing reviews must be marked consensus.`);
  }
  if (judgments.size > 1 && (
    item.resolution !== 'alternatives'
    || reviews.some((review) => !review.alternativeId)
  )) issues.push(`${item.argumentId}: disagreements must preserve named alternatives.`);
  return issues;
};

export const validateFormalReviewBenchmark = (benchmark, model) => {
  const issues = [];
  if (benchmark?.schema !== 'argument-chain-formal-review-benchmark' || benchmark?.version !== 1) {
    return ['Formal review benchmark schema is unsupported.'];
  }
  if (benchmark.modelVersion !== model.meta.version) issues.push('Formal review model version is stale.');
  if (benchmark.minimumReviewers < 2) issues.push('Formal review benchmark needs at least two reviewers.');
  if (!['awaiting_human_review', 'ready'].includes(benchmark.status)) issues.push('Formal review status is invalid.');
  if (!sameIds(benchmark.dimensions, judgmentKeys)) issues.push('Formal review dimensions are incomplete.');
  if (!Array.isArray(benchmark.items) || benchmark.items.length < 10) issues.push('Formal review benchmark needs at least ten cross-tradition seed items.');
  const ids = new Set();
  for (const item of benchmark.items || []) {
    if (ids.has(item.argumentId)) issues.push(`${item.argumentId}: duplicate review item.`);
    ids.add(item.argumentId);
    issues.push(...validateFormalReviewItem(item, model, benchmark.minimumReviewers));
  }
  if (new Set((benchmark.items || []).map((item) => item.tradition)).size < 8) {
    issues.push('Formal review benchmark needs at least eight traditions.');
  }
  if (benchmark.status === 'ready' && benchmark.items.some((item) => item.resolution === 'pending')) {
    issues.push('A ready formal review benchmark cannot contain pending items.');
  }
  return issues;
};

const { model } = await loadCurrentFormalModel();
const benchmark = model.formalReviewBenchmark;
const issues = validateFormalReviewBenchmark(benchmark, model);
if (issues.length) {
  console.error(`Formal review benchmark failed with ${issues.length} issue(s):`);
  issues.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

const sample = structuredClone(benchmark.items[0]);
sample.reviews = ['reviewer_a', 'reviewer_b'].map((reviewerId) => ({
  reviewerId,
  reviewerKind: 'human',
  independent: true,
  judgment: structuredClone(sample.reference),
}));
sample.resolution = 'consensus';
assert.deepEqual(validateFormalReviewItem(sample, model, 2), []);
const disputed = structuredClone(sample);
disputed.reviews[1].judgment.contentiousReconstruction = !disputed.reviews[1].judgment.contentiousReconstruction;
assert(validateFormalReviewItem(disputed, model, 2).some((item) => item.includes('named alternatives')));

const reviewed = benchmark.items.filter((item) => item.reviews.length >= benchmark.minimumReviewers).length;
console.log(`Formal review benchmark passed: ${benchmark.items.length} seed items, ${reviewed} independently reviewed, status ${benchmark.status}.`);
