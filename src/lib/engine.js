import {
  MODEL_META,
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getPolicy,
  getRelevantDilemmas,
  policies,
} from '../data/model.js';

const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const PHASES = Object.freeze({
  LANDING: 'landing',
  STANCE: 'stance',
  DIRECTION: 'direction',
  ARGUMENT: 'argument',
  FACT: 'fact',
  BRIDGE: 'bridge',
  DEPTH: 'depth',
  TERMINAL_CONFIRM: 'terminal_confirm',
  STRESS: 'stress',
  CONFLICT: 'conflict',
  BROKEN: 'broken',
  POLICY_COMPLETE: 'policy_complete',
  DILEMMA_INTRO: 'dilemma_intro',
  DILEMMA: 'dilemma',
  RESULTS: 'results',
});

export const createInitialState = () => ({
  modelVersion: MODEL_META.version,
  storageVersion: 4,
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
  currentTargetClaimId: null,
  currentArgumentId: null,
  currentFactIndex: 0,
  pendingFactResponses: {},
  pendingConflict: null,
  conflicts: [],
  modelGaps: [],
  breakReason: null,
  dilemmaQueue: [],
  dilemmaIndex: 0,
  dilemmaResponses: {},
  startedAt: null,
  updatedAt: null,
});

const now = () => new Date().toISOString();

const ensurePolicyRecord = (state, policyId, patch = {}) => ({
  policyId,
  stance: null,
  direction: null,
  chains: [],
  status: 'not_started',
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
  if (chain.stress?.response === 'unexplained_exception') return 'tension';
  if (chain.scopeConflicts?.length) return 'tension';
  if (chain.stress?.response === 'retract' || chain.stress?.response === 'uncertain') return 'unresolved';

  const factValues = chain.steps.flatMap((step) => Object.values(step.factResponses || {}));
  const allBridgesAccepted = chain.steps.every((step) => step.bridgeResponse === 'accept');
  if (!allBridgesAccepted) return 'unresolved';
  if (factValues.some((value) => value !== 'true')) return 'conditional';
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

const replacePriorResponses = (state, kind, propositionId, response) => {
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
      const revised = { ...chain, steps: chain.steps.map(replaceStep) };
      return { ...revised, status: classifyChain(revised) };
    });
    return [policyId, { ...record, chains, status: classifyRecordStatus(chains) }];
  }));

  const currentChain = state.currentChain
    ? { ...state.currentChain, steps: state.currentChain.steps.map(replaceStep) }
    : state.currentChain;

  return { ...state, records, currentChain };
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
    bridgeClaimId: argument.bridgeClaimId,
    bridgeResponse: response,
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
  const status = classifyChain(chainWithStress);
  const chain = { ...chainWithStress, status };
  const record = ensurePolicyRecord(state, policy.id);
  const chains = [...record.chains, chain];
  const recordStatus = classifyRecordStatus(chains);

  return {
    ...state,
    records: {
      ...state.records,
      [policy.id]: {
        ...record,
        chains,
        status: recordStatus,
      },
    },
    currentChain: chain,
    phase: PHASES.POLICY_COMPLETE,
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
  return {
    ...state,
    records: {
      ...state.records,
      [policy.id]: {
        ...record,
        chains: [...record.chains, chain],
        status: record.status === 'complete' ? 'complete' : 'unresolved',
      },
    },
    currentChain: chain,
    phase: PHASES.POLICY_COMPLETE,
    updatedAt: now(),
  };
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
  return {
    ...state,
    policyIndex: index,
    phase: PHASES.STANCE,
    currentChain: null,
    currentTargetClaimId: null,
    currentArgumentId: null,
    currentFactIndex: 0,
    pendingFactResponses: {},
    pendingConflict: null,
    breakReason: null,
    records: {
      ...state.records,
      [policy.id]: ensurePolicyRecord(state, policy.id, {
        status: state.records[policy.id]?.status || 'in_progress',
      }),
    },
    updatedAt: now(),
  };
};

