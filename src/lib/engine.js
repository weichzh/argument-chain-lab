import {
  MODEL_META,
  adaptiveAssessment,
  assessmentModes,
  argumentsById,
  claims,
  dilemmas,
  facts,
  formalCertificates,
  getArgumentsForClaim,
  getPolicy,
  getPolicyElements,
  getRelevantDilemmas,
  policies,
} from '../data/model.js';
import {
  evaluateFormalCheck,
  labelDialecticalPair,
  nextCriticalQuestion,
} from './formalValidator.js';
import { selectNextAdaptivePolicy } from './ideology.js';

const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const PHASES = Object.freeze({
  LANDING: 'landing',
  POLICY_OVERVIEW: 'policy_overview',
  COMPONENTS: 'components',
  STANCE: 'stance',
  PACKAGE_TRADEOFF: 'package_tradeoff',
  DIRECTION: 'direction',
  ARGUMENT: 'argument',
  FACT: 'fact',
  FACT_SENSITIVITY: 'fact_sensitivity',
  BRIDGE: 'bridge',
  FORMAL_QUESTION: 'formal_question',
  DEPTH: 'depth',
  TERMINAL_CONFIRM: 'terminal_confirm',
  STRESS_REQUIRED: 'stress_test_required',
  STRESS: 'stress',
  DEFEATER: 'defeater',
  DEFEATER_FACT: 'defeater_fact',
  DEFEATER_BRIDGE: 'defeater_bridge',
  DEFEATER_IMPACT: 'defeater_impact',
  CONFLICT: 'conflict',
  BROKEN: 'broken',
  POLICY_COMPLETE: 'policy_complete',
  DILEMMA_INTRO: 'dilemma_intro',
  DILEMMA: 'dilemma',
  DILEMMA_SENSITIVITY: 'dilemma_sensitivity',
  RESULTS: 'results',
});

export const createInitialState = () => ({
  modelVersion: MODEL_META.version,
  storageVersion: 7,
  assessmentMode: assessmentModes.default || 'real_world_belief',
  adaptiveMode: false,
  migrationNotice: null,
  phase: PHASES.LANDING,
  entryPath: null,
  sessionOverlay: {
    facts: {},
    claims: {},
    arguments: {},
    policies: [],
    dilemmas: [],
  },
  policyIndex: 0,
  records: {},
  currentChain: null,
  selectedChainId: null,
  currentTargetClaimId: null,
  currentArgumentId: null,
  currentFactIndex: 0,
  pendingFactResponses: {},
  pendingFactSensitivity: {},
  pendingSensitivity: null,
  pendingCustomStressTest: null,
  pendingFormalQuestion: null,
  pendingDefeaterArgumentId: null,
  pendingDefeaterFactIndex: 0,
  pendingDefeaterFactResponses: {},
  pendingDefeaterBridgeResponse: null,
  pendingDefeaterFormalResponses: {},
  pendingDefeaterFormalStatus: null,
  pendingConflict: null,
  conflicts: [],
  modelGaps: [],
  fixedPointEvents: [],
  breakReason: null,
  dilemmaQueue: [],
  dilemmaIndex: 0,
  dilemmaResponses: {},
  dilemmaSensitivity: null,
  startedAt: null,
  updatedAt: null,
});

const now = () => new Date().toISOString();

const recordFixedPoint = (state, claimId, status) => ({
  ...state,
  fixedPointEvents: [
    ...(state.fixedPointEvents || []).map((event) => (
      event.chainId === state.currentChain?.id && event.lifecycle !== 'orphaned'
        ? { ...event, lifecycle: 'superseded' }
        : event
    )),
    {
      id: uid('fixed_point'),
      policyId: policies[state.policyIndex]?.id || state.currentChain?.policyId || null,
      chainId: state.currentChain?.id || null,
      claimId,
      status,
      lifecycle: 'active',
      invalidatedByConflictId: null,
      recordedAt: now(),
    },
  ],
});

const ensurePolicyRecord = (state, policyId, patch = {}) => ({
  policyId,
  stance: null,
  direction: null,
  chains: [],
  draft: null,
  status: 'not_started',
  hasComplete: false,
  hasConditional: false,
  hasTension: false,
  hasUnresolved: false,
  mixed: false,
  policyChoiceResponses: {},
  safeguardResponses: {},
  parameterResponses: {},
  elementNotes: {},
  componentTradeoffs: {},
  packageConflict: false,
  tradeoffMode: null,
  packageStanceBeforeDefeater: null,
  packageStanceAfterDefeater: null,
  activeChainIds: [],
  ...state.records[policyId],
  ...patch,
});

const beginChain = (policyId, direction, targetClaimId) => ({
  id: uid('chain'),
  policyId,
  direction,
  targetClaimId,
  steps: [],
  terminal: null,
  stress: null,
  scopeConflicts: [],
  compatibilityIssues: [],
  defeaterReview: null,
  status: 'in_progress',
  argumentClosure: 'in_progress',
  matchingStatus: 'inactive',
  startedAt: now(),
  completedAt: null,
});

const appendStep = (chain, step) => ({
  ...chain,
  steps: [...chain.steps, step],
});

const responseSummary = (responses) => {
  const values = Object.values(responses);
  return {
    allTrue: values.length > 0 && values.every((value) => value === 'true'),
    hasFalse: values.includes('false'),
    hasUnknown: values.includes('unknown'),
  };
};

const formalCheckFor = (
  argument,
  factResponses,
  bridgeResponse,
  criticalQuestionResponses = {},
  dialecticalStatus = null,
) => evaluateFormalCheck(
  formalCertificates[argument?.id],
  argument?.formalization,
  factResponses,
  bridgeResponse,
  {
    modelVersion: MODEL_META.version,
    criticalQuestionResponses,
    dialecticalStatus,
  },
);

const refreshFormalChecks = (chain) => ({
  ...chain,
  steps: (chain.steps || []).map((step) => ({
    ...step,
    formalCheck: formalCheckFor(
      argumentsById[step.argumentId],
      step.factResponses,
      step.bridgeResponse,
      step.formalQuestionResponses,
      step.dialecticalStatus,
    ),
  })),
});

const classifyChain = (chain) => {
  if (!chain?.terminal || chain.terminal.status !== 'provisional_fixed_point') return 'unresolved';
  if (!chain.stress) return 'unresolved';
  if (['unexplained_exception', 'qualified_exception'].includes(chain.stress?.response)) return 'tension';
  if (chain.scopeConflicts?.length) return 'tension';
  if (chain.compatibilityIssues?.length) return 'tension';
  if (chain.stress?.response === 'retract' || chain.stress?.response === 'uncertain') return 'unresolved';

  const factValues = chain.steps.flatMap((step) => Object.values(step.factResponses || {}));
  const allBridgesAccepted = chain.steps.every((step) => step.bridgeResponse === 'accept');
  if (!allBridgesAccepted) return 'unresolved';
  if (factValues.some((value) => value !== 'true')) return 'conditional';
  if (chain.steps.some((step) => step.assessmentMode === 'conditional_scenario')) return 'conditional';
  return 'complete';
};

const matchingStatusFor = (chain, status = chain?.status) => {
  if (!['complete', 'conditional'].includes(status)) return 'inactive';
  if (!chain?.defeaterReview) return 'inactive';
  if (['offset', 'outweigh'].includes(chain?.defeaterReview?.effect || chain?.defeaterReview?.impact)) return 'boundary';
  return 'active';
};

const classifyStoredChain = (chain) => {
  const checked = refreshFormalChecks(chain);
  const status = classifyChain(checked);
  const stepChecks = checked.steps.map((step) => step.formalCheck);
  const formalStatus = stepChecks.every((check) => check?.inferenceStatus === 'not_formalized')
    ? 'not_formalized'
    : stepChecks.length && stepChecks.every((check) => (
      check?.wellFormed && check?.locallyLicensed && !check.errors?.length
    )) ? 'qualified' : 'error';
  const evidenceStatus = stepChecks.some((check) => check?.evidenceStatus === 'rejected')
    ? 'rejected'
    : stepChecks.every((check) => check?.evidenceStatus === 'established') ? 'established' : 'undetermined';
  const scopeStatus = stepChecks.some((check) => check?.scopeStatus === 'overreach')
    ? 'overreach'
    : 'within_scope';
  const dialecticalStatus = formalStatus === 'not_formalized'
    ? 'not_evaluated'
    : stepChecks.some((check) => check?.dialecticalStatus === 'rejected')
    ? 'rejected'
    : stepChecks.some((check) => check?.dialecticalStatus === 'undecided') ? 'undecided' : 'accepted';
  return {
    ...checked,
    status,
    commitmentClosure: status === 'complete' ? 'closed' : status,
    formalStatus,
    evidenceStatus,
    scopeStatus,
    dialecticalStatus,
    packageJudgment: checked.defeaterReview?.stanceAfter || checked.direction || null,
    argumentClosure: status === 'complete' ? 'closed' : status,
    matchingStatus: formalStatus === 'qualified' && dialecticalStatus === 'accepted'
      ? matchingStatusFor(chain, status)
      : 'inactive',
  };
};

const classifyRecordStatus = (chains) => (
  chains.some((item) => item.status === 'complete')
    ? 'complete'
    : chains.some((item) => item.status === 'tension')
      ? 'tension'
      : chains.some((item) => item.status === 'conditional')
        ? 'conditional'
        : chains.some((item) => item.status === 'unresolved')
          ? 'unresolved'
          : 'in_progress'
);

const recordStatusFlags = (chains) => {
  const statuses = new Set(chains.map((chain) => chain.status));
  return {
    hasComplete: statuses.has('complete'),
    hasConditional: statuses.has('conditional'),
    hasTension: statuses.has('tension'),
    hasUnresolved: statuses.has('unresolved'),
    mixed: statuses.size > 1,
  };
};

const summarizeRecord = (record, chains = record.chains || []) => ({
  ...record,
  chains,
  status: record.draft ? 'in_progress' : classifyRecordStatus(chains),
  ...recordStatusFlags(chains),
  activeChainIds: chains.filter((chain) => chain.matchingStatus === 'active').map((chain) => chain.id),
});

const factAnswersFromChains = (chains) => {
  const answers = new Map();
  chains.forEach((chain) => chain.steps?.forEach((step) => {
    Object.entries(step.factResponses || {}).forEach(([factId, response]) => {
      const values = answers.get(factId) || new Set();
      values.add(response);
      answers.set(factId, values);
    });
  }));
  return answers;
};

const applyCompatibility = (records, currentChain = null) => {
  const storedChains = Object.values(records).flatMap((record) => record.chains || []);
  const allChains = currentChain ? [...storedChains, currentChain] : storedChains;
  const answers = factAnswersFromChains(allChains);
  const reviseChain = (chain) => {
    const issues = [];
    const trueFacts = new Set(chain.steps?.flatMap((step) => Object.entries(step.factResponses || {})
      .filter(([, response]) => response === 'true')
      .map(([factId]) => factId)) || []);
    trueFacts.forEach((factId) => {
      const fact = facts[factId];
      (fact?.mutuallyExclusiveWith || []).forEach((otherId) => {
        if (answers.get(otherId)?.has('true')) issues.push({ kind: 'mutually_exclusive', factId, otherId });
      });
      (fact?.dependsOn || []).forEach((dependencyId) => {
        if (answers.get(dependencyId)?.has('false')) issues.push({ kind: 'dependency_rejected', factId, dependencyId });
      });
    });
    const unique = [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()];
    const revised = { ...chain, compatibilityIssues: unique };
    return chain.completedAt ? classifyStoredChain(revised) : revised;
  };
  const nextRecords = Object.fromEntries(Object.entries(records).map(([policyId, record]) => {
    const chains = (record.chains || []).map(reviseChain);
    return [policyId, summarizeRecord(record, chains)];
  }));
  return { records: nextRecords, currentChain: currentChain ? reviseChain(currentChain) : currentChain };
};

