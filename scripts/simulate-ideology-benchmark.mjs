#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  PHASES,
  answer,
  createSession,
  getQuestion,
  startSession,
  validateModel,
} from '../src/lib/decisionEngine.js';

const modelPath = process.argv[2] || new URL('../public/bank/model-1.1.0.json', import.meta.url);
const benchmarkPath = process.argv[3] || new URL('../public/bank/ideology-benchmark-1.1.0.json', import.meta.url);
const outputPath = process.argv[4] || null;
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const model = readJson(modelPath);
const benchmark = readJson(benchmarkPath);
const validation = validateModel(model);
if (!validation.ok) throw new Error(validation.errors.join('\n'));

const assertOption = (question, optionId, context) => {
  if (!question.options.some((item) => item.id === optionId)) {
    throw new Error(`${context}: option ${optionId} unavailable in ${question.kind}; available=${question.options.map((item) => item.id).join(',')}`);
  }
};

const step = (state, optionId, context, extra = {}) => {
  const question = getQuestion(model, state);
  assertOption(question, optionId, context);
  return { state: answer(model, { ...state, history: [] }, optionId, extra), question };
};

const followReasonPath = (state, reasonPath, context, counters) => {
  if (!reasonPath?.length) {
    throw new Error(`${context}: expected reason path is empty`);
  }
  let current = state;
  let result = step(current, reasonPath[0], `${context}/reason-1`);
  current = result.state;
  counters.questions += 1;
  for (let index = 0; index < reasonPath.length; index += 1) {
    const reasonId = reasonPath[index];
    while (current.phase === PHASES.PREMISE_CHECK) {
      result = step(current, 'accept', `${context}/${reasonId}/premise`);
      current = result.state;
      counters.questions += 1;
    }
    if (current.phase !== PHASES.RULE_CHECK) {
      throw new Error(`${context}/${reasonId}: expected rule check, got ${current.phase}`);
    }
    result = step(current, 'accept', `${context}/${reasonId}/rule`);
    current = result.state;
    counters.questions += 1;
    if (current.phase !== PHASES.WHY_OR_STOP) {
      throw new Error(`${context}/${reasonId}: expected why_or_stop, got ${current.phase}`);
    }
    const nextReasonId = reasonPath[index + 1];
    result = step(current, nextReasonId || 'stop_here', `${context}/${reasonId}/depth`);
    current = result.state;
    counters.questions += 1;
  }
  if (current.phase !== PHASES.STRESS_TEST) {
    throw new Error(`${context}: expected stress test after reason path, got ${current.phase}`);
  }
  result = step(current, 'apply', `${context}/stress`);
  counters.questions += 1;
  return result.state;
};

