import assert from 'node:assert/strict';
import { loadCurrentFormalModel } from './lib/load-formal-model.mjs';
import {
  PHASES,
  calculatePriority,
  collectTerminalCommitments,
  createInitialState,
  exportSession,
  getSelectedChain,
  migrateSavedState,
  reducer,
  sessionSummary,
} from '../src/lib/engine.js';
import {
  argumentsById,
  configureFormalModel,
  getArgumentsForClaim,
  getPolicyElements,
  getRelevantDilemmas,
  policies,
} from '../src/data/model.js';

const { model } = await loadCurrentFormalModel();
configureFormalModel(model);

const act = (state, action) => reducer(state, action);
const createRealWorldState = () => act(createInitialState(), { type: 'SET_ASSESSMENT_MODE', mode: 'real_world_belief' });

function answerComponents(state, position = 'undecided') {
  if (state.phase !== PHASES.COMPONENTS) return state;
  let next = state;
  for (const element of getPolicyElements(policies[state.policyIndex], ['policy_choice', 'safeguard', 'parameter'])) {
    const response = element.kind === 'policy_choice' ? position : 'uncertain';
    next = act(next, { type: 'SET_POLICY_ELEMENT_RESPONSE', elementId: element.id, response });
  }
  return act(next, { type: 'COMPLETE_COMPONENTS' });
}

const startFirstPolicy = (state) => answerComponents(act(state, { type: 'START' }));

function answerFact(state, response = 'true') {
  let next = act(state, { type: 'ANSWER_FACT', response });
  while (next.phase === PHASES.FACT_SENSITIVITY) {
    next = act(next, { type: 'ANSWER_FACT_SENSITIVITY', response: 'sufficient' });
  }
  return next;
}

function answerAllFacts(state, argumentId, response = 'true') {
  let next = state;
  for (const _factId of argumentsById[argumentId].factIds) {
    next = answerFact(next, response);
  }
  return next;
}

const finishDefeater = (state) => state.phase === PHASES.DEFEATER
  ? act(state, { type: 'NO_DEFEATER_ACCEPTED' })
  : state;

function answerDefeater(state, argumentId, effect) {
  let next = act(state, { type: 'SELECT_DEFEATER', argumentId });
  while (next.phase === PHASES.DEFEATER_FACT) next = act(next, { type: 'ANSWER_DEFEATER_FACT', response: 'true' });
  next = act(next, { type: 'ANSWER_DEFEATER_BRIDGE', response: 'accept' });
  return act(next, { type: 'ANSWER_DEFEATER', effect });
}

function completeSpeechChain({ firstFact = 'true', stress = 'apply', assessmentMode = 'real_world_belief', defeaterEffect = 'none', initialStance = 'support', direction = 'support' } = {}) {
  let state = act(createInitialState(), { type: 'SET_ASSESSMENT_MODE', mode: assessmentMode });
  state = startFirstPolicy(state);
  assert.equal(state.phase, PHASES.STANCE);
  state = act(state, { type: 'SET_STANCE', stance: initialStance });
  if (initialStance === 'undecided') state = act(state, { type: 'SET_DIRECTION', direction });
  assert.equal(state.phase, PHASES.ARGUMENT);
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  assert.equal(state.phase, PHASES.FACT);
  state = answerFact(state, firstFact);
  for (const _factId of argumentsById.speech_harm_support.factIds.slice(1)) state = answerFact(state, 'true');
  assert.equal(state.phase, PHASES.BRIDGE);
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.DEPTH);
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  assert.equal(state.currentTargetClaimId, 'prevent_severe_harm');
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'severe_harm_to_security' });
  state = answerFact(state, 'true');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.TERMINAL_CONFIRM);
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  assert.equal(state.phase, PHASES.STRESS);
  state = act(state, { type: 'ANSWER_STRESS', response: stress });
  if (state.phase === PHASES.DEFEATER && defeaterEffect !== 'none') {
    state = answerDefeater(state, 'speech_choice_oppose', defeaterEffect);
  } else {
    state = finishDefeater(state);
  }
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  return state;
}

