/**
 * Reference decision engine for Argument Chain Lab model schema v4.
 *
 * The engine deliberately separates:
 * 1. evaluation of a complete policy frame,
 * 2. diagnosis by counterfactual policy revisions,
 * 3. reasoning about the exact local claim discovered by diagnosis.
 *
 * It is framework-independent and has no runtime dependencies.
 */

export const PHASES = Object.freeze({
  POLICY_DECISION: 'policy_decision',
  REVISION_TEST: 'revision_test',
  REASON_CHOICE: 'reason_choice',
  PREMISE_CHECK: 'premise_check',
  RULE_CHECK: 'rule_check',
  WHY_OR_STOP: 'why_or_stop',
  STRESS_TEST: 'stress_test',
  COUNTER_REASON_CHOICE: 'counter_reason_choice',
  COUNTER_IMPACT: 'counter_impact',
  CUSTOM_REASON_REQUIRED: 'custom_reason_required',
  POLICY_DONE: 'policy_done',
  RESULTS: 'results',
});

const clone = (value) => structuredClone(value);

const indexPolicies = (model) => Object.fromEntries(model.policies.map((policy) => [policy.id, policy]));

const now = () => new Date().toISOString();

export const resolveFrame = (policy, frameId, trail = []) => {
  if (trail.includes(frameId)) throw new Error(`Policy frame cycle: ${[...trail, frameId].join(' -> ')}`);
  const frame = policy.frames?.[frameId];
  if (!frame) throw new Error(`Unknown frame ${frameId} in policy ${policy.id}`);
  if (frame.assignments) return { ...frame.assignments };
  if (!frame.extends || !frame.changes) throw new Error(`Frame ${frameId} must have assignments or extends+changes`);
  return {
    ...resolveFrame(policy, frame.extends, [...trail, frameId]),
    ...frame.changes,
  };
};

export const diffFrames = (policy, leftFrameId, rightFrameId) => {
  const left = resolveFrame(policy, leftFrameId);
  const right = resolveFrame(policy, rightFrameId);
  return Object.keys(policy.dimensions).filter((dimensionId) => left[dimensionId] !== right[dimensionId]);
};

export const proposalItemsFor = (policy, frameId = policy.rootFrameId) => {
  const assignments = resolveFrame(policy, frameId);
  return Object.keys(policy.dimensions).map((dimensionId) => {
    const valueId = assignments[dimensionId];
    return {
      dimensionId,
      dimensionLabel: policy.dimensions[dimensionId].label,
      valueId,
      valueLabel: policy.dimensions[dimensionId].values[valueId].label,
    };
  });
};

export const revisionChangesFor = (policy, candidateFrameId) => {
  const root = resolveFrame(policy, policy.rootFrameId);
  const candidate = resolveFrame(policy, candidateFrameId);
  return diffFrames(policy, policy.rootFrameId, candidateFrameId).map((dimensionId) => ({
    dimensionId,
    dimensionLabel: policy.dimensions[dimensionId].label,
    fromId: root[dimensionId],
    fromLabel: policy.dimensions[dimensionId].values[root[dimensionId]].label,
    toId: candidate[dimensionId],
    toLabel: policy.dimensions[dimensionId].values[candidate[dimensionId]].label,
  }));
};

const reasonsByTarget = (model) => {
  const result = new Map();
  Object.values(model.reasons).forEach((reason) => {
    const list = result.get(reason.targetClaimId) || [];
    list.push(reason);
    result.set(reason.targetClaimId, list);
  });
  return result;
};

const unique = (items) => [...new Set(items)];