const visitSteps = (state, visitor) => {
  Object.values(state.records).forEach((record) => {
    record.chains.forEach((chain) => chain.steps.forEach((step) => visitor(step, chain, record)));
  });
  state.currentChain?.steps.forEach((step) => visitor(step, state.currentChain, null));
};

const priorResponses = (state, kind, propositionId) => {
  const found = new Set();
  visitSteps(state, (step) => {
    if (kind === 'fact' && Object.prototype.hasOwnProperty.call(step.factResponses || {}, propositionId)) {
      found.add(step.factResponses[propositionId]);
    }
    if (kind === 'bridge' && step.bridgeClaimId === propositionId) found.add(step.bridgeResponse);
  });
  const visitDefeater = (chain) => {
    const review = chain?.defeaterReview;
    if (!review) return;
    if (kind === 'fact' && Object.hasOwn(review.factResponses || {}, propositionId)) {
      found.add(review.factResponses[propositionId]);
    }
    if (kind === 'bridge' && review.bridgeClaimId === propositionId) found.add(review.bridgeResponse);
  };
  Object.values(state.records).forEach((record) => record.chains.forEach(visitDefeater));
  visitDefeater(state.currentChain);
  return [...found];
};

const isDecisiveConflict = (kind, previous, attempted) => {
  const decisive = kind === 'fact' ? ['true', 'false'] : ['accept', 'reject'];
  if (!decisive.includes(attempted)) return false;
  const prior = previous.filter((response) => decisive.includes(response));
  return prior.length > 0 && (new Set(prior).size > 1 || !prior.includes(attempted));
};

const replacePriorResponses = (state, kind, propositionId, response, conflictId) => {
  const affectedChainIds = new Set();
  const replaceStep = (step) => {
    if (kind === 'fact' && Object.prototype.hasOwnProperty.call(step.factResponses || {}, propositionId)) {
      return {
        ...step,
        factResponses: { ...step.factResponses, [propositionId]: response },
      };
    }
    if (kind === 'bridge' && step.bridgeClaimId === propositionId) return { ...step, bridgeResponse: response };
    return step;
  };

  const replaceDefeater = (chain) => {
    const review = chain.defeaterReview;
    if (!review) return { chain, changed: false };
    const changesFact = kind === 'fact' && Object.hasOwn(review.factResponses || {}, propositionId);
    const changesBridge = kind === 'bridge' && review.bridgeClaimId === propositionId;
    if (!changesFact && !changesBridge) return { chain, changed: false };
    const revised = {
      ...review,
      factResponses: changesFact
        ? { ...review.factResponses, [propositionId]: response }
        : review.factResponses,
      bridgeResponse: changesBridge ? response : review.bridgeResponse,
    };
    const argument = argumentsById[review.argumentId];
    const established = Boolean(argument)
      && argument.factIds.every((factId) => revised.factResponses?.[factId] === 'true')
      && revised.bridgeResponse === 'accept';
    if (established && (revised.effect || revised.impact) === 'reject') {
      return {
        chain: { ...chain, defeaterReview: null },
        changed: true,
        stanceAfter: revised.stanceBefore,
      };
    }
    if (!established && !['reject', 'none_accepted'].includes(revised.effect || revised.impact)) {
      revised.accepted = false;
      revised.effect = 'reject';
      revised.stanceAfter = revised.stanceBefore;
    }
    return {
      chain: { ...chain, defeaterReview: revised },
      changed: true,
      stanceAfter: revised.stanceAfter,
    };
  };

  const records = Object.fromEntries(Object.entries(state.records).map(([policyId, record]) => {
    let revisedStance = null;
    const chains = record.chains.map((chain) => {
      const affected = chain.steps.some((step) => (
        kind === 'fact'
          ? Object.prototype.hasOwnProperty.call(step.factResponses || {}, propositionId)
          : step.bridgeClaimId === propositionId
      ));
      const defeater = replaceDefeater(chain);
      if (affected || defeater.changed) affectedChainIds.add(chain.id);
      if (defeater.changed) revisedStance = defeater.stanceAfter;
      const revised = { ...defeater.chain, steps: chain.steps.map(replaceStep) };
      return classifyStoredChain(revised);
    });
    const nextRecord = revisedStance
      ? { ...record, stance: revisedStance, packageStanceAfterDefeater: revisedStance }
      : record;
    return [policyId, summarizeRecord(nextRecord, chains)];
  }));

  const currentDefeater = state.currentChain ? replaceDefeater(state.currentChain).chain : state.currentChain;
  const currentChain = currentDefeater
    ? { ...currentDefeater, steps: currentDefeater.steps.map(replaceStep) }
    : currentDefeater;

  const compatible = applyCompatibility(records, currentChain);
  return {
    ...state,
    ...compatible,
    fixedPointEvents: (state.fixedPointEvents || []).map((event) => (
      affectedChainIds.has(event.chainId) && event.lifecycle === 'active'
        ? { ...event, lifecycle: 'orphaned', invalidatedByConflictId: conflictId || null }
        : event
    )),
  };
};

const applyFactAnswer = (state, response) => {
  const argument = argumentsById[state.currentArgumentId];
  if (!argument) return state;
  const factId = argument.factIds[state.currentFactIndex];
  const pendingFactResponses = {
    ...state.pendingFactResponses,
    [factId]: response,
  };
  const nextIndex = state.currentFactIndex + 1;
  return {
    ...state,
    pendingFactResponses,
    currentFactIndex: nextIndex,
    pendingSensitivity: null,
    phase: nextIndex >= argument.factIds.length ? PHASES.BRIDGE : PHASES.FACT,
    updatedAt: now(),
  };
};

const applyBridgeAnswer = (state, response) => {
  const argument = argumentsById[state.currentArgumentId];
  if (!argument || !state.currentChain) return state;
  const step = {
    id: uid('step'),
    targetClaimId: state.currentTargetClaimId,
    argumentId: argument.id,
    factResponses: state.pendingFactResponses,
    factSensitivity: state.pendingFactSensitivity,
    bridgeClaimId: argument.bridgeClaimId,
    bridgeResponse: response,
    formalQuestionResponses: {},
    dialecticalStatus: null,
    formalCheck: formalCheckFor(argument, state.pendingFactResponses, response),
    assessmentMode: state.assessmentMode,
    createdAt: now(),
  };
  const currentChain = appendStep(state.currentChain, step);
  if (response !== 'accept') {
    return {
      ...state,
      currentChain,
      breakReason: response === 'reject'
        ? '你不接受这条从事实走向结论所需要的价值原则。'
        : '你暂时无法判断这条从事实走向结论所需要的价值原则。',
      phase: PHASES.BROKEN,
      updatedAt: now(),
    };
  }
  const bridgeClaim = claims[argument.bridgeClaimId];
  const nextPhase = bridgeClaim?.kind === 'terminal' ? PHASES.TERMINAL_CONFIRM : PHASES.DEPTH;
  const question = step.formalCheck.evidenceStatus === 'established'
    ? nextCriticalQuestion(formalCertificates[argument.id], argument.formalization)
    : null;
  return {
    ...state,
    currentChain,
    breakReason: null,
    pendingFormalQuestion: question ? {
      context: 'main',
      stepId: step.id,
      argumentId: argument.id,
      criticalQuestionId: question.id,
      prompt: question.prompt || question.label,
      attackKind: question.attackKind,
      nextPhase,
    } : null,
    phase: question ? PHASES.FORMAL_QUESTION : nextPhase,
    updatedAt: now(),
  };
};

const applyDefeaterFactAnswer = (state, response) => {
  const argument = argumentsById[state.pendingDefeaterArgumentId];
  const factId = argument?.factIds?.[state.pendingDefeaterFactIndex];
  if (!argument || !factId) return state;
  const nextIndex = state.pendingDefeaterFactIndex + 1;
  return {
    ...state,
    pendingDefeaterFactIndex: nextIndex,
    pendingDefeaterFactResponses: {
      ...state.pendingDefeaterFactResponses,
      [factId]: response,
    },
    phase: nextIndex >= argument.factIds.length ? PHASES.DEFEATER_BRIDGE : PHASES.DEFEATER_FACT,
    updatedAt: now(),
  };
};

const applyDefeaterBridgeAnswer = (state, response) => {
  const argument = argumentsById[state.pendingDefeaterArgumentId];
  if (!argument) return state;
  const check = formalCheckFor(argument, state.pendingDefeaterFactResponses, response);
  const question = response === 'accept' && check.evidenceStatus === 'established'
    ? nextCriticalQuestion(formalCertificates[argument.id], argument.formalization)
    : null;
  return {
    ...state,
    pendingDefeaterBridgeResponse: response,
    pendingDefeaterFormalResponses: {},
    pendingDefeaterFormalStatus: argument.formalization
      ? question ? 'in_progress' : check.dialecticalStatus === 'accepted' ? 'qualified' : 'unresolved'
      : 'not_formalized',
    pendingFormalQuestion: question ? {
      context: 'defeater',
      argumentId: argument.id,
      criticalQuestionId: question.id,
      prompt: question.prompt || question.label,
      attackKind: question.attackKind,
      nextPhase: PHASES.DEFEATER_IMPACT,
    } : null,
    phase: question ? PHASES.FORMAL_QUESTION : PHASES.DEFEATER_IMPACT,
    updatedAt: now(),
  };
};

const finalizeCurrentChain = (state, stress) => {
  const policy = policies[state.policyIndex];
  const chainWithStress = {
    ...state.currentChain,
    stress,
    completedAt: now(),
  };
  const chain = classifyStoredChain(chainWithStress);
  const record = ensurePolicyRecord(state, policy.id);
  const chains = [...record.chains, chain];
  const compatible = applyCompatibility({
    ...state.records,
    [policy.id]: summarizeRecord({ ...record, draft: null }, chains),
  });
  const stored = compatible.records[policy.id].chains.find((item) => item.id === chain.id);
  return {
    ...state,
    records: compatible.records,
    currentChain: null,
    selectedChainId: chain.id,
    currentTargetClaimId: null,
    currentArgumentId: null,
    pendingCustomStressTest: null,
    pendingFormalQuestion: null,
    pendingDefeaterArgumentId: null,
    phase: ['complete', 'conditional'].includes(stored?.status) ? PHASES.DEFEATER : PHASES.POLICY_COMPLETE,
    updatedAt: now(),
  };
};

const finalizeAsUnresolved = (state, reason) => {
  const policy = policies[state.policyIndex];
  const chain = {
    ...(state.currentChain || beginChain(policy.id, state.records[policy.id]?.direction || 'undecided', null)),
    status: 'unresolved',
    argumentClosure: 'unresolved',
    matchingStatus: 'inactive',
    unresolvedReason: reason,
    completedAt: now(),
  };
  const record = ensurePolicyRecord(state, policy.id);
  const chains = [...record.chains, chain];
  const nextRecords = {
    ...state.records,
    [policy.id]: summarizeRecord({ ...record, draft: null }, chains),
  };
  return {
    ...state,
    records: nextRecords,
    currentChain: null,
    selectedChainId: chain.id,
    currentTargetClaimId: null,
    currentArgumentId: null,
    phase: PHASES.POLICY_COMPLETE,
    updatedAt: now(),
  };
};