{
  let state = act(createInitialState(), { type: 'START_OVERVIEW' });
  state = act(state, { type: 'OPEN_POLICY', policyId: 'carbon_fee' });
  const elements = getPolicyElements(policies[state.policyIndex], ['policy_choice', 'safeguard', 'parameter']);
  const choices = getPolicyElements(policies[state.policyIndex], ['policy_choice']);
  elements.forEach((element) => {
    const index = choices.findIndex((choice) => choice.id === element.id);
    state = act(state, {
      type: 'SET_POLICY_ELEMENT_RESPONSE',
      elementId: element.id,
      response: element.kind === 'policy_choice'
        ? index === 0 ? 'support' : index === 1 ? 'oppose' : 'undecided'
        : 'uncertain',
    });
  });
  state = act(state, { type: 'COMPLETE_COMPONENTS' });
  assert.equal(state.records.carbon_fee.packageConflict, true);
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  assert.equal(state.phase, PHASES.PACKAGE_TRADEOFF);
  state = act(state, { type: 'SET_COMPONENT_TRADEOFF', componentId: choices[0].id, position: 'required' });
  state = act(state, { type: 'SET_COMPONENT_TRADEOFF', componentId: choices[1].id, position: 'tradeable' });
  state = act(state, { type: 'COMPLETE_PACKAGE_TRADEOFF', mode: 'specified' });
  assert.equal(state.phase, PHASES.ARGUMENT);
}

{
  let state = act(createInitialState(), { type: 'START_OVERVIEW' });
  state = act(state, { type: 'START_ADAPTIVE' });
  assert.equal(state.adaptiveMode, true);
  assert.equal(policies[state.policyIndex].id, 'speech_restriction');
  assert.equal(state.phase, PHASES.COMPONENTS);
}

{
  let state = act(createInitialState(), { type: 'START_AT_POLICY', policyId: 'majority_morality_law' });
  const scenario = getPolicyElements(policies[state.policyIndex], ['scenario_condition'])[0];
  assert(scenario, 'The policy should expose display-only scenario conditions.');
  state = act(state, { type: 'SET_POLICY_ELEMENT_RESPONSE', elementId: scenario.id, response: 'support' });
  assert.equal(state.records.majority_morality_law.policyChoiceResponses[scenario.id], undefined, 'Scenario conditions must never receive support/oppose answers.');
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START_AT_POLICY', policyId: 'emergency_powers' });
  state = answerComponents(state);
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'emergency_powers_support_reviewable_emergency_authority_1' });
  state = answerAllFacts(state, 'emergency_powers_support_reviewable_emergency_authority_1');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'reviewable_emergency_authority_to_constitutional_rule_of_law' });
  state = answerAllFacts(state, 'reviewable_emergency_authority_to_constitutional_rule_of_law');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  state = finishDefeater(state);

  state = act(state, { type: 'OPEN_OVERVIEW' });
  state = act(state, { type: 'OPEN_POLICY', policyId: 'emergency_powers' });
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'emergency_powers_oppose_preserve_democratic_final_authority_3' });
  state = answerAllFacts(state, 'emergency_powers_oppose_preserve_democratic_final_authority_3');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'preserve_democratic_final_authority_to_democratic_authorship' });
  state = answerAllFacts(state, 'preserve_democratic_final_authority_to_democratic_authorship');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  assert.equal(getSelectedChain(state).status, 'tension');
  assert(getSelectedChain(state).compatibilityIssues.some((issue) => issue.kind === 'mutually_exclusive'));
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'scenario_incompatibility'));
}

{
  let state = createRealWorldState();
  state = startFirstPolicy(state);
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
  state = finishDefeater(state);
  assert.equal(getSelectedChain(state).status, 'complete');
  assert.equal(getSelectedChain(state).terminal.claimId, 'procedural_justification');
}

{
  const state = completeSpeechChain();
  assert.equal(getSelectedChain(state).status, 'complete');
  assert.equal(state.records.speech_restriction.status, 'complete');
  assert.equal(getSelectedChain(state).steps.length, 2);
  assert.equal(getSelectedChain(state).terminal.claimId, 'bodily_security');
  assert.deepEqual(getSelectedChain(state).steps[0].factSensitivity.speech_reduces_serious_assaults, {
    low: 'sufficient',
    high: 'sufficient',
  });
  assert.equal(getSelectedChain(state).defeaterReview.effect, 'none_accepted');
  assert.equal(getSelectedChain(state).matchingStatus, 'active');
  assert.equal(getSelectedChain(state).argumentClosure, 'closed');
  assert(getSelectedChain(state).steps.every((step) => step.formalCheck?.locallyLicensed));
  assert(getSelectedChain(state).steps.every((step) => step.formalCheck?.evidenceStatus === 'established'));
  assert.equal(state.currentChain, null, 'Completed chains must only live in records.');
}

