import assert from 'node:assert/strict';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';
import {
  PHASES,
  calculatePriority,
  collectTerminalCommitments,
  createInitialState,
  migrateSavedState,
  reducer,
  sessionSummary,
} from '../src/lib/engine.js';
import {
  argumentsById,
  configureFormalModel,
  getArgumentsForClaim,
  getRelevantDilemmas,
} from '../src/data/model.js';

const { model } = await loadCurrentFormalModel();
configureFormalModel(model);

const act = (state, action) => reducer(state, action);
const createRealWorldState = () => act(createInitialState(), { type: 'SET_ASSESSMENT_MODE', mode: 'real_world_belief' });

function answerAllFacts(state, argumentId, response = 'true') {
  let next = state;
  for (const _factId of argumentsById[argumentId].factIds) {
    next = act(next, { type: 'ANSWER_FACT', response });
  }
  return next;
}

function completeSpeechChain({ firstFact = 'true', stress = 'apply', assessmentMode = 'real_world_belief' } = {}) {
  let state = act(createInitialState(), { type: 'SET_ASSESSMENT_MODE', mode: assessmentMode });
  state = act(state, { type: 'START' });
  assert.equal(state.phase, PHASES.STANCE);
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  assert.equal(state.phase, PHASES.ARGUMENT);
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  assert.equal(state.phase, PHASES.FACT);
  state = act(state, { type: 'ANSWER_FACT', response: firstFact });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  assert.equal(state.phase, PHASES.BRIDGE);
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.DEPTH);
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  assert.equal(state.currentTargetClaimId, 'prevent_severe_harm');
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'severe_harm_to_security' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.TERMINAL_CONFIRM);
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  assert.equal(state.phase, PHASES.STRESS);
  state = act(state, { type: 'ANSWER_STRESS', response: stress });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  return state;
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });

  for (const argumentId of [
    'speech_discretion_oppose',
    'discretion_to_answerability',
    'answerability_to_equal_standing',
    'standing_to_procedure',
  ]) {
    state = act(state, { type: 'SELECT_ARGUMENT', argumentId });
    assert.equal(state.phase, PHASES.FACT);
    state = answerAllFacts(state, argumentId);
    assert.equal(state.phase, PHASES.BRIDGE);
    state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
    if (state.phase === PHASES.DEPTH) state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  }

  assert.equal(state.phase, PHASES.TERMINAL_CONFIRM);
  assert.equal(state.currentChain.steps.length, 4, 'The engine should preserve all four recursive F+B⇝V layers.');
  assert.equal(state.currentChain.terminal, null, 'A terminal claim still requires explicit confirmation before it becomes a fixed point.');
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  assert.equal(state.currentChain.status, 'complete');
  assert.equal(state.currentChain.terminal.claimId, 'procedural_justification');
}

{
  const state = completeSpeechChain();
  assert.equal(state.currentChain.status, 'complete');
  assert.equal(state.records.speech_restriction.status, 'complete');
  assert.equal(state.currentChain.steps.length, 2);
  assert.equal(state.currentChain.terminal.claimId, 'bodily_security');
}

{
  const state = completeSpeechChain({ assessmentMode: 'conditional_scenario' });
  assert.equal(state.currentChain.status, 'conditional');
  assert.equal(state.records.speech_restriction.hasConditional, true);
  assert.equal(state.assessmentMode, 'conditional_scenario');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'conditional_scenario'));
}

{
  const state = completeSpeechChain({ firstFact: 'false' });
  assert.equal(state.currentChain.status, 'conditional');
  assert.equal(state.records.speech_restriction.status, 'conditional');
  const summary = sessionSummary(state);
  assert.equal(summary.conditionalChains.length, 1);
  assert(summary.tensions.some((item) => item.kind === 'empirical_break'));
}

{
  const state = completeSpeechChain({ stress: 'unexplained_exception' });
  assert.equal(state.currentChain.status, 'tension');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'scope_tension'));
}