const updateStoredChain = (state, chainId, update) => {
  let selected = null;
  const records = Object.fromEntries(Object.entries(state.records).map(([policyId, record]) => {
    const chains = (record.chains || []).map((chain) => {
      if (chain.id !== chainId) return chain;
      selected = typeof update === 'function' ? update(chain) : { ...chain, ...update };
      return selected;
    });
    return [policyId, summarizeRecord(record, chains.map((chain) => (
      chain.completedAt ? classifyStoredChain(chain) : chain
    )))];
  }));
  return selected ? { ...state, records } : state;
};

const responseFieldForKind = {
  policy_choice: 'policyChoiceResponses',
  safeguard: 'safeguardResponses',
  parameter: 'parameterResponses',
};

const interactivePolicyElements = (policy) => getPolicyElements(policy, [
  'policy_choice',
  'safeguard',
  'parameter',
]);

const policyElementsComplete = (policy, record) => interactivePolicyElements(policy).every((element) => (
  record[responseFieldForKind[element.kind]]?.[element.id]
));

const startPolicy = (state, index) => {
  const policy = policies[index];
  if (!policy) {
    return {
      ...state,
      phase: PHASES.DILEMMA_INTRO,
      currentChain: null,
      currentTargetClaimId: null,
      currentArgumentId: null,
      updatedAt: now(),
    };
  }
  const record = ensurePolicyRecord(state, policy.id, {
    status: state.records[policy.id]?.status || 'in_progress',
  });
  const elements = interactivePolicyElements(policy);
  return {
    ...state,
    policyIndex: index,
    phase: elements.length && !policyElementsComplete(policy, record) ? PHASES.COMPONENTS : PHASES.STANCE,
    currentChain: null,
    selectedChainId: null,
    currentTargetClaimId: null,
    currentArgumentId: null,
    currentFactIndex: 0,
    pendingFactResponses: {},
    pendingFactSensitivity: {},
    pendingSensitivity: null,
    pendingCustomStressTest: null,
    pendingFormalQuestion: null,
    pendingDefeaterArgumentId: null,
    pendingDefeaterFactIndex: 0,
    pendingDefeaterFactResponses: {},
    pendingDefeaterBridgeResponse: null,
    pendingDefeaterFormalResponses: {},
    pendingDefeaterFormalStatus: null,
    pendingConflict: null,
    breakReason: null,
    records: {
      ...state.records,
      [policy.id]: record,
    },
    updatedAt: now(),
  };
};

const DRAFT_PHASES = new Set([
  PHASES.COMPONENTS,
  PHASES.STANCE,
  PHASES.PACKAGE_TRADEOFF,
  PHASES.DIRECTION,
  PHASES.ARGUMENT,
  PHASES.FACT,
  PHASES.FACT_SENSITIVITY,
  PHASES.BRIDGE,
  PHASES.FORMAL_QUESTION,
  PHASES.DEPTH,
  PHASES.TERMINAL_CONFIRM,
  PHASES.STRESS_REQUIRED,
  PHASES.STRESS,
  PHASES.DEFEATER,
  PHASES.DEFEATER_FACT,
  PHASES.DEFEATER_BRIDGE,
  PHASES.DEFEATER_IMPACT,
  PHASES.CONFLICT,
  PHASES.BROKEN,
]);

const stashCurrentDraft = (state) => {
  const policy = policies[state.policyIndex];
  if (!policy || !DRAFT_PHASES.has(state.phase)) return state;
  const record = ensurePolicyRecord(state, policy.id);
  return {
    ...state,
    records: {
      ...state.records,
      [policy.id]: {
        ...record,
        draft: {
          phase: state.phase,
          currentChain: state.currentChain,
          selectedChainId: state.selectedChainId,
          currentTargetClaimId: state.currentTargetClaimId,
          currentArgumentId: state.currentArgumentId,
          currentFactIndex: state.currentFactIndex,
          pendingFactResponses: state.pendingFactResponses,
          pendingFactSensitivity: state.pendingFactSensitivity,
          pendingSensitivity: state.pendingSensitivity,
          pendingCustomStressTest: state.pendingCustomStressTest,
          pendingFormalQuestion: state.pendingFormalQuestion,
          pendingDefeaterArgumentId: state.pendingDefeaterArgumentId,
          pendingDefeaterFactIndex: state.pendingDefeaterFactIndex,
          pendingDefeaterFactResponses: state.pendingDefeaterFactResponses,
          pendingDefeaterBridgeResponse: state.pendingDefeaterBridgeResponse,
          pendingDefeaterFormalResponses: state.pendingDefeaterFormalResponses,
          pendingDefeaterFormalStatus: state.pendingDefeaterFormalStatus,
          pendingConflict: state.pendingConflict,
          breakReason: state.breakReason,
        },
        status: 'in_progress',
      },
    },
  };
};

const openPolicy = (state, policyIndex) => {
  const stashed = stashCurrentDraft(state);
  const policy = policies[policyIndex];
  const record = stashed.records[policy.id];
  if (record?.draft) {
    return {
      ...stashed,
      policyIndex,
      ...record.draft,
      updatedAt: now(),
    };
  }
  const records = record?.chains?.length
    ? {
        ...stashed.records,
        [policy.id]: { ...record, stance: null, direction: null },
      }
    : stashed.records;
  return startPolicy({ ...stashed, records }, policyIndex);
};

const startDirection = (state, direction) => {
  const policy = policies[state.policyIndex];
  const targetClaimId = direction === 'support' ? policy.supportClaimId : policy.opposeClaimId;
  const record = ensurePolicyRecord(state, policy.id, { direction, status: 'in_progress' });
  return {
    ...state,
    records: { ...state.records, [policy.id]: record },
    currentChain: beginChain(policy.id, direction, targetClaimId),
    selectedChainId: null,
    currentTargetClaimId: targetClaimId,
    currentArgumentId: null,
    currentFactIndex: 0,
    pendingFactResponses: {},
    pendingFactSensitivity: {},
    pendingSensitivity: null,
    pendingCustomStressTest: null,
    pendingFormalQuestion: null,
    pendingDefeaterArgumentId: null,
    pendingDefeaterFactIndex: 0,
    pendingDefeaterFactResponses: {},
    pendingDefeaterBridgeResponse: null,
    pendingDefeaterFormalResponses: {},
    pendingDefeaterFormalStatus: null,
    pendingConflict: null,
    breakReason: null,
    phase: PHASES.ARGUMENT,
    updatedAt: now(),
  };
};

export const canNominateClaim = (claim) => ['bridge', 'terminal'].includes(claim?.kind);
const isAssessmentMode = (mode) => typeof assessmentModes[mode] === 'object';