{
  const state = completeSpeechChain({ defeaterEffect: 'offset' });
  assert.equal(state.records.speech_restriction.stance, 'undecided');
  assert.equal(getSelectedChain(state).defeaterReview.argumentId, 'speech_choice_oppose');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'defeater_changed_stance'));
}

{
  const state = completeSpeechChain({ initialStance: 'undecided', direction: 'support', defeaterEffect: 'outweigh' });
  assert.equal(state.records.speech_restriction.stance, 'oppose', 'Reversal must follow the tested chain direction, not the undecided package stance.');
  const retried = act(state, { type: 'RETRY_POLICY' });
  assert.equal(retried.currentTargetClaimId, 'speech_oppose', 'Retry must follow the post-defeater stance.');
}

{
  const state = completeSpeechChain({ defeaterEffect: 'offset' });
  const retried = act(state, { type: 'RETRY_POLICY' });
  assert.equal(retried.phase, PHASES.DIRECTION, 'An offset result must ask for a direction instead of silently reusing the old one.');
}

{
  const state = completeSpeechChain({ assessmentMode: 'conditional_scenario' });
  assert.equal(getSelectedChain(state).status, 'conditional');
  assert.equal(state.records.speech_restriction.hasConditional, true);
  assert.equal(state.assessmentMode, 'conditional_scenario');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'conditional_scenario'));
}

{
  const state = completeSpeechChain({ firstFact: 'false' });
  assert.equal(getSelectedChain(state).status, 'conditional');
  assert.equal(state.records.speech_restriction.status, 'conditional');
  const summary = sessionSummary(state);
  assert.equal(summary.conditionalChains.length, 1);
  assert(summary.tensions.some((item) => item.kind === 'empirical_break'));
}

{
  const state = completeSpeechChain({ stress: 'unexplained_exception' });
  assert.equal(getSelectedChain(state).status, 'tension');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'scope_tension'));
}

{
  const state = completeSpeechChain({ stress: 'qualified_exception' });
  assert.equal(getSelectedChain(state).status, 'tension');
  assert.equal(collectTerminalCommitments(state).length, 0, 'A qualified scope exception must not enter dilemma eligibility.');
  assert(sessionSummary(state).tensions.some((item) => item.kind === 'scope_tension'));
}

