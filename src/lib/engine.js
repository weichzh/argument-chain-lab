import {
  MODEL_META,
  adaptiveAssessment,
  assessmentModes,
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getPolicy,
  getRelevantDilemmas,
  policies,
} from '../data/model.js';
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
  DEPTH: 'depth',
  TERMINAL_CONFIRM: 'terminal_confirm',
  STRESS: 'stress',
  DEFEATER: 'defeater',
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
  storageVersion: 5,
  assessmentMode: assessmentModes.default || 'real_world_belief',
  adaptiveMode: false,
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
  pendingDefeaterArgumentId: null,
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
  componentPositions: {},
  componentTradeoffs: {},
  packageConflict: false,
  tradeoffMode: null,
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
    return { ...revised, status: chain.completedAt ? classifyChain(revised) : chain.status };
  };
  const nextRecords = Object.fromEntries(Object.entries(records).map(([policyId, record]) => {
    const chains = (record.chains || []).map(reviseChain);
    return [policyId, {
      ...record,
      chains,
      status: record.draft ? 'in_progress' : classifyRecordStatus(chains),
      ...recordStatusFlags(chains),
    }];
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

  const records = Object.fromEntries(Object.entries(state.records).map(([policyId, record]) => {
    const chains = record.chains.map((chain) => {
      const affected = chain.steps.some((step) => (
        kind === 'fact'
          ? Object.prototype.hasOwnProperty.call(step.factResponses || {}, propositionId)
          : step.bridgeClaimId === propositionId
      ));
      if (affected) affectedChainIds.add(chain.id);
      const revised = { ...chain, steps: chain.steps.map(replaceStep) };
      return { ...revised, status: classifyChain(revised) };
    });
    return [policyId, {
      ...record,
      chains,
      status: classifyRecordStatus(chains),
      ...recordStatusFlags(chains),
    }];
  }));

  const currentChain = state.currentChain
    ? { ...state.currentChain, steps: state.currentChain.steps.map(replaceStep) }
    : state.currentChain;

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
  return {
    ...state,
    currentChain,
    breakReason: null,
    phase: bridgeClaim?.kind === 'terminal' ? PHASES.TERMINAL_CONFIRM : PHASES.DEPTH,
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
  const chain = { ...chainWithStress, status: classifyChain(chainWithStress) };
  const record = ensurePolicyRecord(state, policy.id);
  const chains = [...record.chains, chain];
  const compatible = applyCompatibility({
    ...state.records,
    [policy.id]: {
      ...record,
      chains,
      draft: null,
      status: classifyRecordStatus(chains),
      ...recordStatusFlags(chains),
    },
  });
  const stored = compatible.records[policy.id].chains.find((item) => item.id === chain.id);
  return {
    ...state,
    records: compatible.records,
    currentChain: null,
    selectedChainId: chain.id,
    currentTargetClaimId: null,
    currentArgumentId: null,
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
    unresolvedReason: reason,
    completedAt: now(),
  };
  const record = ensurePolicyRecord(state, policy.id);
  const chains = [...record.chains, chain];
  const nextRecords = {
    ...state.records,
    [policy.id]: {
      ...record,
      chains,
      draft: null,
      status: classifyRecordStatus(chains),
      ...recordStatusFlags(chains),
    },
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
    return [policyId, { ...record, chains }];
  }));
  return selected ? { ...state, records } : state;
};

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
  const componentsComplete = (policy.components || []).every((component) => record.componentPositions?.[component.id]);
  return {
    ...state,
    policyIndex: index,
    phase: policy.components?.length && !componentsComplete ? PHASES.COMPONENTS : PHASES.STANCE,
    currentChain: null,
    selectedChainId: null,
    currentTargetClaimId: null,
    currentArgumentId: null,
    currentFactIndex: 0,
    pendingFactResponses: {},
    pendingFactSensitivity: {},
    pendingSensitivity: null,
    pendingDefeaterArgumentId: null,
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
  PHASES.DEPTH,
  PHASES.TERMINAL_CONFIRM,
  PHASES.STRESS,
  PHASES.DEFEATER,
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
          pendingDefeaterArgumentId: state.pendingDefeaterArgumentId,
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
    pendingDefeaterArgumentId: null,
    pendingConflict: null,
    breakReason: null,
    phase: PHASES.ARGUMENT,
    updatedAt: now(),
  };
};