export const validateModel = (model) => {
  const errors = [];
  const warnings = [];

  if (model?.schema !== 'argument-chain-dialogue-model') errors.push('Unsupported model schema.');
  if (model?.schemaVersion !== 4) errors.push('schemaVersion must be 4.');

  const entryIds = model?.product?.entryAnswers?.map((item) => item.id) || [];
  if (JSON.stringify(entryIds) !== JSON.stringify(['yes', 'no', 'uncertain'])) {
    errors.push('The only root answers must be yes, no, uncertain, in that order.');
  }
  if (entryIds.includes('conditional')) errors.push('Conditional acceptance must not be a root answer.');

  const claims = model?.claims || {};
  const reasons = model?.reasons || {};
  const schemes = model?.argumentSchemes || {};
  const predicates = model?.formalLanguage?.predicates || {};
  const byTarget = reasonsByTarget(model);
  const policiesById = indexPolicies({ policies: model?.policies || [] });
  const configuredDefaultPolicyIds = model?.product?.defaultPolicyIds || [];
  const defaultPolicyIds = new Set(configuredDefaultPolicyIds);
  const configuredPrecisionPolicyIds = model?.product?.entertainmentTieBreakerPolicyIds || [];
  const precisionPolicyIds = new Set(configuredPrecisionPolicyIds.filter((policyId) => !defaultPolicyIds.has(policyId)));
  if (defaultPolicyIds.size !== configuredDefaultPolicyIds.length
    || new Set(configuredPrecisionPolicyIds).size !== configuredPrecisionPolicyIds.length) {
    errors.push('Configured policy lists must not contain duplicates.');
  }
  configuredPrecisionPolicyIds.forEach((policyId) => {
    if (defaultPolicyIds.has(policyId)) errors.push(`${policyId}: policy cannot be both default and precision-only.`);
  });

  Object.entries(reasons).forEach(([reasonId, reason]) => {
    if (reason.id !== reasonId) errors.push(`Reason key/id mismatch: ${reasonId}`);
    if (!claims[reason.targetClaimId]) errors.push(`${reasonId}: unknown target claim ${reason.targetClaimId}`);
    if (!claims[reason.bridgeClaimId]) errors.push(`${reasonId}: unknown bridge claim ${reason.bridgeClaimId}`);
    if (reason.formalization?.conclusionClaimId !== reason.targetClaimId) {
      errors.push(`${reasonId}: formal conclusion does not match target claim.`);
    }
    if (reason.formalization?.bridgeClaimId !== reason.bridgeClaimId) {
      errors.push(`${reasonId}: formal bridge does not match bridge claim.`);
    }
    const formalPolicyId = reason.formalization?.policyId;
    const contextFrameId = reason.formalization?.contextFrameId;
    if (formalPolicyId) {
      const policy = policiesById[formalPolicyId];
      const target = claims[reason.targetClaimId];
      if (!policy) errors.push(`${reasonId}: unknown formal policy ${formalPolicyId}.`);
      else if (!policy.frames?.[contextFrameId]) errors.push(`${reasonId}: unknown context frame ${contextFrameId}.`);
      if (target?.policyId !== formalPolicyId || target?.frameId !== contextFrameId) {
        errors.push(`${reasonId}: formal context does not match the target claim.`);
      }
    } else if (contextFrameId !== 'global') {
      errors.push(`${reasonId}: global reasons must use the global context.`);
    }
    const scheme = schemes[reason.formalization?.schemeId];
    if (!scheme) {
      errors.push(`${reasonId}: unknown scheme ${reason.formalization?.schemeId}`);
    } else {
      const roles = reason.premises.map((premise) => premise.role);
      scheme.requiredRoles.forEach((role) => {
        if (!roles.includes(role)) errors.push(`${reasonId}: missing required premise role ${role}`);
      });
      roles.forEach((role) => {
        if (!scheme.requiredRoles.includes(role)) {
          warnings.push(`${reasonId}: extra premise role ${role}`);
        }
      });
    }
    reason.premises.forEach((premise) => {
      const signature = predicates[premise.formula?.pred];
      if (!signature) {
        errors.push(`${reasonId}/${premise.id}: unknown predicate ${premise.formula?.pred}`);
        return;
      }
      const args = premise.formula?.args || [];
      if (args.length !== signature.length) {
        errors.push(`${reasonId}/${premise.id}: predicate arity mismatch.`);
        return;
      }
      args.forEach((argument, index) => {
        if (typeof argument !== 'string') return;
        const entity = model.formalEntities?.[argument];
        if (!entity) {
          errors.push(`${reasonId}/${premise.id}: unknown formal entity ${argument}`);
        } else if (entity.sort !== signature[index]) {
          errors.push(
            `${reasonId}/${premise.id}: ${argument} has sort ${entity.sort}; expected ${signature[index]}.`,
          );
        }
      });
    });
    const mappedPremiseIds = Object.values(reason.formalization?.premiseRoles || {}).flat().sort();
    const actualPremiseIds = reason.premises.map((premise) => premise.id).sort();
    if (JSON.stringify(mappedPremiseIds) !== JSON.stringify(actualPremiseIds)) {
      errors.push(`${reasonId}: formal premise roles do not cover the reason premises exactly.`);
    }
  });

  const graph = new Map(Object.keys(claims).map((claimId) => [claimId, new Set()]));
  Object.values(reasons).forEach((reason) => graph.get(reason.targetClaimId)?.add(reason.bridgeClaimId));
  const visiting = new Set();
  const visited = new Set();
  const visit = (claimId, stack = []) => {
    if (visiting.has(claimId)) {
      errors.push(`Reason graph cycle: ${[...stack, claimId].join(' -> ')}`);
      return;
    }
    if (visited.has(claimId)) return;
    visiting.add(claimId);
    for (const next of graph.get(claimId) || []) visit(next, [...stack, claimId]);
    visiting.delete(claimId);
    visited.add(claimId);
  };
  Object.keys(claims).forEach((claimId) => visit(claimId));

  const policyIds = new Set();
  const policyOrders = new Set();
  const dialogueRoots = new Set();
  for (const policy of model.policies || []) {
    if (policyIds.has(policy.id)) errors.push(`Duplicate policy id ${policy.id}`);
    policyIds.add(policy.id);
    if (policyOrders.has(policy.order)) errors.push(`Duplicate policy order ${policy.order}`);
    policyOrders.add(policy.order);

    const dimensions = policy.dimensions || {};
    let root = null;
    try {
      root = resolveFrame(policy, policy.rootFrameId);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (JSON.stringify(Object.keys(root).sort()) !== JSON.stringify(Object.keys(dimensions).sort())) {
      errors.push(`${policy.id}: root frame is not complete.`);
    }

    const canonicalFrames = new Map();
    Object.keys(policy.frames).forEach((frameId) => {
      let assignments;
      try {
        assignments = resolveFrame(policy, frameId);
      } catch (error) {
        errors.push(error.message);
        return;
      }
      if (JSON.stringify(Object.keys(assignments).sort()) !== JSON.stringify(Object.keys(dimensions).sort())) {
        errors.push(`${policy.id}/${frameId}: frame is not complete.`);
      }
      Object.entries(assignments).forEach(([dimensionId, valueId]) => {
        if (!dimensions[dimensionId]) errors.push(`${policy.id}/${frameId}: unknown dimension ${dimensionId}`);
        else if (!dimensions[dimensionId].values[valueId]) {
          errors.push(`${policy.id}/${frameId}: invalid value ${dimensionId}=${valueId}`);
        }
      });
      const key = JSON.stringify(Object.entries(assignments).sort());
      if (canonicalFrames.has(key)) {
        errors.push(`${policy.id}: equivalent frames ${canonicalFrames.get(key)} and ${frameId}`);
      } else canonicalFrames.set(key, frameId);
    });

    const requiredClaimIds = [
      policy.entry?.supportClaimId,
      policy.fallbackOpposeClaimId,
      ...(policy.diagnostics || []).flatMap((item) => [item.acceptedClaimId, item.counterClaimId]),
      policy.counterClaims?.whenSupportingRoot,
      policy.counterClaims?.whenOpposingWithoutAcceptedRevision,
    ];
    requiredClaimIds.forEach((claimId) => dialogueRoots.add(claimId));
    requiredClaimIds.forEach((claimId) => {
      if (!claims[claimId]) errors.push(`${policy.id}: unknown claim ${claimId}`);
      else if (!(byTarget.get(claimId) || []).length) errors.push(`${policy.id}: claim ${claimId} has no reasons`);
      if (claims[claimId]
        && (claims[claimId].policyId !== policy.id || claims[claimId].frameId !== policy.rootFrameId)) {
        errors.push(`${policy.id}: claim ${claimId} targets the wrong policy frame.`);
      }
    });

    let previousCost = 0;
    const diagnosticIds = new Set();
    (policy.diagnostics || []).forEach((diagnostic) => {
      if (diagnosticIds.has(diagnostic.id)) errors.push(`${policy.id}: duplicate diagnostic ${diagnostic.id}.`);
      diagnosticIds.add(diagnostic.id);
      if (diagnostic.revisionCost < previousCost) {
        errors.push(`${policy.id}: diagnostic revision costs must be non-decreasing.`);
      }
      previousCost = diagnostic.revisionCost;
      let actualDiff = [];
      try {
        actualDiff = unique(diffFrames(policy, policy.rootFrameId, diagnostic.candidateFrameId)).sort();
      } catch (error) {
        errors.push(error.message);
      }
      const declaredDiff = unique(diagnostic.changedDimensionIds).sort();
      if (!actualDiff.length) errors.push(`${policy.id}/${diagnostic.id}: diagnostic frame must differ from the root.`);
      if (JSON.stringify(actualDiff) !== JSON.stringify(declaredDiff)) {
        errors.push(`${policy.id}/${diagnostic.id}: changedDimensionIds do not match the frame delta.`);
      }
      if (!precisionPolicyIds.has(policy.id)
        && (byTarget.get(diagnostic.acceptedClaimId) || []).length < 2) {
        errors.push(`${policy.id}/${diagnostic.acceptedClaimId}: diagnostic claim needs at least two reasons.`);
      }
    });

    [policy.entry?.supportClaimId, policy.fallbackOpposeClaimId].forEach((claimId) => {
      if ((byTarget.get(claimId) || []).length < 2) {
        errors.push(`${policy.id}/${claimId}: decision claim needs at least two reasons.`);
      }
    });
  }

  const configuredPolicyIds = [...defaultPolicyIds, ...precisionPolicyIds];
  configuredPolicyIds.forEach((policyId) => {
    if (!policyIds.has(policyId)) errors.push(`Unknown configured policy ${policyId}.`);
  });
  if (configuredPolicyIds.length && new Set(configuredPolicyIds).size !== policyIds.size) {
    errors.push('Default and precision policy lists must cover the formal model exactly.');
  }

  const bridgeClaims = unique(Object.values(reasons).map((reason) => reason.bridgeClaimId));
  bridgeClaims.forEach((claimId) => {
    const stress = claims[claimId]?.stressTest;
    if (!stress?.scenario || !stress?.question) {
      errors.push(`${claimId}: missing concrete stress test.`);
    } else if (/对象不同|关键结构相同|立场、身份或群体不同/.test(stress.scenario)) {
      errors.push(`${claimId}: generic stress placeholder is forbidden.`);
    } else if (stress.scenario.trim().length < 35 || stress.question.trim().length < 12) {
      errors.push(`${claimId}: stress test is too short to describe a concrete case.`);
    }
    if (!claims[claimId]?.terminalCandidate && !(byTarget.get(claimId) || []).length) {
      errors.push(`Non-terminal bridge ${claimId} has no deeper reasons.`);
    }
    if (claims[claimId]?.terminalCandidate
      && claims[claimId].whenUserContinuesPastCandidate !== 'offer_custom_deeper_reason') {
      errors.push(`Terminal candidate ${claimId} must route continued inquiry to a custom reason.`);
    }
  });

  const reachableClaims = new Set();
  const reachableReasons = new Set();
  const pendingClaims = [...dialogueRoots];
  while (pendingClaims.length) {
    const claimId = pendingClaims.pop();
    if (reachableClaims.has(claimId)) continue;
    reachableClaims.add(claimId);
    (byTarget.get(claimId) || []).forEach((reason) => {
      reachableReasons.add(reason.id);
      pendingClaims.push(reason.bridgeClaimId);
    });
  }
  Object.keys(reasons).forEach((reasonId) => {
    if (!reachableReasons.has(reasonId)) errors.push(`Unreachable reason ${reasonId}.`);
  });

  return { ok: errors.length === 0, errors, warnings };
};

const emptyPath = (claimId) => ({
  rootClaimId: claimId,
  steps: [],
  status: 'in_progress',
  stress: null,
});

const historySnapshot = (state) => {
  const snapshot = clone(state);
  snapshot.history = [];
  return snapshot;
};

const pushHistory = (state) => ({
  ...state,
  history: [...state.history, historySnapshot(state)],
});

export const createSession = (model, options = {}) => {
  const report = validateModel(model);
  if (!report.ok) throw new Error(`Invalid model:\n${report.errors.join('\n')}`);
  const policies = [...model.policies].sort((left, right) => left.order - right.order);
  const policyIds = options.policyIds?.length
    ? options.policyIds
    : model.product.defaultPolicyIds?.length
      ? model.product.defaultPolicyIds
      : policies.map((policy) => policy.id);
  const unknownPolicyId = policyIds.find((policyId) => !policies.some((policy) => policy.id === policyId));
  if (unknownPolicyId) throw new Error(`Unknown selected policy ${unknownPolicyId}`);
  return {
    modelVersion: model.meta.version,
    policyIds,
    policyPosition: 0,
    currentPolicyId: null,
    phase: policyIds.length ? PHASES.POLICY_DECISION : PHASES.RESULTS,
    rootAnswer: null,
    activeFrameId: null,
    acceptedRevisionFrameId: null,
    unresolvedRevisionFrameId: null,
    diagnosticIndex: 0,
    diagnosisClaimId: null,
    activeClaimId: null,
    currentReasonId: null,
    premiseIndex: 0,
    currentBridgeClaimId: null,
    chainMode: 'main',
    currentPath: null,
    mainPaths: [],
    counterPath: null,
    counterClaimId: null,
    counterImpact: null,
    triedReasonIds: {},
    policyResults: {},
    history: [],
    notes: [],
    answerLog: [],
    startedAt: now(),
    updatedAt: now(),
  };
};

export const startSession = (model, state = createSession(model)) => {
  if (!state.policyIds.length) return { ...state, phase: PHASES.RESULTS };
  const policyId = state.policyIds[state.policyPosition];
  const policy = indexPolicies(model)[policyId];
  if (!policy) throw new Error(`Unknown selected policy ${policyId}`);
  return {
    ...state,
    currentPolicyId: policyId,
    phase: PHASES.POLICY_DECISION,
    rootAnswer: null,
    activeFrameId: policy.rootFrameId,
    acceptedRevisionFrameId: null,
    unresolvedRevisionFrameId: null,
    diagnosticIndex: 0,
    diagnosisClaimId: null,
    activeClaimId: null,
    currentReasonId: null,
    premiseIndex: 0,
    currentBridgeClaimId: null,
    chainMode: 'main',
    currentPath: null,
    mainPaths: [],
    counterPath: null,
    counterClaimId: null,
    counterImpact: null,
    triedReasonIds: {},
    startedAt: state.startedAt || now(),
    updatedAt: now(),
  };
};

// Custom continuations explain the end of the confirmed prefix, not its root.
export const getReasonTargetId = (state) => state.phase === PHASES.CUSTOM_REASON_REQUIRED
  ? state.currentPath?.steps?.at(-1)?.bridgeClaimId || state.currentPath?.rootClaimId || state.activeClaimId
  : state.activeClaimId;

export const getReasonDirection = (model, state) => {
  const target = model.claims[getReasonTargetId(state)];
  if (['normative', 'value'].includes(target?.kind)) return 'support';
  return state.chainMode === 'counter'
    ? state.rootAnswer === 'yes' ? 'oppose' : 'support'
    : state.rootAnswer === 'yes' ? 'support' : 'oppose';
};


const policyFor = (model, state) => indexPolicies(model)[state.currentPolicyId];

export const getCurrentPolicy = (model, state) => policyFor(model, state) || null;

const availableReasons = (model, state, claimId) => {
  const tried = new Set(state.triedReasonIds[claimId] || []);
  return Object.values(model.reasons).filter((reason) => (
    reason.targetClaimId === claimId && !tried.has(reason.id)
  ));
};

export const getQuestion = (model, state) => {
  if (state.phase === PHASES.RESULTS) {
    return { kind: 'results', title: '当前结果', options: [] };
  }
  const policy = policyFor(model, state);
  if (!policy) throw new Error('No current policy.');

  switch (state.phase) {
    case PHASES.POLICY_DECISION:
      return {
        kind: 'policy_decision',
        title: policy.entry.question,
        scenarioSummary: policy.scenario.summary,
        fixedConditions: policy.scenario.fixedConditions,
        proposalItems: proposalItemsFor(policy),
        options: model.product.entryAnswers,
      };

    case PHASES.REVISION_TEST: {
      const diagnostic = policy.diagnostics[state.diagnosticIndex];
      return {
        kind: 'revision_test',
        title: '这样修改以后，你可以接受吗？',
        statement: diagnostic.question,
        explanation: diagnostic.explanation,
        candidateFrameId: diagnostic.candidateFrameId,
        changes: revisionChangesFor(policy, diagnostic.candidateFrameId),
        options: model.product.revisionAnswers.map((option) => option.id === 'reject'
          ? { ...option, description: '这项修改还不足以让我接受整个方案。' } : option),
      };
    }

    case PHASES.REASON_CHOICE: {
      const claim = model.claims[state.activeClaimId];
      const options = availableReasons(model, state, state.activeClaimId).map((reason) => ({
        id: reason.id,
        label: reason.title,
        description: reason.summary,
      }));
      options.push({ id: 'no_match', label: '这些都不是我的主要原因' });
      return {
        kind: 'reason_choice',
        title: '你这样判断的最主要原因是什么？',
        statement: claim?.text,
        claimId: state.activeClaimId,
        options,
      };
    }

    case PHASES.PREMISE_CHECK: {
      const reason = model.reasons[state.currentReasonId];
      const premise = reason.premises[state.premiseIndex];
      return {
        kind: 'assumption_check',
        title: '先核对一个假设',
        statement: premise.question || premise.statement,
        explanation: '这里只记录你是否愿意采用这个前提，不表示系统已核实它，也不会自动改变政策判断。',
        premiseId: premise.id,
        options: model.product.assumptionAnswers,
      };
    }

    case PHASES.RULE_CHECK: {
      const reason = model.reasons[state.currentReasonId];
      const bridge = model.claims[reason.bridgeClaimId];
      return {
        kind: 'rule_check',
        title: '即使前面的情况成立，这一点也足以成为一个理由吗？',
        statement: bridge.text,
        options: model.product.ruleAnswers,
      };
    }

    case PHASES.WHY_OR_STOP: {
      const claim = model.claims[state.currentBridgeClaimId];
      const deeper = availableReasons(model, state, state.currentBridgeClaimId).map((reason) => ({
        id: reason.id,
        label: reason.title,
        description: reason.summary,
      }));
      return {
        kind: 'why_or_stop',
        title: '你还想继续追问为什么吗？',
        statement: claim.text,
        explanation: '可以暂时停在这里；这不表示它是不可质疑的最终答案。',
        options: [
          { id: 'stop_here', label: '这就是我目前愿意停下来的理由' },
          ...deeper,
          { id: 'custom', label: '继续，但题库里没有我的理由' },
        ],
      };
    }

    case PHASES.STRESS_TEST: {
      const claim = model.claims[state.currentBridgeClaimId];
      const stress = claim.stressTest;
      if (!stress) {
        return {
          kind: 'stress_test_unavailable',
          title: '这条理由还没有准备好检验案例',
          statement: '本次先把它保留为未检查，不会假装已经通过。',
          options: [{ id: 'continue_unchecked', label: '保留为未检查并继续' }],
        };
      }
      return {
        kind: 'stress_test',
        title: stress.question,
        statement: stress.scenario,
        options: [
          { id: 'apply', label: '仍然适用' },
          { id: 'qualified', label: '有一个重要区别' },
          { id: 'retract', label: '这让我撤回刚才的理由' },
          { id: 'uncertain', label: '不确定' },
        ],
      };
    }

    case PHASES.COUNTER_REASON_CHOICE: {
      const options = availableReasons(model, state, state.counterClaimId).map((reason) => ({
        id: reason.id,
        label: reason.title,
        description: reason.summary,
      }));
      return {
        kind: 'counter_reason_choice',
        title: '下面哪条相反理由最值得你认真考虑？',
        statement: model.claims[state.counterClaimId]?.text,
        options: [
          ...options,
          { id: 'none', label: '这些理由都不影响我的判断' },
        ],
      };
    }

    case PHASES.COUNTER_IMPACT:
      return {
        kind: 'counter_impact',
        title: '核对这条相反理由后，你的判断怎样变化？',
        options: [
          { id: 'no_change', label: '不改变原判断' },
          { id: 'weaken', label: '让我有所犹豫，但不改变结论' },
          { id: 'offset', label: '两边暂时抵消，我不能决定' },
          { id: 'reverse', label: '它使我改变结论' },
          { id: 'uncertain', label: '不确定' },
        ],
      };

    case PHASES.CUSTOM_REASON_REQUIRED:
      return {
        kind: 'custom_reason_required',
        title: '补充你自己的理由',
        statement: model.claims[getReasonTargetId(state)]?.text,
        explanation: '请说明为什么接受上面的判断或原则。可以直接保存，不必使用 AI；也可以暂时保留为未解决。',
        claimId: getReasonTargetId(state),
        options: [
          { id: 'leave_unresolved', label: '暂时保留为未解决' },
        ],
      };

    case PHASES.POLICY_DONE:
      return {
        kind: 'policy_done',
        title: '这一题已经结束',
        options: [
          { id: 'next', label: '进入下一题' },
          { id: 'results', label: '现在查看结果' },
        ],
      };

    default:
      throw new Error(`Unsupported phase ${state.phase}`);
  }
};

const markTried = (state, claimId, reasonId) => ({
  ...state,
  triedReasonIds: {
    ...state.triedReasonIds,
    [claimId]: unique([...(state.triedReasonIds[claimId] || []), reasonId]),
  },
});

const beginReason = (model, state, reasonId) => {
  const reason = model.reasons[reasonId];
  if (!reason || reason.targetClaimId !== state.activeClaimId) {
    throw new Error(`Reason ${reasonId} does not target ${state.activeClaimId}`);
  }
  return {
    ...state,
    currentReasonId: reasonId,
    premiseIndex: 0,
    phase: PHASES.PREMISE_CHECK,
  };
};

const beginCounter = (model, state) => {
  const policy = policyFor(model, state);
  const acceptedDiagnostic = state.acceptedRevisionFrameId
    ? policy.diagnostics.find((item) => item.candidateFrameId === state.acceptedRevisionFrameId)
    : null;
  const counterClaimId = state.rootAnswer === 'yes'
    ? policy.counterClaims.whenSupportingRoot
    : acceptedDiagnostic?.counterClaimId
      || policy.counterClaims.whenOpposingWithoutAcceptedRevision;
  const hasCounter = Object.values(model.reasons).some((reason) => reason.targetClaimId === counterClaimId);
  return hasCounter
    ? {
        ...state,
        chainMode: 'counter',
        counterClaimId,
        activeClaimId: counterClaimId,
        currentPath: emptyPath(counterClaimId),
        currentReasonId: null,
        premiseIndex: 0,
        currentBridgeClaimId: null,
        phase: PHASES.COUNTER_REASON_CHOICE,
      }
    : { ...state, phase: PHASES.POLICY_DONE };
};

const finishPolicyRecord = (model, state) => {
  const policy = policyFor(model, state);
  const finalRootAnswer = state.counterImpact === 'reverse'
    ? state.rootAnswer === 'yes' ? 'no' : state.rootAnswer === 'no' ? 'yes' : 'uncertain'
    : state.counterImpact === 'offset' ? 'uncertain'
    : state.rootAnswer;
  return {
    policyId: policy.id,
    rootFrameId: policy.rootFrameId,
    rootAnswer: state.rootAnswer,
    finalRootAnswer,
    acceptedRevisionFrameId: state.acceptedRevisionFrameId,
    unresolvedRevisionFrameId: state.unresolvedRevisionFrameId || null,
    derivedConditionalAcceptance: Boolean(
      state.rootAnswer === 'no' && state.acceptedRevisionFrameId
    ),
    diagnosisClaimId: state.diagnosisClaimId,
    mainPaths: state.mainPaths,
    counterClaimId: state.counterClaimId,
    counterPath: state.counterPath,
    counterImpact: state.counterImpact,
    completedAt: new Date().toISOString(),
  };
};

const completeCurrentPolicy = (model, state) => ({
  ...state,
  policyResults: {
    ...state.policyResults,
    [state.currentPolicyId]: finishPolicyRecord(model, state),
  },
  phase: PHASES.POLICY_DONE,
});

const finishCustomReason = (model, state, extra) => {
  const text = typeof extra.text === 'string' ? extra.text.trim() : '';
  const candidate = extra.candidate && typeof extra.candidate === 'object'
    ? clone(extra.candidate)
    : null;
  if (!text && !candidate) throw new Error('Custom reason content is required.');
  if (text.length > 4000 || (candidate && JSON.stringify(candidate).length > 24000)) {
    throw new Error('Custom reason content is too long.');
  }
  const targetClaimId = getReasonTargetId(state);
  if (candidate && candidate.target?.text !== model.claims[targetClaimId]?.text) {
    throw new Error('自定义候选不能改写当前正在说明的判断或原则。');
  }
  const finishedPath = {
    ...state.currentPath,
    customTargetClaimId: targetClaimId,
    status: 'custom_unverified',
    customReason: candidate || { text },
  };
  if (state.chainMode === 'counter') {
    return {
      ...state,
      counterPath: finishedPath,
      currentPath: null,
      phase: PHASES.COUNTER_IMPACT,
    };
  }
  return beginCounter(model, {
    ...state,
    mainPaths: [...state.mainPaths, finishedPath],
    currentPath: null,
  });
};

const advance = (model, originalState, optionId, extra = {}) => {
  const state = pushHistory(originalState);
  const policy = policyFor(model, state);

  switch (state.phase) {
    case PHASES.POLICY_DECISION:
      if (!['yes', 'no', 'uncertain'].includes(optionId)) throw new Error('Invalid root answer.');
      if (optionId === 'uncertain') {
        return completeCurrentPolicy(model, {
          ...state,
          rootAnswer: 'uncertain',
          diagnosisClaimId: null,
        });
      }
      if (optionId === 'yes') {
        return {
          ...state,
          rootAnswer: 'yes',
          activeFrameId: policy.rootFrameId,
          diagnosisClaimId: policy.entry.supportClaimId,
          activeClaimId: policy.entry.supportClaimId,
          currentPath: emptyPath(policy.entry.supportClaimId),
          phase: PHASES.REASON_CHOICE,
        };
      }
      return {
        ...state,
        rootAnswer: 'no',
        activeFrameId: policy.rootFrameId,
        diagnosticIndex: 0,
        phase: PHASES.REVISION_TEST,
      };

    case PHASES.REVISION_TEST: {
      const diagnostic = policy.diagnostics[state.diagnosticIndex];
      if (!['accept', 'reject', 'uncertain'].includes(optionId)) throw new Error('Invalid revision answer.');
      if (optionId === 'uncertain') {
        return completeCurrentPolicy(model, {
          ...state,
          diagnosisClaimId: null,
          unresolvedRevisionFrameId: diagnostic.candidateFrameId,
          notes: [...state.notes, `Uncertain about revision ${diagnostic.id}`],
        });
      }
      if (optionId === 'accept') {
        return {
          ...state,
          acceptedRevisionFrameId: diagnostic.candidateFrameId,
          activeFrameId: diagnostic.candidateFrameId,
          diagnosisClaimId: diagnostic.acceptedClaimId,
          activeClaimId: diagnostic.acceptedClaimId,
          currentPath: emptyPath(diagnostic.acceptedClaimId),
          phase: PHASES.REASON_CHOICE,
        };
      }
      if (state.diagnosticIndex + 1 < policy.diagnostics.length) {
        return {
          ...state,
          diagnosticIndex: state.diagnosticIndex + 1,
          phase: PHASES.REVISION_TEST,
        };
      }
      return {
        ...state,
        diagnosisClaimId: policy.fallbackOpposeClaimId,
        activeClaimId: policy.fallbackOpposeClaimId,
        currentPath: emptyPath(policy.fallbackOpposeClaimId),
        phase: PHASES.REASON_CHOICE,
      };
    }

    case PHASES.REASON_CHOICE:
      if (optionId === 'no_match') return { ...state, phase: PHASES.CUSTOM_REASON_REQUIRED };
      return beginReason(model, state, optionId);

    case PHASES.COUNTER_REASON_CHOICE:
      if (optionId === 'none') return completeCurrentPolicy(model, { ...state, counterImpact: 'no_change' });
      return beginReason(model, { ...state, phase: PHASES.REASON_CHOICE }, optionId);

    case PHASES.PREMISE_CHECK: {
      if (!['accept', 'reject', 'uncertain'].includes(optionId)) throw new Error('Invalid premise answer.');
      const reason = model.reasons[state.currentReasonId];
      if (optionId !== 'accept') {
        const next = markTried(state, state.activeClaimId, state.currentReasonId);
        const remaining = availableReasons(model, next, state.activeClaimId);
        if (!remaining.length) return { ...next, phase: PHASES.CUSTOM_REASON_REQUIRED };
        return {
          ...next,
          currentReasonId: null,
          premiseIndex: 0,
          phase: state.chainMode === 'counter' ? PHASES.COUNTER_REASON_CHOICE : PHASES.REASON_CHOICE,
          notes: [...next.notes, `${optionId} premise in ${reason.id}`],
        };
      }
      if (state.premiseIndex + 1 < reason.premises.length) {
        return { ...state, premiseIndex: state.premiseIndex + 1 };
      }
      return { ...state, phase: PHASES.RULE_CHECK };
    }

    case PHASES.RULE_CHECK: {
      if (!['accept', 'reject', 'uncertain'].includes(optionId)) throw new Error('Invalid rule answer.');
      const reason = model.reasons[state.currentReasonId];
      if (optionId !== 'accept') {
        const next = markTried(state, state.activeClaimId, state.currentReasonId);
        const remaining = availableReasons(model, next, state.activeClaimId);
        if (!remaining.length) return { ...next, phase: PHASES.CUSTOM_REASON_REQUIRED };
        return {
          ...next,
          currentReasonId: null,
          premiseIndex: 0,
          phase: state.chainMode === 'counter' ? PHASES.COUNTER_REASON_CHOICE : PHASES.REASON_CHOICE,
        };
      }
      const step = {
        claimId: state.activeClaimId,
        reasonId: reason.id,
        premiseAnswers: Object.fromEntries(reason.premises.map((premise) => [premise.id, 'accept'])),
        bridgeClaimId: reason.bridgeClaimId,
        ruleAnswer: 'accept',
      };
      return {
        ...state,
        currentPath: {
          ...state.currentPath,
          steps: [...state.currentPath.steps, step],
        },
        currentBridgeClaimId: reason.bridgeClaimId,
        phase: PHASES.WHY_OR_STOP,
      };
    }

    case PHASES.WHY_OR_STOP:
      if (optionId === 'custom') return {
        ...state,
        activeClaimId: state.currentBridgeClaimId,
        phase: PHASES.CUSTOM_REASON_REQUIRED,
      };
      if (optionId === 'stop_here') return { ...state, phase: PHASES.STRESS_TEST };
      return beginReason(model, {
        ...state,
        activeClaimId: state.currentBridgeClaimId,
      }, optionId);

    case PHASES.STRESS_TEST: {
      if (!['apply', 'qualified', 'retract', 'uncertain', 'continue_unchecked'].includes(optionId)) {
        throw new Error('Invalid stress answer.');
      }
      const finishedPath = {
        ...state.currentPath,
        status: optionId === 'continue_unchecked' ? 'unchecked'
          : optionId === 'apply' ? 'accepted'
          : optionId === 'qualified' ? 'qualified'
          : optionId === 'retract' ? 'retracted' : 'uncertain',
        stress: optionId === 'continue_unchecked' ? null : {
          response: optionId,
          distinction: extra.distinction || null,
          claimId: state.currentBridgeClaimId,
        },
      };
      if (state.chainMode === 'counter') {
        return {
          ...state,
          counterPath: finishedPath,
          currentPath: null,
          phase: PHASES.COUNTER_IMPACT,
        };
      }
      return beginCounter(model, {
        ...state,
        mainPaths: [...state.mainPaths, finishedPath],
        currentPath: null,
      });
    }

    case PHASES.COUNTER_IMPACT:
      if (!['no_change', 'weaken', 'offset', 'reverse', 'uncertain'].includes(optionId)) {
        throw new Error('Invalid counter impact.');
      }
      return completeCurrentPolicy(model, { ...state, counterImpact: optionId });

    case PHASES.CUSTOM_REASON_REQUIRED: {
      if (optionId === 'save_custom') return finishCustomReason(model, state, extra);
      if (optionId !== 'leave_unresolved') throw new Error('Invalid custom-reason response.');
      const unfinishedPath = {
        ...state.currentPath,
        status: 'unresolved',
        unresolvedTargetClaimId: getReasonTargetId(state),
      };
      return completeCurrentPolicy(model, {
        ...state,
        mainPaths: state.chainMode === 'main' ? [...state.mainPaths, unfinishedPath] : state.mainPaths,
        counterPath: state.chainMode === 'counter' ? unfinishedPath : state.counterPath,
        counterImpact: state.chainMode === 'counter' ? 'uncertain' : state.counterImpact,
        notes: [...state.notes, `Unresolved custom reason for ${getReasonTargetId(state)}`],
      });
    }

    case PHASES.POLICY_DONE:
      if (optionId === 'results') return { ...state, phase: PHASES.RESULTS };
      if (optionId !== 'next') throw new Error('Invalid policy-done answer.');
      if (state.policyPosition + 1 >= state.policyIds.length) {
        return { ...state, phase: PHASES.RESULTS };
      }
      return startSession(model, {
        ...state,
        policyPosition: state.policyPosition + 1,
        history: [],
      });

    default:
      throw new Error(`Cannot answer in phase ${state.phase}`);
  }
};

export const answer = (model, state, optionId, extra = {}) => {
  const question = getQuestion(model, state);
  const option = question.options.find((item) => item.id === optionId);
  const label = option?.label
    || (optionId === 'save_custom' ? extra.candidate?.argument?.title || '写下自己的理由' : optionId);
  const next = advance(model, state, optionId, extra);
  return {
    ...next,
    answerLog: [
      ...(state.answerLog || []),
      {
        id: (state.answerLog?.at(-1)?.id || 0) + 1,
        policyId: state.currentPolicyId,
        question: question.title,
        answer: label,
      },
    ],
    updatedAt: now(),
  };
};

export const back = (state) => {
  if (!state.history.length) return state;
  const previous = clone(state.history.at(-1));
  previous.history = state.history.slice(0, -1);
  return previous;
};

export const backToAnswer = (state, answerId) => {
  const currentAnswers = (state.answerLog || []).filter((entry) => entry.policyId === state.currentPolicyId);
  const index = currentAnswers.findIndex((entry) => entry.id === answerId);
  if (index < 0 || !state.history[index]) return state;
  const previous = clone(state.history[index]);
  previous.history = state.history.slice(0, index);
  previous.updatedAt = now();
  return previous;
};

export const openPolicy = (model, state, policyId) => {
  if (!indexPolicies(model)[policyId]) throw new Error(`Unknown selected policy ${policyId}`);
  const policyIds = state.policyIds.includes(policyId) ? state.policyIds : [...state.policyIds, policyId];
  const position = policyIds.indexOf(policyId);
  const policyResults = { ...state.policyResults };
  delete policyResults[policyId];
  return startSession(model, {
    ...state,
    policyIds,
    policyPosition: position,
    policyResults,
    history: [],
    answerLog: (state.answerLog || []).filter((entry) => entry.policyId !== policyId),
  });
};

export const skipPolicy = (model, originalState) => {
  const state = pushHistory(originalState);
  const result = {
    policyId: state.currentPolicyId,
    rootFrameId: policyFor(model, state).rootFrameId,
    rootAnswer: 'skipped',
    finalRootAnswer: 'skipped',
    acceptedRevisionFrameId: null,
    derivedConditionalAcceptance: false,
    diagnosisClaimId: null,
    mainPaths: [],
    counterClaimId: null,
    counterPath: null,
    counterImpact: null,
    completedAt: now(),
  };
  const answerLog = [
    ...(originalState.answerLog || []),
    {
      id: (originalState.answerLog?.at(-1)?.id || 0) + 1,
      policyId: originalState.currentPolicyId,
      question: policyFor(model, originalState).entry.question,
      answer: '跳过这道题',
    },
  ];
  const next = {
    ...state,
    answerLog,
    policyResults: { ...state.policyResults, [state.currentPolicyId]: result },
    updatedAt: now(),
  };
  if (state.policyPosition + 1 >= state.policyIds.length) {
    return { ...next, phase: PHASES.RESULTS };
  }
  return startSession(model, { ...next, policyPosition: state.policyPosition + 1, history: [] });
};

export const summarizePolicyResult = (model, result) => {
  const policy = indexPolicies(model)[result.policyId];
  if (!policy) return null;
  const diagnosis = result.diagnosisClaimId ? model.claims[result.diagnosisClaimId] : null;
  const mainPath = result.mainPaths?.[0] || null;
  const firstStep = mainPath?.steps?.[0] || null;
  const lastStep = mainPath?.steps?.at(-1) || null;
  const customReason = mainPath?.customReason || null;
  const counterStep = result.counterPath?.steps?.[0] || null;
  const pathDetails = {
    mainReason: firstStep?.reasonId || null,
    mainReasonTitle: firstStep ? model.reasons[firstStep.reasonId]?.title || null
      : customReason?.argument?.title || customReason?.text || null,
    deeperReason: customReason && lastStep
      ? (mainPath.customTargetClaimId ? customReason.argument?.title || customReason.text : null)
      : lastStep && !['retracted', 'unresolved'].includes(mainPath?.status)
        ? model.claims[lastStep.bridgeClaimId]?.plain || model.claims[lastStep.bridgeClaimId]?.text || null : null,
    customUnverified: Boolean(customReason || result.counterPath?.customReason),
    customTargetUnrecorded: Boolean(customReason && lastStep && !mainPath.customTargetClaimId),
    reasonUnresolved: mainPath?.status === 'unresolved' || (!mainPath && ['yes', 'no'].includes(result.rootAnswer)),
    counterReasonTitle: counterStep ? model.reasons[counterStep.reasonId]?.title || null
      : result.counterPath?.customReason?.argument?.title
        || result.counterPath?.customReason?.text || null,
    pathStatus: mainPath?.status || null,
    counterPathStatus: result.counterPath?.status || null,
  };
  if (result.rootAnswer === 'skipped') {
    return {
      title: policy.shortTitle,
      summary: '你跳过了这道题，没有形成政策判断。',
      ...pathDetails,
    };
  }
  if (result.rootAnswer === 'uncertain') {
    return {
      title: policy.shortTitle,
      summary: policy.resultTemplate.uncertain,
      ...pathDetails,
    };
  }
  if (result.rootAnswer === 'yes') {
    return {
      title: policy.shortTitle,
      summary: policy.resultTemplate.rootYes,
      counterImpact: result.counterImpact,
      ...pathDetails,
    };
  }
  if (result.acceptedRevisionFrameId) {
    const root = resolveFrame(policy, policy.rootFrameId);
    const accepted = resolveFrame(policy, result.acceptedRevisionFrameId);
    const changes = diffFrames(policy, policy.rootFrameId, result.acceptedRevisionFrameId).map((dimensionId) => ({
      dimensionId,
      label: policy.dimensions[dimensionId].label,
      from: policy.dimensions[dimensionId].values[root[dimensionId]].label,
      to: policy.dimensions[dimensionId].values[accepted[dimensionId]].label,
    }));
    return {
      title: policy.shortTitle,
      summary: policy.resultTemplate.rootNoAcceptedRevision,
      diagnosis: diagnosis?.plain || null,
      acceptedRevision: policy.frames[result.acceptedRevisionFrameId].label,
      changes,
      counterImpact: result.counterImpact,
      ...pathDetails,
    };
  }
  if (!result.diagnosisClaimId) {
    return {
      title: policy.shortTitle,
      summary: '你不接受原方案，但还没有确定哪些修改能改变判断。',
      unresolvedRevision: policy.frames[result.unresolvedRevisionFrameId]?.label || null,
      counterImpact: result.counterImpact,
      ...pathDetails,
    };
  }
  return {
    title: policy.shortTitle,
    summary: policy.resultTemplate.rootNoNoRevision,
    diagnosis: diagnosis?.plain || null,
    counterImpact: result.counterImpact,
    ...pathDetails,
  };
};
