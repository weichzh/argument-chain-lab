#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildRootOnlyResults,
  matchEntertainment,
} from '../src/lib/entertainmentMatcher.js';
import { simulateBenchmark } from './simulate-ideology-benchmark.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const model = read('../public/bank/model-1.2.0.json');
const benchmark = read('../public/bank/ideology-benchmark-1.2.0.json');
const profileById = Object.fromEntries(benchmark.profiles.map((profile) => [profile.id, profile]));
const allPolicyIds = [...benchmark.corePolicyIds, ...benchmark.tieBreakerPolicyIds];
const simulations = simulateBenchmark();
assert.equal(simulations.summary.failedProfiles, 0, JSON.stringify(simulations.failures.slice(0, 5)));
assert.equal(simulations.summary.totalPolicyRuns, 975);

let representedProfiles = 0;
const depthValues = [];
for (const simulation of simulations.results) {
  const profile = profileById[simulation.profileId];
  const result = await matchEntertainment(model, benchmark, simulation.policyResults, {
    expectedPolicyIds: allPolicyIds,
  });
  const represented = result.candidateGroup.some((candidate) => (
    candidate.profileId === simulation.profileId
    || candidate.referenceFamilyId === profile.referenceFamilyId
  ));
  if (represented) representedProfiles += 1;
  assert(represented, `${profile.label} should be represented in its candidate group or family.`);
  if (profile.allowUniqueResult === false) {
    assert.notEqual(result.nearestPrototype?.profileId, profile.id);
    assert.equal(result.displayStrategy.id, 'candidate_group');
  }
  assert(result.candidateGroup.every((candidate) => candidate.labelZh));
  assert(!/夹具/.test(JSON.stringify(result.referenceSourceNote || {})));
  assert.equal(result.argumentProfile.fingerprint.length, 16);
  assert.equal(result.policyCoveragePercent, 100);
  assert(result.reasoningDepthPercent >= 10 && result.reasoningDepthPercent <= 100);
  depthValues.push(result.reasoningDepthPercent);
}
assert.equal(representedProfiles, benchmark.profiles.length);

// Root-only input answers all core policies, but has deliberately shallow reasoning depth.
const rootOnly = buildRootOnlyResults(profileById['ideology:liberalism'], benchmark.corePolicyIds);
const rootResult = await matchEntertainment(model, benchmark, rootOnly, {
  expectedPolicyIds: benchmark.corePolicyIds,
});
assert.equal(rootResult.policyCoveragePercent, 100);
assert(rootResult.reasoningDepthPercent < 30);
assert(['ambiguous', 'exploratory'].includes(rootResult.confidence));
assert(rootResult.tieBreaker, 'A root-only match should normally recommend a tie-breaker.');
assert.equal(rootResult.displayStrategy.id, 'candidate_group');
assert.equal(rootResult.decisiveSimilarities.some((item) => item.kind === 'shared_reason_family'), false);

// Missing policies reduce policy coverage; they do not count as disagreement.
const onePolicy = { speech_restriction: rootOnly.speech_restriction };
const oneResult = await matchEntertainment(model, benchmark, onePolicy, {
  expectedPolicyIds: benchmark.corePolicyIds,
});
assert(oneResult.policyCoveragePercent < rootResult.policyCoveragePercent);
assert.equal(oneResult.policyCoveragePercent, 12.5);
assert.equal(oneResult.displayStrategy.id, 'argument_profile_only');
assert(oneResult.tieBreaker);
const skippedResult = await matchEntertainment(model, benchmark, {
  ...onePolicy,
  metadata_surveillance: { policyId: 'metadata_surveillance', rootAnswer: 'skipped' },
}, { expectedPolicyIds: benchmark.corePolicyIds });
assert.equal(skippedResult.policyCoveragePercent, 12.5);

// Synthetic source status must remain visible rather than being disguised as historical certainty.
const naziResult = await matchEntertainment(model, benchmark, profileById['ideology:nazism'].expectedPaths, {
  expectedPolicyIds: allPolicyIds,
});
assert.equal(naziResult.closestReference.sourceStatus, 'source_anchored');
assert.equal(naziResult.presentation.celebratoryEffectsAllowed, false);
const syntheticResult = await matchEntertainment(
  model,
  benchmark,
  profileById['ideology:national_totalitarianism'].expectedPaths,
  {
    expectedPolicyIds: allPolicyIds,
  },
);
assert.equal(syntheticResult.closestReference.sourceStatus, 'synthetic_stress_fixture');
assert.equal(syntheticResult.presentation.celebratoryEffectsAllowed, false);
assert(Array.isArray(syntheticResult.closestReference.differences));

const marxism = profileById['ideology:marxism'];
const marxismResult = await matchEntertainment(model, benchmark, marxism.expectedPaths, {
  expectedPolicyIds: allPolicyIds,
});
assert.equal(marxismResult.displayStrategy.id, 'candidate_group');
for (const label of ['Marxism', 'Eco-Marxism', 'Left-Communism']) {
  assert(marxismResult.candidateGroup.some((candidate) => candidate.label === label));
}

console.log(JSON.stringify({
  profileCount: benchmark.profiles.length,
  fullPathRepresented: representedProfiles,
  fullPathReasoningDepthRange: [Math.min(...depthValues), Math.max(...depthValues)],
  rootOnlyConfidence: rootResult.confidence,
  rootOnlyPolicyCoverage: rootResult.policyCoveragePercent,
  rootOnlyReasoningDepth: rootResult.reasoningDepthPercent,
  onePolicyCoverage: oneResult.policyCoveragePercent,
  recommendedTieBreaker: rootResult.tieBreaker.policyId,
}, null, 2));