export const canNominateClaim = (claim) => Boolean(claim?.nominatable && claim?.stressTest);
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
      return openPolicy(state, policyIndex);
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

    case 'SET_COMPONENT_POSITION': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      const component = policy.components?.find((item) => item.id === action.componentId);
      if (!component || !['support', 'oppose', 'conditional', 'undecided'].includes(action.position)) return state;
      return {
        ...state,
        records: {
          ...state.records,
          [policy.id]: {
            ...record,
            componentPositions: { ...record.componentPositions, [component.id]: action.position },
            status: 'in_progress',
          },
        },
        updatedAt: now(),
      };
    }

    case 'COMPLETE_COMPONENTS': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      if (!(policy.components || []).every((component) => record.componentPositions?.[component.id])) return state;
      const positions = Object.values(record.componentPositions);
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
      const record = ensurePolicyRecord(state, policy.id, { stance, status: 'in_progress' });
      const next = { ...state, records: { ...state.records, [policy.id]: record }, updatedAt: now() };
      if (record.packageConflict) return { ...next, phase: PHASES.PACKAGE_TRADEOFF };
      if (stance === 'support' || stance === 'oppose') return startDirection(next, stance);
      if (stance === 'undecided') return { ...next, phase: PHASES.DIRECTION };
      return next;
    }

    case 'SET_COMPONENT_TRADEOFF': {
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(state, policy.id);
      if (!policy.components?.some((component) => component.id === action.componentId)) return state;
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
        next = {
          ...next,
          currentChain: next.currentChain
            ? {
                ...next.currentChain,
                scopeConflicts: [...(next.currentChain.scopeConflicts || []), marker],
              }
            : next.currentChain,
        };
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

      return conflict.kind === 'fact'
        ? applyFactAnswer(next, answer)
        : applyBridgeAnswer(next, answer);
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
          phase: PHASES.STRESS,
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
        phase: PHASES.DEFEATER_IMPACT,
        updatedAt: now(),
      };
    }

    case 'NO_DEFEATER_ACCEPTED': {
      const next = updateStoredChain(state, state.selectedChainId, (chain) => ({
        ...chain,
        defeaterReview: {
          argumentId: null,
          accepted: false,
          impact: 'none_accepted',
          reviewedAt: now(),
        },
      }));
      return { ...next, pendingDefeaterArgumentId: null, phase: PHASES.POLICY_COMPLETE, updatedAt: now() };
    }

    case 'ANSWER_DEFEATER': {
      if (!['unchanged', 'weakened', 'reversed', 'rejected'].includes(action.impact)) return state;
      const argument = argumentsById[state.pendingDefeaterArgumentId];
      if (!argument) return state;
      const selectedChain = Object.values(state.records).flatMap((record) => record.chains || [])
        .find((chain) => chain.id === state.selectedChainId);
      const next = updateStoredChain(state, state.selectedChainId, (chain) => ({
        ...chain,
        defeaterReview: {
          argumentId: argument.id,
          accepted: action.impact !== 'rejected',
          impact: action.impact,
          reviewedAt: now(),
        },
      }));
      const policy = policies[state.policyIndex];
      const record = ensurePolicyRecord(next, policy.id);
      const stance = action.impact === 'weakened'
        ? 'undecided'
        : action.impact === 'reversed'
          ? selectedChain?.direction === 'support' ? 'oppose' : 'support'
          : record.stance;
      return {
        ...next,
        records: { ...next.records, [policy.id]: { ...record, stance, postDefeaterStance: stance } },
        pendingDefeaterArgumentId: null,
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
      const direction = record.direction || record.stance;
      if (direction !== 'support' && direction !== 'oppose') return state;
      return startDirection(
        {
          ...state,
          records: {
            ...state.records,
            [policy.id]: {
              ...record,
              draft: null,
              status: 'in_progress',
            },
          },
        },
        direction,
      );
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
      const allowed = ['left_strong', 'left_slight', 'equal', 'undecided', 'right_slight', 'right_strong'];
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
  if (![4, 5].includes(state?.storageVersion)) return null;
  if (!['0.7.0', '0.7.1', MODEL_META.version].includes(state.modelVersion)) return null;
  const legacyRealWorld = state.modelVersion === '0.7.0';
  const migrateChain = (chain) => {
    if (!chain) return chain;
    const revised = {
      ...chain,
      compatibilityIssues: chain.compatibilityIssues || [],
      defeaterReview: chain.defeaterReview || null,
      steps: (chain.steps || []).map((step) => ({
        ...step,
        assessmentMode: step.assessmentMode || (legacyRealWorld ? 'real_world_belief' : state.assessmentMode) || 'real_world_belief',
        factSensitivity: step.factSensitivity || {},
      })),
    };
    return revised.completedAt ? { ...revised, status: classifyChain(revised) } : revised;
  };
  const records = Object.fromEntries(Object.entries(state.records || {}).map(([policyId, record]) => {
    const chains = (record.chains || []).map(migrateChain);
    return [policyId, {
      ...ensurePolicyRecord({ records: {} }, policyId),
      ...record,
      chains,
      draft: record.draft
        ? {
            ...record.draft,
            currentChain: migrateChain(record.draft.currentChain),
            pendingFactSensitivity: record.draft.pendingFactSensitivity || {},
            pendingSensitivity: record.draft.pendingSensitivity || null,
            pendingDefeaterArgumentId: record.draft.pendingDefeaterArgumentId || null,
          }
        : null,
      status: record.draft ? 'in_progress' : classifyRecordStatus(chains),
      ...recordStatusFlags(chains),
      componentPositions: record.componentPositions || {},
      componentTradeoffs: record.componentTradeoffs || {},
      packageConflict: Boolean(record.packageConflict),
    }];
  }));
  const sessionOverlay = {
    ...state.sessionOverlay,
    claims: Object.fromEntries(Object.entries(state.sessionOverlay?.claims || {}).map(([claimId, claim]) => [
      claimId,
      claim.kind === 'policy' ? claim : { ...claim, nominatable: Boolean(claim.stressTest) },
    ])),
  };

  const migratedCurrent = migrateChain(state.currentChain);
  const duplicateCompleted = migratedCurrent?.completedAt && Object.values(records)
    .some((record) => record.chains.some((chain) => chain.id === migratedCurrent.id));
  const compatible = applyCompatibility(records, duplicateCompleted ? null : migratedCurrent);
  return {
    ...createInitialState(),
    ...state,
    storageVersion: 5,
    modelVersion: MODEL_META.version,
    assessmentMode: legacyRealWorld
      ? 'real_world_belief'
      : isAssessmentMode(state.assessmentMode) ? state.assessmentMode : assessmentModes.default || 'real_world_belief',
    sessionOverlay,
    records: compatible.records,
    currentChain: compatible.currentChain,
    selectedChainId: duplicateCompleted ? migratedCurrent.id : state.selectedChainId || null,
    fixedPointEvents: (state.fixedPointEvents || []).map((event) => ({
      ...event,
      lifecycle: event.lifecycle || 'active',
      invalidatedByConflictId: event.invalidatedByConflictId || null,
    })),
    pendingFactSensitivity: state.pendingFactSensitivity || {},
    pendingSensitivity: state.pendingSensitivity || null,
    pendingDefeaterArgumentId: state.pendingDefeaterArgumentId || null,
    dilemmaSensitivity: state.dilemmaSensitivity || null,
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

export const collectTerminalCommitments = (state) => {
  const items = [];
  Object.values(state.records).forEach((record) => {
    record.chains.forEach((chain) => {
      if (!chain.terminal?.claimId) return;
      if (chain.terminal.status !== 'provisional_fixed_point') return;
      if (!['complete', 'conditional'].includes(chain.status)) return;
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
      const supported = Object.values(record.componentPositions || {}).filter((value) => value === 'support').length;
      const opposed = Object.values(record.componentPositions || {}).filter((value) => value === 'oppose').length;
      tensions.push({
        id: `package_${record.policyId}`,
        kind: 'package_conflict',
        title: '政策包内存在独立组件冲突',
        detail: `${getPolicy(record.policyId)?.title || record.policyId}：支持 ${supported} 个组件，反对 ${opposed} 个组件；整包判断没有覆盖这些差异。`,
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
      if (['weakened', 'reversed'].includes(chain.defeaterReview?.impact)) {
        tensions.push({
          id: `defeater_${chain.id}`,
          kind: 'defeater_changed_stance',
          title: chain.defeaterReview.impact === 'reversed' ? '最强反方理由改变了政策立场' : '最强反方理由使政策立场转为未定',
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
  if (response === 'undecided') return { dilemmaId: item.id, type: 'incomparable', left: item.left, right: item.right };
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
  const nodes = [...new Set(items.flatMap((item) => [item.left, item.right]))];
  const cycles = stronglyConnectedComponents(nodes, edges).filter((component) => component.length > 1);
  return {
    relations,
    edges,
    ties,
    incomparables,
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
  schemaVersion: 4,
  modelVersion: state.modelVersion,
  exportedAt: now(),
  state,
  analysis: sessionSummary(state),
});

export const factResponseSummary = responseSummary;