const simulateProfile = (profile) => {
  let state = startSession(model, createSession(model, { policyIds: benchmark.corePolicyIds.concat(benchmark.tieBreakerPolicyIds) }));
  const counters = { questions: 0, policyQuestions: {}, customReasonRequired: 0 };
  for (const policyId of state.policyIds) {
    const expected = profile.expectedPaths[policyId];
    if (state.currentPolicyId !== policyId || state.phase !== PHASES.POLICY_DECISION) {
      throw new Error(`${profile.label}/${policyId}: unexpected start state ${state.currentPolicyId}/${state.phase}`);
    }
    const before = counters.questions;
    let result = step(state, expected.rootAnswer, `${profile.label}/${policyId}/root`);
    state = result.state;
    counters.questions += 1;

    if (expected.rootAnswer === 'no') {
      for (const revision of expected.revisionAnswers) {
        if (state.phase !== PHASES.REVISION_TEST) {
          throw new Error(`${profile.label}/${policyId}: expected revision_test, got ${state.phase}`);
        }
        const question = getQuestion(model, state);
        if (question.kind !== 'revision_test' || policyId !== state.currentPolicyId) {
          throw new Error(`${profile.label}/${policyId}: invalid revision question`);
        }
        const currentDiagnostic = model.policies.find((p) => p.id === policyId).diagnostics[state.diagnosticIndex];
        if (currentDiagnostic.id !== revision.diagnosticId) {
          throw new Error(`${profile.label}/${policyId}: expected diagnostic ${revision.diagnosticId}, got ${currentDiagnostic.id}`);
        }
        result = step(state, revision.answer, `${profile.label}/${policyId}/${revision.diagnosticId}`);
        state = result.state;
        counters.questions += 1;
      }
    }

    if (expected.rootAnswer !== 'uncertain') {
      if (state.phase !== PHASES.REASON_CHOICE) {
        throw new Error(`${profile.label}/${policyId}: expected main reason choice, got ${state.phase}`);
      }
      state = followReasonPath(state, expected.canonicalReasonPath, `${profile.label}/${policyId}/main`, counters);

      if (state.phase !== PHASES.COUNTER_REASON_CHOICE) {
        throw new Error(`${profile.label}/${policyId}: expected counter reason choice, got ${state.phase}`);
      }
      if (expected.canonicalCounterReasonPath?.length) {
        state = followReasonPath(state, expected.canonicalCounterReasonPath, `${profile.label}/${policyId}/counter`, counters);
        if (state.phase !== PHASES.COUNTER_IMPACT) {
          throw new Error(`${profile.label}/${policyId}: expected counter impact, got ${state.phase}`);
        }
        result = step(state, expected.counterImpact, `${profile.label}/${policyId}/counter-impact`);
        state = result.state;
        counters.questions += 1;
      } else {
        result = step(state, 'none', `${profile.label}/${policyId}/no-counter`);
        state = result.state;
        counters.questions += 1;
      }
    }

    if (state.phase === PHASES.CUSTOM_REASON_REQUIRED) {
      counters.customReasonRequired += 1;
      throw new Error(`${profile.label}/${policyId}: benchmark path reached custom reason required`);
    }
    if (state.phase !== PHASES.POLICY_DONE) {
      throw new Error(`${profile.label}/${policyId}: expected policy done, got ${state.phase}`);
    }
    counters.policyQuestions[policyId] = counters.questions - before;
    result = step(state, policyId === state.policyIds.at(-1) ? 'results' : 'next', `${profile.label}/${policyId}/advance`);
    state = result.state;
    counters.questions += 1;
  }
  if (state.phase !== PHASES.RESULTS) throw new Error(`${profile.label}: expected results, got ${state.phase}`);
  const policyResults = Object.fromEntries(Object.entries(state.policyResults).map(([policyId, result]) => {
    const { completedAt: _completedAt, ...stableResult } = result;
    return [policyId, stableResult];
  }));
  return {
    profileId: profile.id,
    label: profile.label,
    sourceStatus: profile.source.status,
    completedPolicies: Object.keys(state.policyResults).length,
    questionCountIncludingAdvance: counters.questions,
    policyQuestionCounts: counters.policyQuestions,
    customReasonRequired: counters.customReasonRequired,
    policyResults,
  };
};

export const simulateBenchmark = () => {
  const results = [];
  const failures = [];
  for (const profile of benchmark.profiles) {
    try {
      results.push(simulateProfile(profile));
    } catch (error) {
      failures.push({ profileId: profile.id, label: profile.label, error: error.stack || String(error) });
    }
  }
  const counts = results.map((item) => item.questionCountIncludingAdvance);
  return {
    schema: 'argument-chain-ideology-simulation-results',
    schemaVersion: 1,
    version: '1.1.0',
    targetModelVersion: model.meta.version,
    benchmarkVersion: benchmark.version,
    summary: {
      profileCount: benchmark.profiles.length,
      successfulProfiles: results.length,
      failedProfiles: failures.length,
      totalPolicyRuns: results.length * (benchmark.corePolicyIds.length + benchmark.tieBreakerPolicyIds.length),
      customReasonRequiredCount: results.reduce((sum, item) => sum + item.customReasonRequired, 0),
      minQuestionCount: counts.length ? Math.min(...counts) : null,
      maxQuestionCount: counts.length ? Math.max(...counts) : null,
      averageQuestionCount: counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 100) / 100 : null,
    },
    failures,
    results,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = simulateBenchmark();
  if (outputPath) fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.failures.length) {
    console.error(report.failures.slice(0, 5));
    process.exit(1);
  }
}
