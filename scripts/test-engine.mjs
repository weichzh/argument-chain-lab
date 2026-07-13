import assert from 'node:assert/strict';
import {
  PHASES,
  calculatePriority,
  createInitialState,
  reducer,
  sessionSummary,
} from '../src/lib/engine.js';
import { argumentsById, getRelevantDilemmas } from '../src/data/model.js';

const act = (state, action) => reducer(state, action);

function answerAllFacts(state, argumentId, response = 'true') {
  let next = state;
  for (const _factId of argumentsById[argumentId].factIds) {
    next = act(next, { type: 'ANSWER_FACT', response });
  }
  return next;
}

function completeSpeechChain({ firstFact = 'true', stress = 'apply' } = {}) {
  let state = createInitialState();
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
  let state = createInitialState();
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
  let state = createInitialState();
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
  state = act(state, { type: 'NO_ARGUMENT' });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  assert.equal(state.currentChain.status, 'unresolved');
  assert.equal(state.modelGaps.length, 1);
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
  assert.equal(state.phase, PHASES.TERMINAL_CONFIRM, 'Nominating any bridge must require a separate fixed-point confirmation.');
  assert.equal(state.currentChain.terminal.status, 'terminal_candidate');
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'continue' });
  assert.equal(state.phase, PHASES.ARGUMENT, 'A user must be able to retract the nomination and continue asking why.');
  assert.equal(state.currentTargetClaimId, 'protect_nonharmful_choice');
  assert.equal(state.currentChain.terminal, null);
}

{
  let state = createInitialState();
  state = act(state, { type: 'START' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'fixed_point' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'uncertain' });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  assert.equal(state.currentChain.status, 'unresolved');
  assert.equal(sessionSummary(state).uniqueCommitments.length, 0, 'Temporarily running out of reasons must not create a fixed point.');
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
  assert(priority.ranking.length >= 3);
  assert(priority.cycles.some((cycle) => cycle.includes('equal_agency') && cycle.includes('bodily_security') && cycle.includes('democratic_authorship')));
}

console.log('Engine tests passed: four-layer recursion, fixed-point confirmation, conditional/tension states, conflict resolution, model gaps, confirmed-only dilemmas, and preference cycles.');