export const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_ASSESSMENT_MODE':
      if (Object.keys(state.records).length || !isAssessmentMode(action.mode)) return state;
      return { ...state, assessmentMode: action.mode, updatedAt: now() };

    case 'START':
      return startPolicy({
        ...createInitialState(),
        assessmentMode: state.assessmentMode,
        entryPath: 'bank',
        startedAt: now(),
      }, 0);

    case 'START_OVERVIEW':
      return {
        ...createInitialState(),
        assessmentMode: state.assessmentMode,
        entryPath: 'bank',
        adaptiveMode: false,
        phase: PHASES.POLICY_OVERVIEW,
        startedAt: now(),
        updatedAt: now(),
      };

    case 'START_ADAPTIVE': {
      const base = {
        ...state,
        adaptiveMode: true,
        entryPath: 'adaptive',
        startedAt: state.startedAt || now(),
        updatedAt: now(),
      };
      const policy = selectNextAdaptivePolicy(base);
      if (!policy) return { ...base, phase: PHASES.DILEMMA_INTRO };
      return startPolicy(base, policies.findIndex((item) => item.id === policy.id));
    }

    case 'NEXT_ADAPTIVE': {
      const policy = selectNextAdaptivePolicy(state);
      if (!policy) {
        return {
          ...state,
          phase: PHASES.DILEMMA_INTRO,
          currentChain: null,
          selectedChainId: null,
          updatedAt: now(),
        };
      }
      return startPolicy(state, policies.findIndex((item) => item.id === policy.id));
    }

    case 'OPEN_OVERVIEW': {
      const next = stashCurrentDraft(state);
      return { ...next, phase: PHASES.POLICY_OVERVIEW, updatedAt: now() };
    }

    case 'OPEN_POLICY': {
      const policyIndex = policies.findIndex((policy) => policy.id === action.policyId);
      if (policyIndex < 0) return state;
      return openPolicy({ ...state, migrationNotice: null }, policyIndex);
    }

    case 'EXIT_TO_LANDING': {
      const next = stashCurrentDraft(state);
      return { ...next, phase: PHASES.LANDING, updatedAt: now() };
    }

    case 'START_AT_POLICY': {
      const policyIndex = policies.findIndex((policy) => policy.id === action.policyId);
      if (policyIndex < 0) return state;
      return startPolicy(
        {
          ...createInitialState(),
          assessmentMode: state.assessmentMode,
          entryPath: 'bank',
          sessionOverlay: state.sessionOverlay,
          startedAt: now(),
        },
        policyIndex,
      );
    }

    case 'SET_SESSION_OVERLAY':
      return {
        ...state,
        sessionOverlay: action.overlay,
        updatedAt: now(),
      };

    case 'START_FROM_CANDIDATE': {
      const policyIndex = policies.findIndex((policy) => policy.id === action.policyId);
      if (policyIndex < 0) return state;
      const initial = startPolicy(
        {
          ...createInitialState(),
          assessmentMode: state.assessmentMode,
          entryPath: 'custom',
          sessionOverlay: state.sessionOverlay,
          startedAt: now(),
        },
        policyIndex,
      );
      const directed = startDirection(initial, action.direction);
      const argument = argumentsById[action.argumentId];
      if (!argument || argument.targetClaimId !== directed.currentTargetClaimId) return directed;
      return {
        ...directed,
        currentArgumentId: argument.id,
        phase: argument.factIds.length ? PHASES.FACT : PHASES.BRIDGE,
        updatedAt: now(),
      };
    }

    case 'USE_CANDIDATE_ARGUMENT': {
      const argument = argumentsById[action.argumentId];
      if (!argument || argument.targetClaimId !== state.currentTargetClaimId) return state;
      return {
        ...state,
        currentArgumentId: argument.id,
        currentFactIndex: 0,
        pendingFactResponses: {},
        pendingFactSensitivity: {},
        pendingSensitivity: null,
        pendingConflict: null,
        breakReason: null,
        phase: argument.factIds.length ? PHASES.FACT : PHASES.BRIDGE,
        updatedAt: now(),
      };
    }

    case 'SET_COMPONENT_POSITION':
    case 'SET_POLICY_ELEMENT_RESPONSE': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      const elementId = action.elementId || action.componentId;
      const response = action.response || action.position;
      const element = interactivePolicyElements(policy).find((item) => item.id === elementId);
      const allowed = {
        policy_choice: ['support', 'oppose', 'conditional', 'undecided'],
        safeguard: ['required', 'preferred', 'not_required', 'uncertain'],
        parameter: ['accept', 'adjust', 'reject', 'uncertain'],
      }[element?.kind] || [];
      if (!element || !allowed.includes(response)) return state;
      const field = responseFieldForKind[element.kind];
      return {
        ...state,
        records: {
          ...state.records,
          [policy.id]: {
            ...record,
            [field]: { ...record[field], [element.id]: response },
            status: 'in_progress',
          },
        },
        updatedAt: now(),
      };
    }

    case 'SET_POLICY_ELEMENT_NOTE': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      const element = interactivePolicyElements(policy).find((item) => item.id === action.elementId);
      if (!element) return state;
      const note = typeof action.note === 'string' ? action.note.trim().slice(0, 400) : '';
      return {
        ...state,
        records: {
          ...state.records,
          [policy.id]: {
            ...record,
            elementNotes: { ...record.elementNotes, [element.id]: note || null },
          },
        },
        updatedAt: now(),
      };
    }

    case 'COMPLETE_COMPONENTS': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      if (!policyElementsComplete(policy, record)) return state;
      const positions = Object.values(record.policyChoiceResponses || {});
      const packageConflict = positions.includes('support') && positions.includes('oppose');
      return {
        ...state,
        records: {
          ...state.records,
          [policy.id]: { ...record, packageConflict, status: 'in_progress' },
        },
        phase: PHASES.STANCE,
        updatedAt: now(),
      };
    }

    case 'SET_STANCE': {
      const policy = policies[state.policyIndex];
      const stance = action.stance;
      const record = ensurePolicyRecord(state, policy.id, {
        stance,
        packageStanceBeforeDefeater: stance,
        packageStanceAfterDefeater: null,
        status: 'in_progress',
      });
      const next = { ...state, records: { ...state.records, [policy.id]: record }, updatedAt: now() };
      if (record.packageConflict) return { ...next, phase: PHASES.PACKAGE_TRADEOFF };
      if (stance === 'support' || stance === 'oppose') return startDirection(next, stance);
      if (stance === 'undecided') return { ...next, phase: PHASES.DIRECTION };
      return next;
    }

    case 'SET_COMPONENT_TRADEOFF': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      if (!getPolicyElements(policy, ['policy_choice']).some((component) => component.id === action.componentId)) return state;
      if (!['required', 'tradeable', 'neutral'].includes(action.position)) return state;
      return {
        ...state,
        records: {
          ...state.records,
          [policy.id]: {
            ...record,
            componentTradeoffs: { ...record.componentTradeoffs, [action.componentId]: action.position },
          },
        },
        updatedAt: now(),
      };
    }

    case 'COMPLETE_PACKAGE_TRADEOFF': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id, { tradeoffMode: action.mode || 'specified' });
      const next = { ...state, records: { ...state.records, [policy.id]: record }, updatedAt: now() };
      if (record.stance === 'support' || record.stance === 'oppose') return startDirection(next, record.stance);
      return { ...next, phase: PHASES.DIRECTION };
    }

    case 'SET_DIRECTION':
      return startDirection(state, action.direction);

    case 'SKIP_POLICY':
      return finalizeAsUnresolved(state, action.reason || '用户暂不形成政策判断。');

    case 'SELECT_ARGUMENT': {
      const argument = argumentsById[action.argumentId];
      if (!argument || argument.targetClaimId !== state.currentTargetClaimId) return state;
      return {
        ...state,
        currentArgumentId: argument.id,
        currentFactIndex: 0,
        pendingFactResponses: {},
        pendingFactSensitivity: {},
        pendingSensitivity: null,
        pendingConflict: null,
        breakReason: null,
        phase: argument.factIds.length ? PHASES.FACT : PHASES.BRIDGE,
        updatedAt: now(),
      };
    }

    case 'NO_ARGUMENT': {
      const summary = typeof action.summary === 'string' ? action.summary.trim().slice(0, 400) : '';
      const gap = {
        id: uid('gap'),
        policyId: policies[state.policyIndex]?.id || null,
        chainId: state.currentChain?.id || null,
        targetClaimId: state.currentTargetClaimId,
        summary: summary || null,
        createdAt: now(),
      };
      return finalizeAsUnresolved(
        {
          ...state,
          modelGaps: [...(state.modelGaps || []), gap],
        },
        '题库列出的理由都不符合你的实际想法。系统会记录这个题库缺口，不会替你选择一条价值原则。',
      );
    }

    case 'ANSWER_FACT': {
      const argument = argumentsById[state.currentArgumentId];
      if (!argument) return state;
      const factId = argument.factIds[state.currentFactIndex];
      const previousResponses = priorResponses(state, 'fact', factId);
      if (isDecisiveConflict('fact', previousResponses, action.response)) {
        return {
          ...state,
          pendingConflict: {
            id: uid('conflict'),
            context: 'main_fact',
            kind: 'fact',
            propositionId: factId,
            previousResponses,
            attemptedResponse: action.response,
            policyId: policies[state.policyIndex]?.id || null,
            chainId: state.currentChain?.id || null,
            createdAt: now(),
          },
          phase: PHASES.CONFLICT,
          updatedAt: now(),
        };
      }
      const fact = facts[factId];
      if (fact?.sensitivity?.scenarios?.length) {
        return {
          ...state,
          pendingFactResponses: { ...state.pendingFactResponses, [factId]: action.response },
          pendingSensitivity: { kind: 'fact', factId, index: 0 },
          phase: PHASES.FACT_SENSITIVITY,
          updatedAt: now(),
        };
      }
      return applyFactAnswer(state, action.response);
    }

    case 'ANSWER_FACT_SENSITIVITY': {
      const pending = state.pendingSensitivity;
      const fact = facts[pending?.factId];
      const scenarios = fact?.sensitivity?.scenarios || [];
      const scenario = scenarios[pending?.index];
      if (pending?.kind !== 'fact' || !scenario || !['sufficient', 'insufficient', 'uncertain'].includes(action.response)) return state;
      const pendingFactSensitivity = {
        ...state.pendingFactSensitivity,
        [fact.id]: {
          ...(state.pendingFactSensitivity[fact.id] || {}),
          [scenario.id]: action.response,
        },
      };
      const nextIndex = pending.index + 1;
      const next = {
        ...state,
        pendingFactSensitivity,
        pendingSensitivity: nextIndex < scenarios.length ? { ...pending, index: nextIndex } : null,
        updatedAt: now(),
      };
      return nextIndex < scenarios.length
        ? next
        : applyFactAnswer(next, state.pendingFactResponses[fact.id]);
    }

    case 'ANSWER_BRIDGE': {
      const argument = argumentsById[state.currentArgumentId];
      if (!argument || !state.currentChain) return state;
      const bridgeClaimId = argument.bridgeClaimId;
      const previousResponses = priorResponses(state, 'bridge', bridgeClaimId);
      if (isDecisiveConflict('bridge', previousResponses, action.response)) {
        return {
          ...state,
          pendingConflict: {
            id: uid('conflict'),
            context: 'main_bridge',
            kind: 'bridge',
            propositionId: bridgeClaimId,
            previousResponses,
            attemptedResponse: action.response,
            policyId: policies[state.policyIndex]?.id || null,
            chainId: state.currentChain?.id || null,
            createdAt: now(),
          },
          phase: PHASES.CONFLICT,
          updatedAt: now(),
        };
      }
      return applyBridgeAnswer(state, action.response);
    }

    case 'ANSWER_FORMAL_QUESTION': {
      const pending = state.pendingFormalQuestion;
      if (!pending || !['satisfied', 'defeated', 'unknown'].includes(action.response)) return state;
      const argument = argumentsById[pending.argumentId];
      if (!argument?.formalization) return state;

      if (pending.context === 'main') {
        const step = state.currentChain?.steps.find((item) => item.id === pending.stepId);
        if (!step) return state;
        const responses = {
          ...(step.formalQuestionResponses || {}),
          [pending.criticalQuestionId]: action.response,
        };
        const formalCheck = formalCheckFor(
          argument,
          step.factResponses,
          step.bridgeResponse,
          responses,
        );
        const currentChain = {
          ...state.currentChain,
          steps: state.currentChain.steps.map((item) => item.id === step.id ? {
            ...item,
            formalQuestionResponses: responses,
            formalCheck,
          } : item),
        };
        if (action.response === 'defeated') {
          return {
            ...state,
            currentChain,
            pendingFormalQuestion: null,
            breakReason: '这项反例或例外击败了当前推理；请换一条理由或修订立场。',
            phase: PHASES.BROKEN,
            updatedAt: now(),
          };
        }
        const question = action.response === 'satisfied'
          ? nextCriticalQuestion(formalCertificates[argument.id], argument.formalization, responses)
          : null;
        return {
          ...state,
          currentChain,
          pendingFormalQuestion: question ? {
            ...pending,
            criticalQuestionId: question.id,
            prompt: question.prompt || question.label,
            attackKind: question.attackKind,
          } : null,
          phase: question ? PHASES.FORMAL_QUESTION : pending.nextPhase,
          updatedAt: now(),
        };
      }

      if (pending.context === 'defeater') {
        const responses = {
          ...(state.pendingDefeaterFormalResponses || {}),
          [pending.criticalQuestionId]: action.response,
        };
        const question = action.response === 'satisfied'
          ? nextCriticalQuestion(formalCertificates[argument.id], argument.formalization, responses)
          : null;
        return {
          ...state,
          pendingDefeaterFormalResponses: responses,
          pendingDefeaterFormalStatus: action.response === 'defeated'
            ? 'defeated'
            : action.response === 'unknown' ? 'unresolved' : question ? 'in_progress' : 'qualified',
          pendingFormalQuestion: question ? {
            ...pending,
            criticalQuestionId: question.id,
            prompt: question.prompt || question.label,
            attackKind: question.attackKind,
          } : null,
          phase: question ? PHASES.FORMAL_QUESTION : pending.nextPhase,
          updatedAt: now(),
        };
      }
      return state;
    }

    case 'RESOLVE_CONFLICT': {
      const conflict = state.pendingConflict;
      if (!conflict) return state;
      const decisive = conflict.kind === 'fact' ? ['true', 'false'] : ['accept', 'reject'];
      const priorDecisive = conflict.previousResponses.filter((response) => decisive.includes(response));
      const stablePrior = new Set(priorDecisive).size === 1 ? priorDecisive[0] : null;
      const suspended = conflict.kind === 'fact' ? 'unknown' : 'uncertain';
      let answer = conflict.attemptedResponse;
      let next = { ...state, pendingConflict: null };

      if (action.resolution === 'revise_prior') {
        next = replacePriorResponses(next, conflict.kind, conflict.propositionId, conflict.attemptedResponse, conflict.id);
      } else if (action.resolution === 'keep_prior') {
        answer = stablePrior || suspended;
      } else if (action.resolution === 'suspend') {
        next = replacePriorResponses(next, conflict.kind, conflict.propositionId, suspended, conflict.id);
        answer = suspended;
      } else if (action.resolution === 'scope_gap') {
        const marker = {
          conflictId: conflict.id,
          kind: conflict.kind,
          propositionId: conflict.propositionId,
          createdAt: now(),
        };
        if (next.currentChain) {
          next = {
            ...next,
            currentChain: {
              ...next.currentChain,
              scopeConflicts: [...(next.currentChain.scopeConflicts || []), marker],
            },
          };
        } else if (conflict.chainId) {
          next = updateStoredChain(next, conflict.chainId, (chain) => ({
            ...chain,
            scopeConflicts: [...(chain.scopeConflicts || []), marker],
          }));
        }
      } else {
        return state;
      }

      const conflictRecord = {
        ...conflict,
        resolution: action.resolution,
        appliedResponse: answer,
        resolvedAt: now(),
      };
      next = {
        ...next,
        conflicts: [...(next.conflicts || []), conflictRecord],
        updatedAt: now(),
      };

      if (conflict.context === 'defeater_fact') return applyDefeaterFactAnswer(next, answer);
      if (conflict.context === 'defeater_bridge') return applyDefeaterBridgeAnswer(next, answer);
      return conflict.kind === 'fact' ? applyFactAnswer(next, answer) : applyBridgeAnswer(next, answer);
    }

    case 'SET_DEPTH': {
      const lastStep = state.currentChain?.steps.at(-1);
      if (!lastStep) return state;
      const bridgeClaimId = lastStep.bridgeClaimId;
      if (action.decision === 'fixed_point') {
        if (!canNominateClaim(claims[bridgeClaimId])) return state;
        return {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: {
              claimId: bridgeClaimId,
              status: 'terminal_candidate',
              nominatedAt: now(),
              confirmedAt: null,
            },
          },
          phase: PHASES.TERMINAL_CONFIRM,
          updatedAt: now(),
        };
      }
      if (action.decision === 'deeper') {
        return {
          ...state,
          currentTargetClaimId: bridgeClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
          pendingFactSensitivity: {},
          pendingSensitivity: null,
          phase: PHASES.ARGUMENT,
          updatedAt: now(),
        };
      }
      return finalizeAsUnresolved(state, '你暂时无法判断这条价值原则是否可以直接作为基础，也没有选择继续追问。');
    }

    case 'CONFIRM_TERMINAL': {
      const lastStep = state.currentChain?.steps.at(-1);
      const candidateClaimId = state.currentChain?.terminal?.claimId || lastStep?.bridgeClaimId;
      if (!lastStep || !candidateClaimId) return state;
      if (action.response === 'accept') {
        const recorded = recordFixedPoint(state, candidateClaimId, 'confirmed');
        const hasStressTest = Boolean(claims[candidateClaimId]?.stressTest);
        return {
          ...recorded,
          currentChain: {
            ...recorded.currentChain,
            terminal: {
              ...(recorded.currentChain.terminal || {}),
              claimId: candidateClaimId,
              status: 'provisional_fixed_point',
              confirmedAt: now(),
            },
          },
          pendingCustomStressTest: null,
          phase: hasStressTest ? PHASES.STRESS : PHASES.STRESS_REQUIRED,
          updatedAt: now(),
        };
      }
      if (action.response === 'continue') {
        const recorded = recordFixedPoint(state, candidateClaimId, 'rejected');
        return {
          ...recorded,
          currentChain: {
            ...recorded.currentChain,
            terminal: null,
          },
          currentTargetClaimId: candidateClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
          pendingFactSensitivity: {},
          pendingSensitivity: null,
          breakReason: null,
          phase: PHASES.ARGUMENT,
          updatedAt: now(),
        };
      }
      if (action.response === 'reject') {
        const recorded = recordFixedPoint(state, candidateClaimId, 'rejected');
        return {
          ...recorded,
          currentChain: {
            ...recorded.currentChain,
            terminal: {
              ...(recorded.currentChain.terminal || {}),
              claimId: candidateClaimId,
              status: 'rejected_as_fixed_point',
              confirmedAt: null,
            },
          },
          breakReason: '你接受了上一层价值原则，但不愿把它直接作为基础，同时也没有给出更深的价值理由。因此这条理由链仍未完成。',
          phase: PHASES.BROKEN,
          updatedAt: now(),
        };
      }
      const recorded = recordFixedPoint(state, candidateClaimId, 'unconfirmed');
      return finalizeAsUnresolved(
        {
          ...recorded,
          currentChain: {
            ...recorded.currentChain,
            terminal: {
              ...(recorded.currentChain.terminal || {}),
              claimId: candidateClaimId,
              status: 'unconfirmed',
              confirmedAt: null,
            },
          },
        },
        '用户无法确认这条原则是独立的规范起点，而不是暂时想不到更深理由。',
      );
    }

    case 'SET_CUSTOM_STRESS_TEST': {
      if (!state.currentChain?.terminal) return state;
      const scenario = typeof action.scenario === 'string' ? action.scenario.trim().slice(0, 1200) : '';
      const question = typeof action.question === 'string' ? action.question.trim().slice(0, 800) : '';
      if (!scenario || !question) return state;
      return {
        ...state,
        pendingCustomStressTest: { scenario, question, source: action.source || 'user' },
        phase: PHASES.STRESS,
        updatedAt: now(),
      };
    }

    case 'MISSING_STRESS_TEST':
      return finalizeAsUnresolved(state, '这条规范原则尚无可检查的相似案例，补足压力测试前不能作为有效固定点。');

    case 'ANSWER_STRESS': {
      if (!state.currentChain?.terminal) return state;
      if (action.response === 'retract') {
        const recorded = recordFixedPoint(state, state.currentChain.terminal.claimId, 'retracted');
        return {
          ...recorded,
          currentChain: {
            ...recorded.currentChain,
            terminal: {
              ...recorded.currentChain.terminal,
              status: 'retracted_after_stress',
            },
          },
          breakReason: '相似案例使你撤回了这项暂定基础价值，因此这条理由链不再算作完成。',
          phase: PHASES.BROKEN,
          updatedAt: now(),
        };
      }
      if (action.response === 'uncertain') {
        return finalizeAsUnresolved(
          {
            ...state,
            currentChain: {
              ...state.currentChain,
              stress: { response: 'uncertain', distinction: null, answeredAt: now() },
            },
          },
          '在结构相似的案例中，你暂时无法判断这条原则是否仍然适用。',
        );
      }
      const stress = {
        response: action.response,
        distinction: action.distinction || null,
        test: state.pendingCustomStressTest || claims[state.currentChain.terminal.claimId]?.stressTest || null,
        answeredAt: now(),
      };
      return finalizeCurrentChain(state, stress);
    }

    case 'SELECT_DEFEATER': {
      const chain = Object.values(state.records).flatMap((record) => record.chains || [])
        .find((item) => item.id === state.selectedChainId);
      const policy = getPolicy(chain?.policyId);
      const oppositeClaimId = chain?.direction === 'support' ? policy?.opposeClaimId : policy?.supportClaimId;
      const argument = argumentsById[action.argumentId];
      if (!chain || !argument || argument.targetClaimId !== oppositeClaimId) return state;
      return {
        ...state,
        pendingDefeaterArgumentId: argument.id,
        pendingDefeaterFactIndex: 0,
        pendingDefeaterFactResponses: {},
        pendingDefeaterBridgeResponse: null,
        pendingDefeaterFormalResponses: {},
        pendingDefeaterFormalStatus: null,
        pendingFormalQuestion: null,
        phase: argument.factIds.length ? PHASES.DEFEATER_FACT : PHASES.DEFEATER_BRIDGE,
        updatedAt: now(),
      };
    }

    case 'ANSWER_DEFEATER_FACT': {
      if (!['true', 'false', 'unknown'].includes(action.response)) return state;
      const argument = argumentsById[state.pendingDefeaterArgumentId];
      const factId = argument?.factIds?.[state.pendingDefeaterFactIndex];
      if (!argument || !factId) return state;
      const previousResponses = priorResponses(state, 'fact', factId);
      if (isDecisiveConflict('fact', previousResponses, action.response)) {
        return {
          ...state,
          pendingConflict: {
            id: uid('conflict'),
            context: 'defeater_fact',
            kind: 'fact',
            propositionId: factId,
            previousResponses,
            attemptedResponse: action.response,
            policyId: policies[state.policyIndex]?.id || null,
            chainId: state.selectedChainId,
            createdAt: now(),
          },
          phase: PHASES.CONFLICT,
          updatedAt: now(),
        };
      }
      return applyDefeaterFactAnswer(state, action.response);
    }

    case 'ANSWER_DEFEATER_BRIDGE': {
      if (!['accept', 'reject', 'uncertain'].includes(action.response)) return state;
      const argument = argumentsById[state.pendingDefeaterArgumentId];
      if (!argument) return state;
      const previousResponses = priorResponses(state, 'bridge', argument.bridgeClaimId);
      if (isDecisiveConflict('bridge', previousResponses, action.response)) {
        return {
          ...state,
          pendingConflict: {
            id: uid('conflict'),
            context: 'defeater_bridge',
            kind: 'bridge',
            propositionId: argument.bridgeClaimId,
            previousResponses,
            attemptedResponse: action.response,
            policyId: policies[state.policyIndex]?.id || null,
            chainId: state.selectedChainId,
            createdAt: now(),
          },
          phase: PHASES.CONFLICT,
          updatedAt: now(),
        };
      }
      return applyDefeaterBridgeAnswer(state, action.response);
    }

    case 'NO_DEFEATER_ACCEPTED': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      const before = record.packageStanceBeforeDefeater || record.stance;
      const next = updateStoredChain(state, state.selectedChainId, (chain) => ({
        ...chain,
        defeaterReview: {
          argumentId: null,
          accepted: false,
          effect: 'none_accepted',
          stanceBefore: before,
          stanceAfter: before,
          reviewedAt: now(),
        },
      }));
      return {
        ...next,
        records: {
          ...next.records,
          [policy.id]: {
            ...next.records[policy.id],
            packageStanceAfterDefeater: before,
          },
        },
        pendingDefeaterArgumentId: null,
        pendingDefeaterFactIndex: 0,
        pendingDefeaterFactResponses: {},
        pendingDefeaterBridgeResponse: null,
        pendingDefeaterFormalResponses: {},
        pendingDefeaterFormalStatus: null,
        pendingFormalQuestion: null,
        phase: PHASES.POLICY_COMPLETE,
        updatedAt: now(),
      };
    }

    case 'ANSWER_DEFEATER': {
      const legacyEffects = { unchanged: 'supplement', weakened: 'offset', reversed: 'outweigh', rejected: 'reject' };
      const effect = legacyEffects[action.effect || action.impact] || action.effect || action.impact;
      if (!['supplement', 'weaken', 'offset', 'outweigh', 'reject'].includes(effect)) return state;
      const argument = argumentsById[state.pendingDefeaterArgumentId];
      if (!argument) return state;
      const premisesAccepted = argument.factIds.every((factId) => state.pendingDefeaterFactResponses[factId] === 'true');
      const formalResolved = !argument.formalization || state.pendingDefeaterFormalStatus === 'qualified';
      const established = premisesAccepted && state.pendingDefeaterBridgeResponse === 'accept' && formalResolved;
      if (effect === 'reject' && established) return state;
      if (effect !== 'reject' && !established) return state;
      const selectedChain = Object.values(state.records).flatMap((record) => record.chains || [])
        .find((chain) => chain.id === state.selectedChainId);
      if (!selectedChain?.steps?.length) return state;
      const policy = policies[state.policyIndex];
      const currentRecord = ensurePolicyRecord(state, policy.id);
      const before = currentRecord.packageStanceBeforeDefeater || currentRecord.stance || selectedChain?.direction;
      const after = effect === 'offset'
        ? 'undecided'
        : effect === 'outweigh'
          ? selectedChain?.direction === 'support' ? 'oppose' : 'support'
          : before;
      const mainArgumentId = selectedChain?.steps?.[0]?.argumentId;
      const labels = labelDialecticalPair(mainArgumentId, argument.id, effect);
      const defeaterFormalCheck = formalCheckFor(
        argument,
        state.pendingDefeaterFactResponses,
        state.pendingDefeaterBridgeResponse,
        state.pendingDefeaterFormalResponses,
        labels[argument.id],
      );
      const next = updateStoredChain(state, state.selectedChainId, (chain) => ({
        ...chain,
        steps: chain.steps.map((step) => step.argumentId === mainArgumentId
          ? { ...step, dialecticalStatus: labels[mainArgumentId] }
          : step),
        defeaterReview: {
          argumentId: argument.id,
          factResponses: state.pendingDefeaterFactResponses,
          bridgeClaimId: argument.bridgeClaimId,
          bridgeResponse: state.pendingDefeaterBridgeResponse,
          formalQuestionResponses: state.pendingDefeaterFormalResponses,
          formalCheck: defeaterFormalCheck,
          accepted: effect !== 'reject' && established,
          effect,
          stanceBefore: before,
          stanceAfter: after,
          reviewedAt: now(),
        },
      }));
      const record = ensurePolicyRecord(next, policy.id);
      return {
        ...next,
        records: {
          ...next.records,
          [policy.id]: {
            ...record,
            stance: after,
            packageStanceBeforeDefeater: before,
            packageStanceAfterDefeater: after,
          },
        },
        pendingDefeaterArgumentId: null,
        pendingDefeaterFactIndex: 0,
        pendingDefeaterFactResponses: {},
        pendingDefeaterBridgeResponse: null,
        pendingDefeaterFormalResponses: {},
        pendingDefeaterFormalStatus: null,
        pendingFormalQuestion: null,
        phase: PHASES.POLICY_COMPLETE,
        updatedAt: now(),
      };
    }

    case 'RESOLVE_BREAK': {
      if (action.resolution === 'alternate_argument') {
        const lastStep = state.currentChain?.steps.at(-1);
        const shouldDropLast = Boolean(
          lastStep && (
            lastStep.bridgeResponse !== 'accept'
            || state.currentChain?.terminal?.status === 'retracted_after_stress'
          )
        );
        const retryTargetClaimId = shouldDropLast
          ? lastStep?.targetClaimId
          : state.currentChain?.terminal?.status === 'rejected_as_fixed_point'
            ? lastStep?.bridgeClaimId
            : lastStep?.targetClaimId;
        const currentChain = state.currentChain
          ? {
              ...state.currentChain,
              steps: shouldDropLast ? state.currentChain.steps.slice(0, -1) : state.currentChain.steps,
              terminal: null,
              stress: null,
              status: 'in_progress',
            }
          : state.currentChain;
        return {
          ...state,
          currentChain,
          currentTargetClaimId: retryTargetClaimId || state.currentTargetClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
          pendingFactSensitivity: {},
          pendingSensitivity: null,
          breakReason: null,
          phase: PHASES.ARGUMENT,
          updatedAt: now(),
        };
      }
      if (action.resolution === 'revise_stance') {
        const policy = policies[state.policyIndex];
        return {
          ...state,
          records: {
            ...state.records,
            [policy.id]: ensurePolicyRecord(state, policy.id, {
              stance: null,
              direction: null,
              status: 'in_progress',
            }),
          },
          currentChain: null,
          currentTargetClaimId: null,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
          pendingFactSensitivity: {},
          pendingSensitivity: null,
          breakReason: null,
          phase: PHASES.STANCE,
          updatedAt: now(),
        };
      }
      return finalizeAsUnresolved(state, state.breakReason || '当前论证链无法继续。');
    }

    case 'RETRY_POLICY': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      const direction = record.packageStanceAfterDefeater || record.stance;
      const next = {
        ...state,
        records: {
          ...state.records,
          [policy.id]: { ...record, draft: null, direction: null, status: 'in_progress' },
        },
        currentChain: null,
        selectedChainId: null,
        currentTargetClaimId: null,
        currentArgumentId: null,
        breakReason: null,
        updatedAt: now(),
      };
      return ['support', 'oppose'].includes(direction)
        ? startDirection(next, direction)
        : { ...next, phase: PHASES.DIRECTION };
    }

    case 'NEXT_POLICY':
      return startPolicy(state, state.policyIndex + 1);

    case 'START_DILEMMAS': {
      const terminalIds = collectTerminalCommitments(state).map((item) => item.claimId);
      const selected = getRelevantDilemmas(terminalIds).slice(0, adaptiveAssessment.dilemmaMax || 1);
      return {
        ...state,
        dilemmaQueue: selected.map((item) => item.id),
        dilemmaIndex: 0,
        dilemmaSensitivity: null,
        phase: selected.length ? PHASES.DILEMMA : PHASES.RESULTS,
        updatedAt: now(),
      };
    }

    case 'RESUME_DILEMMAS':
      return {
        ...state,
        phase: state.dilemmaSensitivity
          ? PHASES.DILEMMA_SENSITIVITY
          : state.dilemmaQueue[state.dilemmaIndex] ? PHASES.DILEMMA : PHASES.RESULTS,
        updatedAt: now(),
      };

    case 'ANSWER_DILEMMA': {
      const allowed = ['left_strong', 'left_slight', 'equal', 'depends_on_context', 'incomparable', 'undecided', 'right_slight', 'right_strong'];
      if (!allowed.includes(action.response)) return state;
      const dilemmaId = state.dilemmaQueue[state.dilemmaIndex];
      if (!dilemmaId) return { ...state, phase: PHASES.RESULTS, updatedAt: now() };
      const item = dilemmas.find((entry) => entry.id === dilemmaId);
      const dilemmaResponses = {
        ...state.dilemmaResponses,
        [dilemmaId]: {
          response: action.response,
          answeredAt: now(),
        },
      };
      if (item?.sensitivity?.scenarios?.length) {
        return {
          ...state,
          dilemmaResponses,
          dilemmaSensitivity: { dilemmaId, index: 0 },
          phase: PHASES.DILEMMA_SENSITIVITY,
          updatedAt: now(),
        };
      }
      const nextIndex = state.dilemmaIndex + 1;
      return {
        ...state,
        dilemmaResponses,
        dilemmaIndex: nextIndex,
        phase: nextIndex >= state.dilemmaQueue.length ? PHASES.RESULTS : PHASES.DILEMMA,
        updatedAt: now(),
      };
    }

    case 'ANSWER_DILEMMA_SENSITIVITY': {
      const pending = state.dilemmaSensitivity;
      const item = dilemmas.find((entry) => entry.id === pending?.dilemmaId);
      const scenarios = item?.sensitivity?.scenarios || [];
      const scenario = scenarios[pending?.index];
      const allowed = ['left_strong', 'left_slight', 'equal', 'depends_on_context', 'incomparable', 'undecided', 'right_slight', 'right_strong'];
      if (!scenario || !allowed.includes(action.response)) return state;
      const current = state.dilemmaResponses[pending.dilemmaId] || {};
      const dilemmaResponses = {
        ...state.dilemmaResponses,
        [pending.dilemmaId]: {
          ...current,
          sensitivity: { ...(current.sensitivity || {}), [scenario.id]: action.response },
        },
      };
      const nextScenario = pending.index + 1;
      if (nextScenario < scenarios.length) {
        return {
          ...state,
          dilemmaResponses,
          dilemmaSensitivity: { ...pending, index: nextScenario },
          updatedAt: now(),
        };
      }
      const nextIndex = state.dilemmaIndex + 1;
      return {
        ...state,
        dilemmaResponses,
        dilemmaSensitivity: null,
        dilemmaIndex: nextIndex,
        phase: nextIndex >= state.dilemmaQueue.length ? PHASES.RESULTS : PHASES.DILEMMA,
        updatedAt: now(),
      };
    }

    case 'SHOW_RESULTS':
      return { ...stashCurrentDraft(state), phase: PHASES.RESULTS, updatedAt: now() };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
};