{
  const state = completeSpeechChain({ stress: 'qualified_exception' });
  const storedChain = getSelectedChain(state);
  const legacyChain = {
    ...storedChain,
    status: 'complete',
    steps: storedChain.steps.map(({ assessmentMode: _assessmentMode, ...step }) => step),
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
  assert.equal(migrated.currentChain, null);
  assert.equal(getSelectedChain(migrated), null);
  assert.equal(migrated.records.speech_restriction.chains.length, 0, 'Changed proposition meanings must invalidate old chains.');
  assert.equal(migrated.phase, PHASES.POLICY_OVERVIEW);
  assert.match(migrated.migrationNotice, /重新核对/);
  assert.equal(migrated.sessionOverlay.claims.local_claim_legacy.nominatable, true);
}

{
  const migrated = migrateSavedState({
    ...createInitialState(),
    modelVersion: '0.8.1',
    storageVersion: 6,
    phase: PHASES.ARGUMENT,
    startedAt: new Date().toISOString(),
    currentTargetClaimId: 'speech_support',
    currentChain: {
      id: 'legacy_empty_chain',
      policyId: 'speech_restriction',
      direction: 'support',
      targetClaimId: 'speech_support',
      steps: [],
    },
  });
  assert.equal(migrated.currentChain, null, 'A zero-step chain cannot preserve a revised target meaning.');
  assert.match(migrated.migrationNotice, /重新核对/);
}

{
  const argument = argumentsById.majority_morality_law_support_preserve_sacred_moral_continuity_1;
  const baseChain = {
    id: 'legacy_defeater_chain',
    policyId: 'majority_morality_law',
    direction: 'support',
    targetClaimId: argument.targetClaimId,
    steps: [{
      id: 'legacy_defeater_step',
      targetClaimId: argument.targetClaimId,
      argumentId: argument.id,
      factResponses: Object.fromEntries(argument.factIds.map((factId) => [factId, 'true'])),
      factSensitivity: {},
      bridgeClaimId: argument.bridgeClaimId,
      bridgeResponse: 'accept',
      assessmentMode: 'real_world_belief',
    }],
    terminal: { claimId: argument.bridgeClaimId, status: 'provisional_fixed_point' },
    stress: { response: 'apply' },
    scopeConflicts: [],
    compatibilityIssues: [],
    status: 'complete',
    matchingStatus: 'active',
    completedAt: new Date().toISOString(),
  };
  const migrateWithReview = (defeaterReview) => migrateSavedState({
    ...createInitialState(),
    modelVersion: '0.8.1',
    storageVersion: 6,
    phase: PHASES.RESULTS,
    startedAt: new Date().toISOString(),
    selectedChainId: baseChain.id,
    records: {
      majority_morality_law: {
        policyId: 'majority_morality_law',
        direction: 'support',
        stance: 'oppose',
        packageStanceBeforeDefeater: 'support',
        packageStanceAfterDefeater: 'oppose',
        chains: [{ ...baseChain, defeaterReview }],
      },
    },
  });
  const missingArgument = migrateWithReview({
    argumentId: 'expert_referendum_veto_support_preserve_error_correction_2',
    factResponses: {},
    bridgeClaimId: 'preserve_error_correction',
    bridgeResponse: 'accept',
    effect: 'outweigh',
    stanceBefore: 'support',
    stanceAfter: 'oppose',
  });
  assert.equal(getSelectedChain(missingArgument).defeaterReview, null);
  assert.equal(getSelectedChain(missingArgument).matchingStatus, 'inactive');
  assert.equal(missingArgument.records.majority_morality_law.stance, 'support');
  assert.match(missingArgument.migrationNotice, /重新核对/);

  const defeater = argumentsById.majority_morality_law_oppose_protect_adult_moral_autonomy_1;
  const establishedRejected = migrateWithReview({
    argumentId: defeater.id,
    factResponses: Object.fromEntries(defeater.factIds.map((factId) => [factId, 'true'])),
    bridgeClaimId: defeater.bridgeClaimId,
    bridgeResponse: 'accept',
    effect: 'reject',
    stanceBefore: 'support',
    stanceAfter: 'support',
  });
  assert.equal(getSelectedChain(establishedRejected).defeaterReview, null);
  assert.equal(getSelectedChain(establishedRejected).matchingStatus, 'inactive');
}

{
  let state = createRealWorldState();
  state = startFirstPolicy(state);
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
  state = startFirstPolicy(state);
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
  state = answerAllFacts(state, 'speech_harm_support');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'SET_DEPTH', decision: 'deeper' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'severe_harm_to_security' });
  state = answerAllFacts(state, 'severe_harm_to_security');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  state = finishDefeater(state);
  assert.equal(state.records.speech_restriction.activeChainIds.length, 2, 'Multiple valid reasons for one policy must remain active.');
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
  assert.equal(state.fixedPointEvents.find((event) => event.status === 'confirmed').lifecycle, 'orphaned');
  assert.equal(state.fixedPointEvents.find((event) => event.status === 'confirmed').invalidatedByConflictId, state.conflicts[0].id);
  assert.equal(state.conflicts.length, 1);
}