{
  const state = completeSpeechChain({ stress: 'qualified_exception' });
  assert.equal(state.currentChain.status, 'tension');
  assert.equal(collectTerminalCommitments(state).length, 0, 'A qualified scope exception must not enter dilemma eligibility.');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'scope_tension'));
}

{
  const state = completeSpeechChain({ stress: 'qualified_exception' });
  const legacyChain = {
    ...state.currentChain,
    status: 'complete',
    steps: state.currentChain.steps.map(({ assessmentMode: _assessmentMode, ...step }) => step),
  };
  const migrated = migrateSavedState({
    ...state,
    modelVersion: '0.7.0',
    assessmentMode: undefined,
    currentChain: legacyChain,
    sessionOverlay: {
      ...state.sessionOverlay,
      claims: {
        local_claim_legacy: {
          id: 'local_claim_legacy',
          kind: 'bridge',
          stressTest: { scenario: '相似案例', question: '仍适用吗？' },
        },
      },
    },
    records: {
      speech_restriction: {
        ...state.records.speech_restriction,
        status: 'complete',
        chains: [legacyChain],
      },
    },
  });
  assert.equal(migrated.modelVersion, model.meta.version);
  assert.equal(migrated.assessmentMode, 'real_world_belief');
  assert.equal(migrated.currentChain.status, 'tension');
  assert.equal(migrated.records.speech_restriction.hasTension, true);
  assert.equal(migrated.sessionOverlay.claims.local_claim_legacy.nominatable, true);
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'reject' });
  assert.equal(state.phase, PHASES.BROKEN);
  state = act(state, { type: 'RESOLVE_BREAK', resolution: 'alternate_argument' });
  assert.equal(state.phase, PHASES.ARGUMENT);
  assert.equal(state.currentChain.steps.length, 0, 'Rejected attempt should not poison replacement chain.');
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'fixed_point' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'reject' });
  state = act(state, { type: 'RESOLVE_BREAK', resolution: 'alternate_argument' });
  assert.equal(state.currentTargetClaimId, 'protect_nonharmful_choice', 'Rejecting a fixed point should continue from that accepted bridge.');
  assert.equal(state.currentChain.steps.length, 1, 'The accepted F+B⇝V layer must remain in the recursive chain.');
  assert.equal(state.fixedPointEvents.at(-1).status, 'rejected');
}

{
  let state = completeSpeechChain();
  state = act(state, { type: 'RETRY_POLICY' });
  state = act(state, { type: 'SKIP_POLICY', reason: 'Regression check.' });
  assert.equal(state.records.speech_restriction.status, 'complete', 'An unresolved retry must not downgrade an existing complete record.');
  assert.equal(state.records.speech_restriction.mixed, true);
  assert.equal(state.records.speech_restriction.hasComplete, true);
  assert.equal(state.records.speech_restriction.hasUnresolved, true);
}