export const migrateSavedState = (state) => {
  if (![4, 5, 6, 7].includes(state?.storageVersion)) return null;
  if (!['0.7.0', '0.7.1', '0.8.0', '0.8.1', '0.8.2', MODEL_META.version].includes(state.modelVersion)) return null;
  const legacyRealWorld = state.modelVersion === '0.7.0';
  const upgrading = state.modelVersion !== MODEL_META.version;
  const revisedIds = new Set([
    'speech_no_equal_alternative',
    'surveillance_no_equal_targeted_method',
    'carbon_no_equal_alternative',
    'punishment_desert_scenario_scope',
    'speech_support',
    'surveillance_support',
    'income_support',
    'carbon_support',
    'workplace_cogovernance_support',
    'education_opportunity_support',
    'emergency_powers_support',
    'equal_citizenship_ancestry_support',
    'prevent_severe_harm',
    'speech_correction_oppose',
    'punishment_desert_support_internalize_enterprise_created_risk_2',
    'expert_referendum_veto_support_preserve_error_correction_2',
    'minimum_social_insurance_oppose_protect_local_land_autonomy_3',
    'natural_monopoly_ownership_oppose_protect_local_land_autonomy_3',
    'parental_education_exemption_support_protect_local_land_autonomy_3',
  ]);
  const invalidatedChainIds = new Set();
  const invalidatedDefeaterChainIds = new Set();
  const migrationArguments = { ...argumentsById, ...(state.sessionOverlay?.arguments || {}) };
  const migrationClaims = { ...claims, ...(state.sessionOverlay?.claims || {}) };
  let invalidatedProgress = false;
  const referencesRevision = (value) => upgrading && revisedIds.has(value);
  const legacyDefeaterEffect = {
    unchanged: 'supplement',
    weakened: 'offset',
    reversed: 'outweigh',
    rejected: 'reject',
  };
  const chainCompatible = (chain) => {
    if ([chain?.targetClaimId, chain?.terminal?.claimId].some(referencesRevision)) return false;
    if (chain?.targetClaimId && !migrationClaims[chain.targetClaimId]) return false;
    if (chain?.terminal?.claimId && !migrationClaims[chain.terminal.claimId]) return false;
    return (chain?.steps || []).every((step) => {
      const argument = migrationArguments[step.argumentId];
      const factIds = Object.keys(step.factResponses || {});
      return argument
        && ![step.argumentId, step.targetClaimId, step.bridgeClaimId, ...factIds].some(referencesRevision)
        && step.targetClaimId === argument.targetClaimId
        && step.bridgeClaimId === argument.bridgeClaimId
        && factIds.length === argument.factIds.length
        && argument.factIds.every((factId) => factIds.includes(factId));
    });
  };
  const defeaterReviewCompatible = (review) => {
    if (!review) return true;
    const effect = legacyDefeaterEffect[review.effect || review.impact] || review.effect || review.impact;
    if (!review.argumentId) return effect === 'none_accepted';
    const argument = migrationArguments[review.argumentId];
    const factIds = Object.keys(review.factResponses || {});
    if (!argument
      || [review.argumentId, review.bridgeClaimId, ...factIds].some(referencesRevision)
      || review.bridgeClaimId !== argument.bridgeClaimId
      || factIds.length !== argument.factIds.length
      || !argument.factIds.every((factId) => factIds.includes(factId))) return false;
    const established = argument.factIds.every((factId) => review.factResponses[factId] === 'true')
      && review.bridgeResponse === 'accept';
    if (effect === 'reject') return !established;
    return established && ['supplement', 'weaken', 'offset', 'outweigh'].includes(effect);
  };
  const flowCompatible = (flow, migratedChain = flow?.currentChain) => {
    if (!flow) return true;
    if (flow.currentChain && !migratedChain) return false;
    if (flow.selectedChainId && invalidatedChainIds.has(flow.selectedChainId)) return false;
    const pendingFormal = flow.pendingFormalQuestion;
    if (Boolean(pendingFormal) !== (flow.phase === PHASES.FORMAL_QUESTION)) return false;
    if (pendingFormal) {
      const validQuestion = formalCertificates[pendingFormal.argumentId]?.criticalQuestions
        ?.some((question) => question.id === pendingFormal.criticalQuestionId);
      const validContext = pendingFormal.context === 'main'
        ? migratedChain?.steps?.some((step) => step.id === pendingFormal.stepId)
        : pendingFormal.context === 'defeater'
          && flow.pendingDefeaterArgumentId === pendingFormal.argumentId;
      if (!validQuestion || !validContext) return false;
    }
    const references = [
      flow.currentTargetClaimId,
      flow.currentArgumentId,
      flow.pendingDefeaterArgumentId,
      flow.pendingConflict?.propositionId,
      ...Object.keys(flow.pendingFactResponses || {}),
      ...Object.keys(flow.pendingDefeaterFactResponses || {}),
    ];
    if (references.some(referencesRevision)) return false;
    if (flow.currentArgumentId && !migrationArguments[flow.currentArgumentId]) return false;
    if (flow.pendingDefeaterArgumentId && !migrationArguments[flow.pendingDefeaterArgumentId]) return false;
    return true;
  };
  const migrateChain = (chain) => {
    if (!chain) return chain;
    if (!chainCompatible(chain)) {
      if (chain.id) invalidatedChainIds.add(chain.id);
      return null;
    }
    const keepReview = defeaterReviewCompatible(chain.defeaterReview);
    if (chain.defeaterReview && !keepReview) {
      invalidatedProgress = true;
      if (chain.id) invalidatedDefeaterChainIds.add(chain.id);
    }
    const review = keepReview && chain.defeaterReview
      ? {
          ...chain.defeaterReview,
          effect: legacyDefeaterEffect[chain.defeaterReview.effect || chain.defeaterReview.impact]
            || chain.defeaterReview.effect
            || chain.defeaterReview.impact,
          factResponses: chain.defeaterReview.factResponses || {},
          bridgeResponse: chain.defeaterReview.bridgeResponse || (chain.defeaterReview.accepted ? 'accept' : null),
        }
      : null;
    const revised = {
      ...chain,
      compatibilityIssues: chain.compatibilityIssues || [],
      defeaterReview: review,
      steps: (chain.steps || []).map((step) => ({
        ...step,
        assessmentMode: step.assessmentMode || (legacyRealWorld ? 'real_world_belief' : state.assessmentMode) || 'real_world_belief',
        factSensitivity: step.factSensitivity || {},
        formalQuestionResponses: step.formalQuestionResponses || {},
        dialecticalStatus: step.dialecticalStatus || null,
      })),
    };
    return revised.completedAt ? classifyStoredChain(revised) : revised;
  };
  const records = Object.fromEntries(Object.entries(state.records || {}).map(([policyId, record]) => {
    const chains = (record.chains || []).map(migrateChain).filter(Boolean);
    const policy = getPolicy(policyId);
    const legacyPositions = record.componentPositions || {};
    const migratedResponses = {
      policyChoiceResponses: { ...(record.policyChoiceResponses || {}) },
      safeguardResponses: { ...(record.safeguardResponses || {}) },
      parameterResponses: { ...(record.parameterResponses || {}) },
    };
    interactivePolicyElements(policy).forEach((element) => {
      const value = legacyPositions[element.id];
      if (!value) return;
      const field = responseFieldForKind[element.kind];
      migratedResponses[field][element.id] = element.kind === 'safeguard'
        ? ({ support: 'required', oppose: 'not_required', conditional: 'preferred', undecided: 'uncertain' }[value] || value)
        : element.kind === 'parameter'
          ? ({ support: 'accept', oppose: 'reject', conditional: 'adjust', undecided: 'uncertain' }[value] || value)
          : value;
    });
    const { componentPositions: _componentPositions, postDefeaterStance, ...recordWithoutLegacy } = record;
    const migratedDraftChain = migrateChain(record.draft?.currentChain);
    const keepDraft = record.draft && flowCompatible(record.draft, migratedDraftChain);
    if (record.draft && !keepDraft) invalidatedProgress = true;
    const reviewInvalidated = [...(record.chains || []), record.draft?.currentChain]
      .some((chain) => invalidatedDefeaterChainIds.has(chain?.id));
    const stanceBeforeDefeater = record.packageStanceBeforeDefeater || record.direction || record.stance || null;
    const migratedRecord = {
      ...ensurePolicyRecord({ records: {} }, policyId),
      ...recordWithoutLegacy,
      ...migratedResponses,
      elementNotes: record.elementNotes || {},
      chains,
      draft: keepDraft
        ? {
            ...record.draft,
            currentChain: migratedDraftChain,
            pendingFactSensitivity: record.draft.pendingFactSensitivity || {},
            pendingSensitivity: record.draft.pendingSensitivity || null,
            pendingCustomStressTest: record.draft.pendingCustomStressTest || null,
            pendingFormalQuestion: record.draft.pendingFormalQuestion || null,
            pendingDefeaterArgumentId: record.draft.pendingDefeaterArgumentId || null,
            pendingDefeaterFactIndex: record.draft.pendingDefeaterFactIndex || 0,
            pendingDefeaterFactResponses: record.draft.pendingDefeaterFactResponses || {},
            pendingDefeaterBridgeResponse: record.draft.pendingDefeaterBridgeResponse || null,
            pendingDefeaterFormalResponses: record.draft.pendingDefeaterFormalResponses || {},
            pendingDefeaterFormalStatus: record.draft.pendingDefeaterFormalStatus || null,
          }
        : null,
      componentTradeoffs: record.componentTradeoffs || {},
      packageConflict: Boolean(record.packageConflict),
      packageStanceBeforeDefeater: record.packageStanceBeforeDefeater || record.direction || record.stance || null,
      packageStanceAfterDefeater: reviewInvalidated
        ? stanceBeforeDefeater
        : record.packageStanceAfterDefeater || postDefeaterStance || null,
      stance: reviewInvalidated ? stanceBeforeDefeater : record.stance,
    };
    return [policyId, summarizeRecord(migratedRecord, chains)];
  }));
  const sessionOverlay = {
    ...state.sessionOverlay,
    claims: Object.fromEntries(Object.entries(state.sessionOverlay?.claims || {}).map(([claimId, claim]) => [
      claimId,
      claim.kind === 'policy' ? claim : { ...claim, nominatable: true },
    ])),
  };

  const migratedCurrent = migrateChain(state.currentChain);
  const keepCurrentFlow = flowCompatible(state, migratedCurrent);
  if (!keepCurrentFlow && (state.currentChain || state.currentArgumentId || state.pendingDefeaterArgumentId)) {
    invalidatedProgress = true;
  }
  const invalidatedOldWork = invalidatedProgress || invalidatedChainIds.size > 0;
  const duplicateCompleted = migratedCurrent?.completedAt && Object.values(records)
    .some((record) => record.chains.some((chain) => chain.id === migratedCurrent.id));
  const compatible = applyCompatibility(records, duplicateCompleted ? null : migratedCurrent);
  return {
    ...createInitialState(),
    ...state,
    storageVersion: 7,
    modelVersion: MODEL_META.version,
    assessmentMode: legacyRealWorld
      ? 'real_world_belief'
      : isAssessmentMode(state.assessmentMode) ? state.assessmentMode : assessmentModes.default || 'real_world_belief',
    migrationNotice: invalidatedOldWork
      ? '题库中的部分命题含义已更新；相关旧版理由链需要重新核对，其他回答已保留。'
      : null,
    sessionOverlay,
    records: compatible.records,
    currentChain: keepCurrentFlow ? compatible.currentChain : null,
    selectedChainId: keepCurrentFlow
      ? duplicateCompleted ? migratedCurrent.id : state.selectedChainId || null
      : null,
    currentTargetClaimId: keepCurrentFlow ? state.currentTargetClaimId : null,
    currentArgumentId: keepCurrentFlow ? state.currentArgumentId : null,
    currentFactIndex: keepCurrentFlow ? state.currentFactIndex || 0 : 0,
    pendingFactResponses: keepCurrentFlow ? state.pendingFactResponses || {} : {},
    pendingConflict: keepCurrentFlow ? state.pendingConflict || null : null,
    breakReason: keepCurrentFlow ? state.breakReason || null : null,
    fixedPointEvents: (state.fixedPointEvents || []).filter((event) => (
      !invalidatedChainIds.has(event.chainId)
    )).map((event) => ({
      ...event,
      lifecycle: event.lifecycle || 'active',
      invalidatedByConflictId: event.invalidatedByConflictId || null,
    })),
    pendingFactSensitivity: keepCurrentFlow ? state.pendingFactSensitivity || {} : {},
    pendingSensitivity: keepCurrentFlow ? state.pendingSensitivity || null : null,
    pendingCustomStressTest: keepCurrentFlow ? state.pendingCustomStressTest || null : null,
    pendingFormalQuestion: keepCurrentFlow ? state.pendingFormalQuestion || null : null,
    pendingDefeaterArgumentId: keepCurrentFlow ? state.pendingDefeaterArgumentId || null : null,
    pendingDefeaterFactIndex: keepCurrentFlow && state.storageVersion >= 6 ? state.pendingDefeaterFactIndex || 0 : 0,
    pendingDefeaterFactResponses: keepCurrentFlow && state.storageVersion >= 6 ? state.pendingDefeaterFactResponses || {} : {},
    pendingDefeaterBridgeResponse: keepCurrentFlow && state.storageVersion >= 6 ? state.pendingDefeaterBridgeResponse || null : null,
    pendingDefeaterFormalResponses: keepCurrentFlow ? state.pendingDefeaterFormalResponses || {} : {},
    pendingDefeaterFormalStatus: keepCurrentFlow ? state.pendingDefeaterFormalStatus || null : null,
    phase: !keepCurrentFlow
      ? state.startedAt ? PHASES.POLICY_OVERVIEW : PHASES.LANDING
      : state.storageVersion < 6 && state.phase === PHASES.DEFEATER_IMPACT && state.pendingDefeaterArgumentId
        ? PHASES.DEFEATER_FACT
        : state.phase,
    dilemmaQueue: invalidatedOldWork ? [] : state.dilemmaQueue || [],
    dilemmaIndex: invalidatedOldWork ? 0 : state.dilemmaIndex || 0,
    dilemmaResponses: invalidatedOldWork ? {} : state.dilemmaResponses || {},
    dilemmaSensitivity: invalidatedOldWork ? null : state.dilemmaSensitivity || null,
  };
};