const startDirection = (state, direction) => {
  const policy = policies[state.policyIndex];
  const targetClaimId = direction === 'support' ? policy.supportClaimId : policy.opposeClaimId;
  const record = ensurePolicyRecord(state, policy.id, { direction, status: 'in_progress' });
  return {
    ...state,
    records: { ...state.records, [policy.id]: record },
    currentChain: beginChain(policy.id, direction, targetClaimId),
    currentTargetClaimId: targetClaimId,
    currentArgumentId: null,
    currentFactIndex: 0,
    pendingFactResponses: {},
    pendingConflict: null,
    breakReason: null,
    phase: PHASES.ARGUMENT,
    updatedAt: now(),
  };
};

export const reducer = (state, action) => {
  switch (action.type) {
    case 'START':
      return startPolicy({ ...createInitialState(), entryPath: 'bank', startedAt: now() }, 0);

    case 'START_AT_POLICY': {
      const policyIndex = policies.findIndex((policy) => policy.id === action.policyId);
      if (policyIndex < 0) return state;
      return startPolicy(
        {
          ...createInitialState(),
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
        pendingConflict: null,
        breakReason: null,
        phase: argument.factIds.length ? PHASES.FACT : PHASES.BRIDGE,
        updatedAt: now(),
      };
    }

    case 'SET_STANCE': {
      const policy = policies[state.policyIndex];
      const stance = action.stance;
      const record = ensurePolicyRecord(state, policy.id, { stance, status: 'in_progress' });
      const next = { ...state, records: { ...state.records, [policy.id]: record }, updatedAt: now() };
      if (stance === 'support' || stance === 'oppose') return startDirection(next, stance);
      if (stance === 'undecided') return { ...next, phase: PHASES.DIRECTION };
      return next;
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
        pendingConflict: null,
        breakReason: null,
        phase: argument.factIds.length ? PHASES.FACT : PHASES.BRIDGE,
        updatedAt: now(),
      };
    }

    case 'NO_ARGUMENT': {
      const gap = {
        id: uid('gap'),
        policyId: policies[state.policyIndex]?.id || null,
        chainId: state.currentChain?.id || null,
        targetClaimId: state.currentTargetClaimId,
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
      return applyFactAnswer(state, action.response);
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
        next = replacePriorResponses(next, conflict.kind, conflict.propositionId, conflict.attemptedResponse);
      } else if (action.resolution === 'keep_prior') {
        answer = stablePrior || suspended;
      } else if (action.resolution === 'suspend') {
        next = replacePriorResponses(next, conflict.kind, conflict.propositionId, suspended);
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
        const candidates = getArgumentsForClaim(bridgeClaimId);
        if (!candidates.length) {
          return {
            ...state,
            currentChain: {
              ...state.currentChain,
              terminal: {
                claimId: bridgeClaimId,
                status: 'terminal_candidate',
                confirmedAt: null,
              },
            },
            phase: PHASES.TERMINAL_CONFIRM,
            updatedAt: now(),
          };
        }
        return {
          ...state,
          currentTargetClaimId: bridgeClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
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
        return {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: {
              ...(state.currentChain.terminal || {}),
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
        const candidates = getArgumentsForClaim(candidateClaimId);
        if (!candidates.length) return state;
        return {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: null,
          },
          currentTargetClaimId: candidateClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
          breakReason: null,
          phase: PHASES.ARGUMENT,
          updatedAt: now(),
        };
      }
      if (action.response === 'reject') {
        return {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: {
              ...(state.currentChain.terminal || {}),
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
      return finalizeAsUnresolved(
        {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: {
              ...(state.currentChain.terminal || {}),
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
        return {
          ...state,
          currentChain: {
            ...state.currentChain,
            terminal: {
              ...state.currentChain.terminal,
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

    case 'RESOLVE_BREAK': {
      if (action.resolution === 'alternate_argument') {
        const lastStep = state.currentChain?.steps.at(-1);
        const shouldDropLast = Boolean(
          lastStep && (
            lastStep.bridgeResponse !== 'accept'
            || state.currentChain?.terminal?.status === 'retracted_after_stress'
          )
        );
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
          currentTargetClaimId: lastStep?.targetClaimId || state.currentTargetClaimId,
          currentArgumentId: null,
          currentFactIndex: 0,
          pendingFactResponses: {},
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
      const selected = getRelevantDilemmas(terminalIds);
      return {
        ...state,
        dilemmaQueue: selected.map((item) => item.id),
        dilemmaIndex: 0,
        phase: selected.length ? PHASES.DILEMMA : PHASES.RESULTS,
        updatedAt: now(),
      };
    }

    case 'ANSWER_DILEMMA': {
      const dilemmaId = state.dilemmaQueue[state.dilemmaIndex];
      if (!dilemmaId) return { ...state, phase: PHASES.RESULTS, updatedAt: now() };
      const dilemmaResponses = {
        ...state.dilemmaResponses,
        [dilemmaId]: {
          response: action.response,
          answeredAt: now(),
        },
      };
      const nextIndex = state.dilemmaIndex + 1;
      return {
        ...state,
        dilemmaResponses,
        dilemmaIndex: nextIndex,
        phase: nextIndex >= state.dilemmaQueue.length ? PHASES.RESULTS : PHASES.DILEMMA,
        updatedAt: now(),
      };
    }

    case 'SHOW_RESULTS':
      return { ...state, phase: PHASES.RESULTS, updatedAt: now() };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
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

export const collectTerminalCommitments = (state) => {
  const items = [];
  Object.values(state.records).forEach((record) => {
    record.chains.forEach((chain) => {
      if (!chain.terminal?.claimId) return;
      if (chain.terminal.status !== 'provisional_fixed_point') return;
      if (!['complete', 'conditional', 'tension'].includes(chain.status)) return;
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
      detail: `${getPolicy(gap.policyId)?.title || gap.policyId || '未知政策'}：系统没有替你选择价值原则；这条理由链停在题库没有覆盖你实际理由的位置。`,
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
    record.chains.forEach((chain) => {
      if (chain.status === 'conditional') {
        tensions.push({
          id: `conditional_${chain.id}`,
          kind: 'empirical_break',
          title: '规范理由已经说明，但事实前提仍未确定',
          detail: `${getPolicy(chain.policyId)?.title || chain.policyId}：这条路径目前只能说明：如果相关事实以后得到确认，这套规范理由会为结论提供支持。`,
          severity: 'medium',
        });
      }
      if (chain.stress?.response === 'unexplained_exception') {
        tensions.push({
          id: `scope_${chain.id}`,
          kind: 'scope_tension',
          title: '原则在结构相似案例中被例外处理，但尚无相关差别',
          detail: claims[chain.terminal?.claimId]?.text || '未命名原则',
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

const responseToEdge = (item, response) => {
  if (!response || response === 'undecided') return null;
  if (response === 'left_strong') return { winner: item.left, loser: item.right, weight: 2 };
  if (response === 'left_slight') return { winner: item.left, loser: item.right, weight: 1 };
  if (response === 'right_slight') return { winner: item.right, loser: item.left, weight: 1 };
  if (response === 'right_strong') return { winner: item.right, loser: item.left, weight: 2 };
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
  const edges = items
    .map((item) => responseToEdge(item, state.dilemmaResponses[item.id]?.response))
    .filter(Boolean);
  const nodes = [...new Set(items.flatMap((item) => [item.left, item.right]))];
  const scores = new Map(nodes.map((node) => [node, { id: node, won: 0, lost: 0, comparisons: 0, net: 0 }]));

  items.forEach((item) => {
    const response = state.dilemmaResponses[item.id]?.response;
    if (!response || response === 'undecided') return;
    const left = scores.get(item.left);
    const right = scores.get(item.right);
    left.comparisons += 1;
    right.comparisons += 1;
  });

  edges.forEach((edge) => {
    const winner = scores.get(edge.winner);
    const loser = scores.get(edge.loser);
    winner.won += edge.weight;
    loser.lost += edge.weight;
  });

  scores.forEach((value) => {
    value.net = value.won - value.lost;
  });

  const ranking = [...scores.values()].sort((a, b) => b.net - a.net || b.comparisons - a.comparisons || a.id.localeCompare(b.id));
  const cycles = stronglyConnectedComponents(nodes, edges).filter((component) => component.length > 1);
  return { ranking, edges, cycles, unanswered: items.length - edges.length };
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
  schemaVersion: 3,
  modelVersion: state.modelVersion,
  exportedAt: now(),
  state,
  analysis: sessionSummary(state),
});

export const factResponseSummary = responseSummary;