{
  let state = completeSpeechChain();
  state = act(state, { type: 'RETRY_POLICY' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = act(state, { type: 'ANSWER_FACT', response: 'false' });
  assert.equal(state.phase, PHASES.CONFLICT, 'Opposite answer to the same fact should pause the chain.');
  assert.equal(state.pendingConflict.kind, 'fact');
  state = act(state, { type: 'RESOLVE_CONFLICT', resolution: 'suspend' });
  assert.equal(state.phase, PHASES.FACT, 'Suspending the first premise should continue to the next premise.');
  assert.equal(state.pendingFactResponses.speech_reduces_serious_assaults, 'unknown');
  assert.equal(state.records.speech_restriction.chains[0].status, 'conditional', 'Revising a prior fact must recompute the prior chain status.');
  assert.equal(state.conflicts.length, 1);
}

{
  let state = completeSpeechChain();
  state = act(state, { type: 'RETRY_POLICY' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'reject' });
  assert.equal(state.phase, PHASES.CONFLICT, 'Opposite answer to the same bridge should pause the chain.');
  state = act(state, { type: 'RESOLVE_CONFLICT', resolution: 'keep_prior' });
  assert.equal(state.phase, PHASES.DEPTH, 'Keeping the prior accepted bridge should let the current chain continue.');
  assert.equal(state.currentChain.steps.at(-1).bridgeResponse, 'accept');
}

{
  let state = createInitialState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'NO_ARGUMENT', summary: '缺少基于宗教良心的反对理由。' });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  assert.equal(state.currentChain.status, 'unresolved');
  assert.equal(state.modelGaps.length, 1);
  assert.equal(state.modelGaps[0].summary, '缺少基于宗教良心的反对理由。');
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START_AT_POLICY', policyId: 'workplace_cogovernance' });
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  assert(getArgumentsForClaim('speech_oppose').some((item) => item.id === 'speech_inquiry_oppose'));
  assert(getArgumentsForClaim('surveillance_oppose').some((item) => item.id === 'surveillance_civic_association_oppose'));
  assert.equal(getArgumentsForClaim('workplace_cogovernance_support').length, 4);
  assert.equal(getArgumentsForClaim('workplace_cogovernance_oppose').length, 3);
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'workplace_shared_control_support' });
  state = answerAllFacts(state, 'workplace_shared_control_support');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'production_to_productive_self_governance' });
  state = answerAllFacts(state, 'production_to_productive_self_governance');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  assert.equal(state.currentChain.status, 'complete');
  assert.equal(state.currentChain.terminal.claimId, 'productive_self_governance');
  assert.deepEqual(
    getRelevantDilemmas(['productive_self_governance', 'intergenerational_stewardship']).map((item) => item.id),
    ['production_vs_stewardship'],
  );
}

{
  assert(getArgumentsForClaim('speech_oppose').some((item) => item.id === 'speech_basic_liberty_oppose'));
  assert(getArgumentsForClaim('surveillance_oppose').some((item) => item.id === 'surveillance_basic_liberty_oppose'));
  assert(getArgumentsForClaim('income_support').some((item) => item.id === 'income_least_advantaged_support'));
  assert(getArgumentsForClaim('carbon_support').some((item) => item.id === 'carbon_general_rule_support'));
  assert.equal(getArgumentsForClaim('education_opportunity_support').length, 3);
  assert.equal(getArgumentsForClaim('education_opportunity_oppose').length, 3);

  let state = createRealWorldState();
  state = act(state, { type: 'START_AT_POLICY', policyId: 'education_opportunity_fund' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'education_local_knowledge_oppose' });
  state = answerAllFacts(state, 'education_local_knowledge_oppose');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'local_feedback_to_decentralized_adaptation' });
  state = answerAllFacts(state, 'local_feedback_to_decentralized_adaptation');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  assert.equal(state.currentChain.status, 'complete');
  assert.equal(state.currentChain.terminal.claimId, 'decentralized_adaptation');
  assert.deepEqual(
    getRelevantDilemmas(['decentralized_adaptation', 'fair_equality_of_opportunity']).map((item) => item.id),
    ['adaptation_vs_opportunity'],
  );
}


{
  let state = createInitialState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.DEPTH);
  state = act(state, { type: 'SET_DEPTH', decision: 'fixed_point' });
  assert.equal(state.phase, PHASES.DEPTH, 'A bridge without a structured stress test cannot become a stopping point.');
  assert.equal(state.currentChain.terminal, null);
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  assert.equal(state.phase, PHASES.ARGUMENT);
  assert.equal(state.currentTargetClaimId, 'protect_nonharmful_choice');
}

{
  let state = createInitialState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = answerAllFacts(state, 'speech_harm_support');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'severe_harm_to_security' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'uncertain' });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  assert.equal(state.currentChain.status, 'unresolved');
  assert.equal(sessionSummary(state).uniqueCommitments.length, 0, 'Temporarily running out of reasons must not create a fixed point.');
  assert.equal(state.fixedPointEvents.at(-1).status, 'unconfirmed');
}