export const getCurrentPolicy = (state) => policies[state.policyIndex] || null;
export const getCurrentArgument = (state) => argumentsById[state.currentArgumentId] || null;
export const getCurrentFact = (state) => {
  const argument = getCurrentArgument(state);
  if (!argument) return null;
  return facts[argument.factIds[state.currentFactIndex]] || null;
};

export const getCurrentBridge = (state) => {
  const argument = getCurrentArgument(state);
  return argument ? claims[argument.bridgeClaimId] : null;
};

export const getCurrentTargetClaim = (state) => claims[state.currentTargetClaimId] || null;
export const getSelectedChain = (state) => Object.values(state.records || {})
  .flatMap((record) => record.chains || [])
  .find((chain) => chain.id === state.selectedChainId) || null;

export const getActiveChains = (record) => (record?.chains || []).filter((chain) => (
  chain.matchingStatus === 'active'
  || (!chain.matchingStatus && ['complete', 'conditional'].includes(chain.status) && chain.defeaterReview)
));

export const collectTerminalCommitments = (state) => {
  const items = [];
  Object.values(state.records).forEach((record) => {
    record.chains.forEach((chain) => {
      if (!chain.terminal?.claimId) return;
      if (chain.terminal.status !== 'provisional_fixed_point') return;
      if (chain.matchingStatus !== 'active'
        && !(!chain.matchingStatus && ['complete', 'conditional'].includes(chain.status) && chain.defeaterReview)) return;
      items.push({
        claimId: chain.terminal.claimId,
        policyId: chain.policyId,
        chainId: chain.id,
        status: chain.status,
        stress: chain.stress,
      });
    });
  });
  return items;
};