{
  let state = completeSpeechChain();
  const record = state.records.speech_restriction;
  state = {
    ...state,
    phase: PHASES.DEFEATER,
    records: {
      ...state.records,
      speech_restriction: {
        ...record,
        chains: [
          ...record.chains,
          {
            id: 'prior_opposition_chain',
            steps: [{
              factResponses: { speech_scope_noncoercive: 'true' },
              bridgeClaimId: 'protect_nonharmful_choice',
              bridgeResponse: 'reject',
            }],
          },
        ],
      },
    },
  };
  state = act(state, { type: 'SELECT_DEFEATER', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_DEFEATER_FACT', response: 'false' });
  assert.equal(state.phase, PHASES.CONFLICT, 'A defeater fact must use the same conflict index as the main chain.');
  assert.equal(state.pendingConflict.context, 'defeater_fact');
  state = act(state, { type: 'RESOLVE_CONFLICT', resolution: 'keep_prior' });
  assert.equal(state.pendingDefeaterFactResponses.speech_scope_noncoercive, 'true');
  assert.equal(state.phase, PHASES.DEFEATER_BRIDGE);
  state = act(state, { type: 'ANSWER_DEFEATER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.CONFLICT, 'A defeater bridge must use the same conflict index as the main chain.');
  assert.equal(state.pendingConflict.context, 'defeater_bridge');
}

{
  let state = completeSpeechChain({ defeaterEffect: 'supplement' });
  state = {
    ...state,
    currentChain: {
      id: 'retry_after_defeater',
      policyId: 'speech_restriction',
      direction: 'oppose',
      targetClaimId: 'speech_oppose',
      steps: [],
      scopeConflicts: [],
      compatibilityIssues: [],
    },
    currentTargetClaimId: 'speech_oppose',
    currentArgumentId: 'speech_choice_oppose',
    currentFactIndex: 0,
    pendingFactResponses: {},
    phase: PHASES.FACT,
  };
  state = act(state, { type: 'ANSWER_FACT', response: 'false' });
  assert.equal(state.phase, PHASES.CONFLICT, 'A stored defeater answer must constrain later main-chain answers.');
  assert.equal(state.pendingConflict.context, 'main_fact');
}

{
  let state = completeSpeechChain();
  state = { ...state, phase: PHASES.DEFEATER };
  state = act(state, { type: 'SELECT_DEFEATER', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_DEFEATER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_DEFEATER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.DEFEATER_IMPACT);
  const rejected = act(state, { type: 'ANSWER_DEFEATER', effect: 'reject' });
  assert.equal(rejected.phase, PHASES.DEFEATER_IMPACT, 'An established counterargument cannot be relabelled as not accepted.');
}

{
  let state = completeSpeechChain();
  const record = state.records.speech_restriction;
  state = {
    ...state,
    records: {
      ...state.records,
      speech_restriction: {
        ...record,
        chains: record.chains.map((chain) => chain.id === state.selectedChainId ? {
          ...chain,
          defeaterReview: {
            argumentId: 'speech_choice_oppose',
            factResponses: { speech_scope_noncoercive: 'false' },
            bridgeClaimId: 'protect_nonharmful_choice',
            bridgeResponse: 'accept',
            accepted: false,
            effect: 'reject',
            stanceBefore: 'support',
            stanceAfter: 'support',
          },
        } : chain),
      },
    },
    currentChain: {
      id: 'revision_establishes_defeater',
      policyId: 'speech_restriction',
      direction: 'oppose',
      targetClaimId: 'speech_oppose',
      steps: [],
      scopeConflicts: [],
      compatibilityIssues: [],
    },
    currentTargetClaimId: 'speech_oppose',
    currentArgumentId: 'speech_choice_oppose',
    currentFactIndex: 0,
    pendingFactResponses: {},
    phase: PHASES.FACT,
  };
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'RESOLVE_CONFLICT', resolution: 'revise_prior' });
  assert.equal(getSelectedChain(state).defeaterReview, null, 'A revision that establishes a rejected defeater must require a new impact review.');
  assert.equal(getSelectedChain(state).matchingStatus, 'inactive');
}

{
  let state = completeSpeechChain();
  state = act(state, { type: 'RETRY_POLICY' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = answerFact(state, 'true');
  state = answerFact(state, 'true');
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'reject' });
  assert.equal(state.phase, PHASES.CONFLICT, 'Opposite answer to the same bridge should pause the chain.');
  state = act(state, { type: 'RESOLVE_CONFLICT', resolution: 'keep_prior' });
  assert.equal(state.phase, PHASES.DEPTH, 'Keeping the prior accepted bridge should let the current chain continue.');
  assert.equal(state.currentChain.steps.at(-1).bridgeResponse, 'accept');
}

{
  let state = createRealWorldState();
  state = startFirstPolicy(state);
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'NO_ARGUMENT', summary: '缺少基于宗教良心的反对理由。' });
  assert.equal(state.phase, PHASES.POLICY_COMPLETE);
  assert.equal(getSelectedChain(state).status, 'unresolved');
  assert.equal(state.modelGaps.length, 1);
  assert.equal(state.modelGaps[0].summary, '缺少基于宗教良心的反对理由。');
}

{
  let state = createRealWorldState();
  state = act(state, { type: 'START_AT_POLICY', policyId: 'workplace_cogovernance' });
  state = answerComponents(state);
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
  state = finishDefeater(state);
  assert.equal(getSelectedChain(state).status, 'complete');
  assert.equal(getSelectedChain(state).terminal.claimId, 'productive_self_governance');
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
  state = answerComponents(state);
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
  state = finishDefeater(state);
  assert.equal(getSelectedChain(state).status, 'complete');
  assert.equal(getSelectedChain(state).terminal.claimId, 'decentralized_adaptation');
  assert.deepEqual(
    getRelevantDilemmas(['decentralized_adaptation', 'fair_equality_of_opportunity']).map((item) => item.id),
    ['adaptation_vs_opportunity'],
  );
}


{
  let state = createRealWorldState();
  state = startFirstPolicy(state);
  state = act(state, { type: 'SET_STANCE', stance: 'oppose' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_choice_oppose' });
  state = act(state, { type: 'ANSWER_FACT', response: 'true' });
  state = act(state, { type: 'ANSWER_BRIDGE', response: 'accept' });
  assert.equal(state.phase, PHASES.DEPTH);
  state = act(state, { type: 'SET_DEPTH', decision: 'fixed_point' });
  assert.equal(state.phase, PHASES.TERMINAL_CONFIRM, 'Any accepted normative bridge can be nominated.');
  state = act(state, { type: 'CONFIRM_TERMINAL', response: 'accept' });
  assert.equal(state.phase, PHASES.STRESS_REQUIRED, 'A missing stress test must be supplied before the chain can contribute.');
  state = act(state, {
    type: 'SET_CUSTOM_STRESS_TEST',
    scenario: '结构相同但政治对象不同的表达限制案例。',
    question: '这条判断仍然适用吗？',
  });
  assert.equal(state.phase, PHASES.STRESS);
  state = act(state, { type: 'ANSWER_STRESS', response: 'apply' });
  state = finishDefeater(state);
  assert.equal(getSelectedChain(state).status, 'complete');
  assert.equal(getSelectedChain(state).stress.test.source, 'user');
}

{
  let state = createInitialState();
  state = startFirstPolicy(state);
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
  assert.equal(getSelectedChain(state).status, 'unresolved');
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
  const priority = calculatePriority(state);
  assert.equal(priority.unanswered, 0, 'An explicit undecided response is answered, not missing.');
  assert.equal(priority.undecided.length, 1);
  assert.equal(priority.incomparables.length, 0);
}

{
  const contextual = calculatePriority({
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security'],
    dilemmaResponses: { agency_vs_security: { response: 'depends_on_context' } },
  });
  const incomparable = calculatePriority({
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security'],
    dilemmaResponses: { agency_vs_security: { response: 'incomparable' } },
  });
  assert.equal(contextual.contextual.length, 1);
  assert.equal(incomparable.incomparables.length, 1);
  const exported = exportSession({
    ...createInitialState(),
    dilemmaQueue: ['agency_vs_security', 'democracy_vs_agency', 'security_vs_democracy'],
    dilemmaResponses: {
      agency_vs_security: { response: 'depends_on_context' },
      democracy_vs_agency: { response: 'incomparable' },
      security_vs_democracy: { response: 'undecided' },
    },
  });
  assert.deepEqual(exported.analysis.priority.relations.map((relation) => relation.type), ['contextual', 'incomparable', 'undecided']);
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
  assert.equal(state.phase, PHASES.COMPONENTS);
  state = answerComponents(state);
  state = act(state, { type: 'SET_STANCE', stance: 'support' });
  state = act(state, { type: 'SELECT_ARGUMENT', argumentId: 'speech_harm_support' });
  state = answerFact(state, 'true');
  assert.equal(state.currentFactIndex, 1);

  state = act(state, { type: 'OPEN_OVERVIEW' });
  assert.equal(state.records.speech_restriction.draft.phase, PHASES.FACT);
  state = act(state, { type: 'OPEN_POLICY', policyId: 'metadata_surveillance' });
  state = answerComponents(state);
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