{
  let state = completeSpeechChain();
  state = act(state, { type: 'RETRY_POLICY' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = answerAllFacts(state, 'speech_harm_support');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'severe_harm_to_security' });
  state = answerAllFacts(state, 'severe_harm_to_security');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'continue' });
  assert.equal(state.phase, PHASES.ARGUMENT, 'A missing bank argument must not block deeper AI-assisted recursion.');
  assert.equal(state.currentTargetClaimId, 'bodily_security');
}

{
  assert.equal(getRelevantDilemmas(['equal_agency']).length, 0, 'One discovered value cannot trigger a generic dilemma.');
  assert.deepEqual(
    getRelevantDilemmas(['equal_agency', 'bodily_security']).map((item) => item.id),
    ['agency_vs_security'],
    'Dilemmas must require both endpoints to be confirmed values.',
  );
  let state = completeSpeechChain();
  state = act(state, { type: 'START_DILEMMAS' });
  assert.equal(state.phase, PHASES.RESULTS);
  assert.deepEqual(state.dilemmaQueue, [], 'The engine must not fill missing pairs with unrelated generic dilemmas.');
}

{
  const state = {
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security', 'democracy_vs_agency', 'security_vs_democracy'],
    dilemmaResponses: {
      agency_vs_security: { response: 'left_strong' },
      democracy_vs_agency: { response: 'left_strong' },
      security_vs_democracy: { response: 'left_strong' },
    },
  };
  const priority = calculatePriority(state);
  assert.equal('ranking' in priority, false, 'Sparse local comparisons must not be converted into a total ranking.');
  assert.equal(priority.edges.length, 3);
  assert(priority.cycles.some((cycle) => cycle.includes('equal_agency') && cycle.includes('bodily_security') && cycle.includes('democratic_authorship')));
}

{
  const state = {
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security'],
    dilemmaResponses: { agency_vs_security: { response: 'undecided' } },
  };
  assert.equal(calculatePriority(state).unanswered, 0, 'An explicit undecided response is answered, not missing.');
}

{
  const state = {
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security'],
    dilemmaResponses: { agency_vs_security: { response: 'equal' } },
  };
  const priority = calculatePriority(state);
  assert.equal(priority.ties.length, 1);
  assert.equal(priority.edges.length, 0);
  assert.equal(priority.incomparables.length, 0);
}

{
  let state = act(createInitialState(), { type: 'START_OVERVIEW' });
  assert.equal(state.phase, PHASES.POLICY_OVERVIEW);
  state = act(state, { type: 'OPEN_POLICY', policyId: 'speech_restriction' });
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  assert.equal(state.currentFactIndex, 1);

  state = act(state, { type: 'OPEN_OVERVIEW' });
  assert.equal(state.records.speech_restriction.draft.phase, PHASES.FACT);
  state = act(state, { type: 'OPEN_POLICY', policyId: 'metadata_surveillance' });
  assert.equal(state.phase, PHASES.STANCE);
  state = act(state, { type: 'EXIT_TO_LANDING' });
  assert.equal(state.phase, PHASES.LANDING);
  assert.equal(state.records.metadata_surveillance.draft.phase, PHASES.STANCE);

  state = act(state, { type: 'OPEN_OVERVIEW' });
  state = act(state, { type: 'OPEN_POLICY', policyId: 'speech_restriction' });
  assert.equal(state.phase, PHASES.FACT);
  assert.equal(state.currentFactIndex, 1, 'Switching questions must resume the exact unfinished fact.');
  assert.equal(state.pendingFactResponses.speech_reduces_serious_assaults, 'true');

  state = act(state, { type: 'SHOW_RESULTS' });
  assert.equal(state.phase, PHASES.RESULTS);
  assert.equal(state.records.speech_restriction.draft.phase, PHASES.FACT);
  assert.equal(sessionSummary(state).completeChains.length, 0, 'In-progress drafts must not be counted in results.');
  assert.equal(sessionSummary(state).conditionalChains.length, 0);
  assert.equal(sessionSummary(state).unresolvedChains.length, 0);
}

console.log('Engine tests passed: recursion, fixed points, conflict handling, resumable free-order questions, partial results, dilemmas, and cycles.');