const collectPositions = (state) => {
  const factPositions = new Map();
  const bridgePositions = new Map();
  Object.values(state.records).forEach((record) => {
    record.chains.forEach((chain) => {
      chain.steps.forEach((step) => {
        Object.entries(step.factResponses || {}).forEach(([factId, response]) => {
          const set = factPositions.get(factId) || new Set();
          set.add(response);
          factPositions.set(factId, set);
        });
        const set = bridgePositions.get(step.bridgeClaimId) || new Set();
        set.add(step.bridgeResponse);
        bridgePositions.set(step.bridgeClaimId, set);
      });
    });
  });
  return { factPositions, bridgePositions };
};

export const analyzeTensions = (state) => {
  const { factPositions, bridgePositions } = collectPositions(state);
  const tensions = [];

  (state.conflicts || []).forEach((conflict) => {
    const proposition = conflict.kind === 'fact'
      ? facts[conflict.propositionId]?.statement
      : claims[conflict.propositionId]?.text;
    const resolutionMeta = {
      revise_prior: ['已修订旧回答', '你用当前回答统一修订了此前对同一命题的回答。', 'low'],
      keep_prior: ['已撤回当前回答', '你保留此前回答，并让当前路径沿用它。', 'low'],
      suspend: ['命题暂时未判断', '你把此前和当前回答都改为“暂时没有足够信息判断”。', 'medium'],
      scope_gap: ['命题范围可能表达不足', '你保留了相反回答，并把差异记录为题库尚未表达的语境条件。', 'medium'],
    }[conflict.resolution] || ['矛盾处理记录', '系统保存了这次相反回答及其处理方式。', 'low'];
    tensions.push({
      id: `conflict_event_${conflict.id}`,
      kind: `conflict_${conflict.resolution || 'recorded'}`,
      title: resolutionMeta[0],
      detail: `${proposition || conflict.propositionId} ${resolutionMeta[1]}`,
      severity: resolutionMeta[2],
    });
  });

  (state.modelGaps || []).forEach((gap) => {
    tensions.push({
      id: `model_gap_${gap.id}`,
      kind: 'model_gap',
      title: '预设理由没有覆盖用户的实际理由',
      detail: `${getPolicy(gap.policyId)?.title || gap.policyId || '未知政策'}：系统没有替你选择价值原则；这条理由链停在题库没有覆盖你实际理由的位置。${gap.summary ? ` 用户确认保存的缺口摘要：${gap.summary}` : ''}`,
      severity: 'low',
    });
  });

  factPositions.forEach((positions, factId) => {
    if (positions.has('true') && positions.has('false')) {
      tensions.push({
        id: `fact_${factId}`,
        kind: 'empirical_conflict',
        title: '同一经验命题被同时判断为真和假',
        detail: facts[factId]?.statement || factId,
        severity: 'high',
      });
    }
  });

  bridgePositions.forEach((positions, claimId) => {
    if (positions.has('accept') && positions.has('reject')) {
      tensions.push({
        id: `bridge_${claimId}`,
        kind: 'bridge_conflict',
        title: '同一条规范原则曾被接受，也曾被拒绝',
        detail: claims[claimId]?.text || claimId,
        severity: 'high',
      });
    }
  });

  Object.values(state.records).forEach((record) => {
    if (record.packageConflict) {
      const supported = Object.values(record.policyChoiceResponses || {}).filter((value) => value === 'support').length;
      const opposed = Object.values(record.policyChoiceResponses || {}).filter((value) => value === 'oppose').length;
      tensions.push({
        id: `package_${record.policyId}`,
        kind: 'package_conflict',
        title: '政策包内存在独立选择冲突',
        detail: `${getPolicy(record.policyId)?.title || record.policyId}：支持 ${supported} 个政策选择，反对 ${opposed} 个政策选择；整包判断没有覆盖这些差异。`,
        severity: 'medium',
      });
    }
    record.chains.forEach((chain) => {
      (chain.compatibilityIssues || []).forEach((issue, index) => {
        const detail = issue.kind === 'mutually_exclusive'
          ? `同时采用了两个不能共同成立的情景命题：“${facts[issue.factId]?.statement || issue.factId}”与“${facts[issue.otherId]?.statement || issue.otherId}”。`
          : `“${facts[issue.factId]?.statement || issue.factId}”依赖的条件“${facts[issue.dependencyId]?.statement || issue.dependencyId}”已被判断为不成立。`;
        tensions.push({
          id: `compatibility_${chain.id}_${index}`,
          kind: 'scenario_incompatibility',
          title: '跨路径事实情景不相容',
          detail,
          severity: 'high',
        });
      });
      const defeaterEffect = chain.defeaterReview?.effect || chain.defeaterReview?.impact;
      if (['weaken', 'offset', 'outweigh'].includes(defeaterEffect)) {
        tensions.push({
          id: `defeater_${chain.id}`,
          kind: 'defeater_changed_stance',
          title: defeaterEffect === 'outweigh'
            ? '最强反方理由改变了政策立场'
            : defeaterEffect === 'offset'
              ? '正反理由暂时抵消，政策立场转为未定'
              : '最强反方理由削弱了原理由，但政策立场未改变',
          detail: argumentsById[chain.defeaterReview.argumentId]?.title || '已记录反方理由复核。',
          severity: 'high',
        });
      }
      if (chain.status === 'conditional') {
        const conditionalScenario = chain.steps.some((step) => step.assessmentMode === 'conditional_scenario');
        tensions.push({
          id: `conditional_${chain.id}`,
          kind: conditionalScenario ? 'conditional_scenario' : 'empirical_break',
          title: conditionalScenario ? '理由链只在条件性题设下闭合' : '规范理由已经说明，但事实前提仍未确定',
          detail: conditionalScenario
            ? `${getPolicy(chain.policyId)?.title || chain.policyId}：本轮采用了题设中的经验描述来检验规范结构，没有确认这些描述在现实中成立。`
            : `${getPolicy(chain.policyId)?.title || chain.policyId}：这条路径目前只能说明：如果相关事实以后得到确认，这套规范理由会为结论提供支持。`,
          severity: 'medium',
        });
      }
      if (['unexplained_exception', 'qualified_exception'].includes(chain.stress?.response)) {
        tensions.push({
          id: `scope_${chain.id}`,
          kind: 'scope_tension',
          title: chain.stress.response === 'qualified_exception'
            ? '原则在结构相似案例中需要限定，限定尚未完成审查'
            : '原则在结构相似案例中被例外处理，但尚无相关差别',
          detail: chain.stress.distinction || claims[chain.terminal?.claimId]?.text || '未命名原则',
          severity: 'medium',
        });
      }
      if (chain.status === 'unresolved') {
        tensions.push({
          id: `unresolved_${chain.id}`,
          kind: 'unresolved',
          title: '理由链尚未完成',
          detail: chain.unresolvedReason || `${getPolicy(chain.policyId)?.title || chain.policyId}的理由仍未完成。`,
          severity: 'low',
        });
      }
    });
  });

  return tensions;
};

const responseToRelation = (item, response) => {
  if (!response) return null;
  if (response === 'left_strong') {
    return { dilemmaId: item.id, type: 'preference', winner: item.left, loser: item.right, strength: 'strong', weight: 2 };
  }
  if (response === 'left_slight') {
    return { dilemmaId: item.id, type: 'preference', winner: item.left, loser: item.right, strength: 'slight', weight: 1 };
  }
  if (response === 'right_slight') {
    return { dilemmaId: item.id, type: 'preference', winner: item.right, loser: item.left, strength: 'slight', weight: 1 };
  }
  if (response === 'right_strong') {
    return { dilemmaId: item.id, type: 'preference', winner: item.right, loser: item.left, strength: 'strong', weight: 2 };
  }
  if (response === 'equal') return { dilemmaId: item.id, type: 'equal', left: item.left, right: item.right };
  if (response === 'depends_on_context') return { dilemmaId: item.id, type: 'contextual', left: item.left, right: item.right };
  if (response === 'incomparable') return { dilemmaId: item.id, type: 'incomparable', left: item.left, right: item.right };
  if (response === 'undecided') return { dilemmaId: item.id, type: 'undecided', left: item.left, right: item.right };
  return null;
};

const stronglyConnectedComponents = (nodes, edges) => {
  const adjacency = new Map(nodes.map((node) => [node, []]));
  edges.forEach((edge) => adjacency.get(edge.winner)?.push(edge.loser));
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const low = new Map();
  const result = [];

  const visit = (node) => {
    indices.set(node, index);
    low.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    (adjacency.get(node) || []).forEach((next) => {
      if (!indices.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), indices.get(next)));
      }
    });

    if (low.get(node) === indices.get(node)) {
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== node);
      result.push(component);
    }
  };

  nodes.forEach((node) => {
    if (!indices.has(node)) visit(node);
  });
  return result;
};

export const calculatePriority = (state) => {
  const items = state.dilemmaQueue
    .map((id) => dilemmas.find((item) => item.id === id))
    .filter(Boolean);
  const relations = items
    .map((item) => responseToRelation(item, state.dilemmaResponses[item.id]?.response))
    .filter(Boolean);
  const edges = relations.filter((relation) => relation.type === 'preference');
  const ties = relations.filter((relation) => relation.type === 'equal');
  const incomparables = relations.filter((relation) => relation.type === 'incomparable');
  const contextual = relations.filter((relation) => relation.type === 'contextual');
  const undecided = relations.filter((relation) => relation.type === 'undecided');
  const nodes = [...new Set(items.flatMap((item) => [item.left, item.right]))];
  const cycles = stronglyConnectedComponents(nodes, edges).filter((component) => component.length > 1);
  return {
    relations,
    edges,
    ties,
    incomparables,
    contextual,
    undecided,
    cycles,
    unanswered: items.filter((item) => !state.dilemmaResponses[item.id]).length,
  };
};

export const sessionSummary = (state) => {
  const commitments = collectTerminalCommitments(state);
  const uniqueCommitments = [...new Map(commitments.map((item) => [item.claimId, item])).values()];
  const completeChains = Object.values(state.records).flatMap((record) => record.chains).filter((chain) => chain.status === 'complete');
  const conditionalChains = Object.values(state.records).flatMap((record) => record.chains).filter((chain) => chain.status === 'conditional');
  const unresolvedChains = Object.values(state.records).flatMap((record) => record.chains).filter((chain) => chain.status === 'unresolved');
  const tensions = analyzeTensions(state);
  return {
    commitments,
    uniqueCommitments,
    completeChains,
    conditionalChains,
    unresolvedChains,
    tensions,
    priority: calculatePriority(state),
  };
};

export const exportSession = (state) => ({
  schema: 'minimal-bridge-dialogue-session',
  schemaVersion: 5,
  modelVersion: state.modelVersion,
  exportedAt: now(),
  state,
  analysis: sessionSummary(state),
});

export const factResponseSummary = responseSummary;
