const PREFIX_SORTS = {
  'institution:': 'Institution',
  'element:': 'PolicyElement',
  'outcome:': 'Outcome',
  'value:': 'Value',
  'agent:': 'Agent',
  'group:': 'Group',
  'scenario:': 'Scenario',
  'domain:': 'Domain',
  'proposition:': 'Proposition',
  'rule:': 'Rule',
};

export const ARGLOGIC_VERSION = 'arglogic-0.2';

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};

export const canonicalFormula = (formula) => JSON.stringify(stable(formula));

const issue = (severity, code, message, path = '', details = {}) => ({
  severity, code, message, path, ...details,
});

const isAtom = (formula) => Boolean(
  formula
  && typeof formula === 'object'
  && typeof formula.pred === 'string'
  && Array.isArray(formula.args),
);

const inferredSort = (term, entities, bindings = {}) => {
  if (typeof term === 'number') return 'Number';
  if (typeof term === 'boolean') return 'Boolean';
  if (typeof term !== 'string') return null;
  if (term.startsWith('?')) return inferredSort(bindings[term], entities, bindings);
  if (entities[term]?.sort) return entities[term].sort;
  return Object.entries(PREFIX_SORTS).find(([prefix]) => term.startsWith(prefix))?.[1] || 'Symbol';
};

const validateFormula = (formula, context, pathName, errors) => {
  if (isAtom(formula)) {
    const signature = context.signatures[formula.pred];
    if (!signature) {
      errors.push(issue('error', 'UNKNOWN_PREDICATE', `未知谓词 ${formula.pred}。`, pathName));
      return;
    }
    if (signature.length !== formula.args.length) {
      errors.push(issue(
        'error',
        'ARITY_MISMATCH',
        `谓词 ${formula.pred} 需要 ${signature.length} 个参数，实际得到 ${formula.args.length} 个。`,
        pathName,
      ));
      return;
    }
    formula.args.forEach((term, index) => {
      if (
        typeof term === 'string'
        && term.startsWith('?')
        && !Object.hasOwn(context.bindings, term)
        && !context.quantified?.has(term)
      ) {
        errors.push(issue(
          'error',
          'UNBOUND_VARIABLE',
          `变量 ${term} 没有绑定。`,
          `${pathName}.args[${index}]`,
          { term },
        ));
        return;
      }
      const actual = inferredSort(term, context.entities, context.bindings);
      const expected = signature[index];
      if (actual && expected !== 'Symbol' && actual !== expected) {
        errors.push(issue(
          'error',
          'TYPE_MISMATCH',
          `${formula.pred} 的第 ${index + 1} 个参数应为 ${expected}，实际为 ${actual}。`,
          `${pathName}.args[${index}]`,
          { expected, actual, term },
        ));
      }
    });
    return;
  }

  if (formula && typeof formula === 'object' && formula.not) {
    validateFormula(formula.not, context, `${pathName}.not`, errors);
    return;
  }

  for (const operator of ['and', 'or']) {
    if (formula && typeof formula === 'object' && Array.isArray(formula[operator])) {
      if (formula[operator].length < 2) {
        errors.push(issue('error', 'FORMULA_TOO_SHORT', `${operator} 至少需要两个子式。`, pathName));
      }
      formula[operator].forEach((child, index) => (
        validateFormula(child, context, `${pathName}.${operator}[${index}]`, errors)
      ));
      return;
    }
  }

  if (formula && typeof formula === 'object' && formula.exists) {
    const vars = formula.exists.vars;
    if (!Array.isArray(vars) || !vars.every((name) => typeof name === 'string' && name.startsWith('?'))) {
      errors.push(issue('error', 'INVALID_QUANTIFIER', '存在量词需要变量数组。', pathName));
      return;
    }
    validateFormula(formula.exists.where, {
      ...context,
      quantified: new Set([...(context.quantified || []), ...vars]),
    }, `${pathName}.exists.where`, errors);
    return;
  }

  if (typeof formula === 'string' && formula.startsWith('?')) return;
  errors.push(issue('error', 'INVALID_FORMULA', '公式不是受支持的 AST。', pathName));
};

const instantiate = (value, bindings) => {
  if (typeof value === 'string' && value.startsWith('?')) return bindings[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => instantiate(item, bindings));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, instantiate(child, bindings)]));
};

const flattenConjunction = (formula) => (
  formula && Array.isArray(formula.and)
    ? formula.and.flatMap(flattenConjunction)
    : [formula]
);

const containsFormula = (container, target) => {
  const targetKey = canonicalFormula(target);
  if (canonicalFormula(container) === targetKey) return true;
  if (container?.not) return containsFormula(container.not, target);
  if (Array.isArray(container?.and)) return container.and.some((child) => containsFormula(child, target));
  if (Array.isArray(container?.or)) return container.or.some((child) => containsFormula(child, target));
  if (container?.exists?.where) return containsFormula(container.exists.where, target);
  return false;
};

const isDirectNegation = (left, right) => (
  canonicalFormula(left?.not) === canonicalFormula(right)
  || canonicalFormula(right?.not) === canonicalFormula(left)
);

const criticalQuestionState = (scheme, answers = {}) => {
  const open = [];
  const defeated = [];
  for (const question of scheme.criticalQuestions || []) {
    const answer = answers[question.id] || 'open';
    if (answer === 'defeated') defeated.push(question);
    else if (!['satisfied', 'not_applicable'].includes(answer)) open.push(question);
  }
  return { open, defeated };
};

const comparison = {
  Eq: (left, right) => left === right,
  Ne: (left, right) => left !== right,
  Lt: (left, right) => left < right,
  Lte: (left, right) => left <= right,
  Gt: (left, right) => left > right,
  Gte: (left, right) => left >= right,
};

const resolveConstraintTerm = (term, bindings) => (
  typeof term === 'string' && term.startsWith('?') ? bindings[term] : term
);

// ponytail: bank constraints are tiny finite ASTs; move this evaluator to a Worker if they grow large.
export const evaluateConstraint = (formula, bindings = {}, assignments = {}) => {
  if (isAtom(formula)) {
    const values = formula.args.map((term) => resolveConstraintTerm(term, bindings));
    if (comparison[formula.pred]) {
      if (values.some((value) => value === undefined)) return null;
      return comparison[formula.pred](...values);
    }
    const assigned = assignments[canonicalFormula(formula)] ?? assignments[formula.pred];
    return typeof assigned === 'boolean' ? assigned : null;
  }
  if (formula?.not) {
    const value = evaluateConstraint(formula.not, bindings, assignments);
    return value === null ? null : !value;
  }
  if (Array.isArray(formula?.and)) {
    const values = formula.and.map((child) => evaluateConstraint(child, bindings, assignments));
    return values.includes(false) ? false : values.includes(null) ? null : true;
  }
  if (Array.isArray(formula?.or)) {
    const values = formula.or.map((child) => evaluateConstraint(child, bindings, assignments));
    return values.includes(true) ? true : values.includes(null) ? null : false;
  }
  return null;
};

export const deriveAttackGraph = (formalizations = []) => {
  const attacks = [];
  const add = (sourceArgumentId, targetArgumentId, kind, basis) => {
    if (sourceArgumentId !== targetArgumentId) attacks.push({ sourceArgumentId, targetArgumentId, kind, basis });
  };
  for (const source of formalizations) {
    for (const explicit of source.explicitAttacks || []) {
      add(source.argumentId, explicit.targetArgumentId, explicit.kind, 'explicit');
    }
    for (const target of formalizations) {
      if (source.argumentId === target.argumentId) continue;
      const left = source.conclusion?.formula;
      const right = target.conclusion?.formula;
      const oppositeReasons = ['ReasonFor', 'ReasonAgainst'].includes(left?.pred)
        && ['ReasonFor', 'ReasonAgainst'].includes(right?.pred)
        && left.pred !== right.pred
        && canonicalFormula(left.args) === canonicalFormula(right.args);
      if (isDirectNegation(left, right) || oppositeReasons) {
        add(source.argumentId, target.argumentId, 'rebut', 'conclusion_conflict');
      }
      if ((target.premises || []).some((premise) => isDirectNegation(left, premise.formula))) {
        add(source.argumentId, target.argumentId, 'undermine', 'premise_conflict');
      }
      const targetRule = target.bindings?.['?rule'];
      if (targetRule && (source.premises || []).some((premise) => (
        premise.formula?.pred === 'UndercutsRule' && premise.formula.args?.[0] === targetRule
      ))) add(source.argumentId, target.argumentId, 'undercut', 'rule_exception');
    }
  }
  return [...new Map(attacks.map((attack) => [
    `${attack.sourceArgumentId}|${attack.targetArgumentId}|${attack.kind}`,
    attack,
  ])).values()];
};

export const groundedLabelling = (argumentIds, attacks = []) => {
  const ids = [...new Set(argumentIds)];
  const active = new Set(ids);
  const incoming = new Map(ids.map((id) => [id, new Set()]));
  attacks.forEach((attack) => {
    if (active.has(attack.sourceArgumentId) && active.has(attack.targetArgumentId)) {
      incoming.get(attack.targetArgumentId).add(attack.sourceArgumentId);
    }
  });
  const accepted = new Set();
  const rejected = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ids) {
      if (accepted.has(id) || rejected.has(id)) continue;
      if ([...incoming.get(id)].every((attacker) => rejected.has(attacker))) {
        accepted.add(id);
        changed = true;
      }
    }
    for (const id of ids) {
      if (accepted.has(id) || rejected.has(id)) continue;
      if ([...incoming.get(id)].some((attacker) => accepted.has(attacker))) {
        rejected.add(id);
        changed = true;
      }
    }
  }
  return Object.fromEntries(ids.map((id) => [
    id,
    accepted.has(id) ? 'accepted' : rejected.has(id) ? 'rejected' : 'undecided',
  ]));
};

export const labelDialecticalPair = (mainArgumentId, defeaterArgumentId, effect) => {
  if (!defeaterArgumentId || ['reject', 'none_accepted'].includes(effect)) {
    return { [mainArgumentId]: 'accepted', ...(defeaterArgumentId ? { [defeaterArgumentId]: 'rejected' } : {}) };
  }
  if (effect === 'supplement') {
    return { [mainArgumentId]: 'accepted', [defeaterArgumentId]: 'accepted' };
  }
  const attacks = effect === 'outweigh'
    ? [{ sourceArgumentId: defeaterArgumentId, targetArgumentId: mainArgumentId, kind: 'rebut' }]
    : effect === 'weaken'
      ? [{ sourceArgumentId: mainArgumentId, targetArgumentId: defeaterArgumentId, kind: 'rebut' }]
      : [
          { sourceArgumentId: mainArgumentId, targetArgumentId: defeaterArgumentId, kind: 'rebut' },
          { sourceArgumentId: defeaterArgumentId, targetArgumentId: mainArgumentId, kind: 'rebut' },
        ];
  return groundedLabelling([mainArgumentId, defeaterArgumentId], attacks);
};

export const validateArgument = (argument, bundle, catalog) => {
  const errors = [];
  const warnings = [];
  const argumentId = argument?.argumentId || null;
  if (!argument || typeof argument !== 'object' || Array.isArray(argument)) {
    errors.push(issue('error', 'INVALID_ARGUMENT', '形式化论证必须是对象。', '$'));
    return { argumentId, ok: false, wellFormed: false, locallyLicensed: false, errors, warnings };
  }
  if (argument.languageVersion !== catalog?.languageVersion) {
    errors.push(issue(
      'error',
      'LANGUAGE_VERSION_MISMATCH',
      `形式语言版本 ${argument.languageVersion || '未标注'} 与方案目录 ${catalog?.languageVersion || '未标注'} 不一致。`,
      '$.languageVersion',
    ));
  }
  if (!Array.isArray(argument.premises) || !argument.premises.length) {
    errors.push(issue('error', 'INVALID_PREMISES', '形式化论证至少需要一个前提。', '$.premises'));
  }
  if (!argument.conclusion?.formula) {
    errors.push(issue('error', 'INVALID_CONCLUSION', '形式化论证缺少结论公式。', '$.conclusion'));
  }
  const scheme = catalog?.schemes?.find((item) => item.id === argument.schemeId);
  if (!scheme) {
    errors.push(issue('error', 'UNKNOWN_SCHEME', `未知论证方案 ${argument.schemeId}。`, '$.schemeId'));
    return { argumentId, ok: false, wellFormed: false, locallyLicensed: false, errors, warnings };
  }

  const context = {
    signatures: catalog.predicateSignatures || {},
    entities: bundle.entities || {},
    bindings: argument.bindings || {},
  };

  for (const [variable, term] of Object.entries(argument.bindings || {})) {
    if (!variable.startsWith('?')) {
      errors.push(issue('error', 'INVALID_BINDING_NAME', `绑定名 ${variable} 不是变量。`, '$.bindings'));
    }
    if (term === undefined || term === null) {
      errors.push(issue('error', 'MISSING_BINDING', `变量 ${variable} 没有绑定。`, '$.bindings'));
    }
  }

  (argument.premises || []).forEach((premise, index) => {
    validateFormula(premise.formula, context, `$.premises[${index}].formula`, errors);
    if (premise.contextId && premise.contextId !== argument.contextId) {
      errors.push(issue(
        'error',
        'CONTEXT_MISMATCH',
        `前提 ${premise.id} 来自 ${premise.contextId}，当前论证情景为 ${argument.contextId}。`,
        `$.premises[${index}].contextId`,
      ));
    }
  });
  if (argument.conclusion?.formula) {
    validateFormula(argument.conclusion.formula, context, '$.conclusion.formula', errors);
  }
  (argument.constraints || []).forEach((constraint, index) => {
    const pathName = `$.constraints[${index}]`;
    validateFormula(constraint, context, pathName, errors);
    const result = evaluateConstraint(constraint, argument.bindings || {});
    if (result === false) {
      errors.push(issue('error', 'CONSTRAINT_UNSATISFIED', '数值或命题约束不成立。', pathName));
    } else if (result === null) {
      warnings.push(issue('warning', 'CONSTRAINT_UNDETERMINED', '数值或命题约束仍缺少可判定值。', pathName));
    }
  });

  const available = (argument.premises || []).flatMap((premise) => (
    flattenConjunction(premise.formula).map((formula) => ({
      premiseId: premise.id,
      claimRef: premise.claimRef,
      formula,
    }))
  ));
  const availableKeys = new Map(available.map((item) => [canonicalFormula(item.formula), item]));

  const missingPremises = [];
  for (const requirement of scheme.requiredPremises || []) {
    const expected = instantiate(requirement.pattern, argument.bindings || {});
    if (!availableKeys.has(canonicalFormula(expected))) {
      missingPremises.push({ slot: requirement.slot, expected });
      errors.push(issue(
        'error',
        'MISSING_REQUIRED_PREMISE',
        `方案“${scheme.label}”缺少必需前提槽位：${requirement.slot}。`,
        '$.premises',
        { slot: requirement.slot, expected },
      ));
    }
  }

  const expectedConclusion = instantiate(scheme.conclusionPattern, argument.bindings || {});
  if (canonicalFormula(expectedConclusion) !== canonicalFormula(argument.conclusion?.formula)) {
    errors.push(issue(
      'error',
      'CONCLUSION_PATTERN_MISMATCH',
      `结论与方案“${scheme.label}”的后件不一致。`,
      '$.conclusion.formula',
      { expected: expectedConclusion, actual: argument.conclusion?.formula },
    ));
  }

  if (scheme.actionBinding && scheme.allowedActionKinds?.length) {
    const actionId = argument.bindings?.[scheme.actionBinding];
    const actionKind = bundle.entities?.[actionId]?.actionKind;
    if (!scheme.allowedActionKinds.includes(actionKind)) {
      errors.push(issue(
        'error',
        'ACTION_KIND_MISMATCH',
        `方案“${scheme.label}”只适用于 ${scheme.allowedActionKinds.join('、')}，当前对象为 ${actionKind || '未标注'}。`,
        `$.bindings.${scheme.actionBinding}`,
        { actionId, actionKind, allowed: scheme.allowedActionKinds },
      ));
    }
  }

  for (const premise of argument.premises || []) {
    if (
      premise.claimRef
      && argument.conclusion?.claimRef
      && premise.claimRef === argument.conclusion.claimRef
    ) {
      errors.push(issue(
        'error',
        'QUESTION_BEGGING',
        `前提 ${premise.id} 直接引用了待支持的结论。`,
        '$.premises',
        { premiseId: premise.id },
      ));
    } else if (containsFormula(premise.formula, argument.conclusion?.formula)) {
      errors.push(issue(
        'error',
        'QUESTION_BEGGING',
        `前提 ${premise.id} 已经包含结论的形式内容。`,
        '$.premises',
        { premiseId: premise.id },
      ));
    }
  }

  for (let left = 0; left < available.length; left += 1) {
    for (let right = left + 1; right < available.length; right += 1) {
      if (isDirectNegation(available[left].formula, available[right].formula)) {
        errors.push(issue(
          'error',
          'INCONSISTENT_PREMISES',
          `前提 ${available[left].premiseId} 与 ${available[right].premiseId} 互相否定。`,
          '$.premises',
        ));
      }
    }
  }

  const supportedElements = [];
  if (scheme.actionBinding && argument.bindings?.[scheme.actionBinding]) {
    supportedElements.push(argument.bindings[scheme.actionBinding]);
  } else {
    supportedElements.push(...(argument.conclusion.targetElementIds || []));
  }

  const sourceTargets = argument.sourceTargetElementIds || argument.conclusion.targetElementIds || [];
  const unsupportedTargetElements = sourceTargets.filter((id) => !supportedElements.includes(id));
  if (unsupportedTargetElements.length) {
    errors.push(issue(
      'error',
      'CONCLUSION_OVERREACH',
      `当前规则只支持 ${supportedElements.join('、') || '未标注元素'}，但源结论还覆盖 ${unsupportedTargetElements.join('、')}。`,
      '$.sourceTargetElementIds',
      { supportedElements, unsupportedTargetElements },
    ));
  }

  const questionState = criticalQuestionState(scheme, argument.criticalQuestionAnswers);
  questionState.open.forEach((question) => warnings.push(issue(
    'warning',
    'OPEN_CRITICAL_QUESTION',
    `${question.label} 尚未解决。`,
    `$.criticalQuestionAnswers.${question.id}`,
    { criticalQuestionId: question.id },
  )));
  questionState.defeated.forEach((question) => errors.push(issue(
    'error',
    'CRITICAL_QUESTION_DEFEATS',
    `${question.label} 当前回答会击败这条推理。`,
    `$.criticalQuestionAnswers.${question.id}`,
    { criticalQuestionId: question.id },
  )));

  const structuralErrors = new Set([
    'INVALID_ARGUMENT',
    'LANGUAGE_VERSION_MISMATCH',
    'INVALID_PREMISES',
    'INVALID_CONCLUSION',
    'UNKNOWN_SCHEME',
    'UNKNOWN_PREDICATE',
    'ARITY_MISMATCH',
    'TYPE_MISMATCH',
    'INVALID_FORMULA',
    'FORMULA_TOO_SHORT',
    'INVALID_QUANTIFIER',
    'UNBOUND_VARIABLE',
    'INVALID_BINDING_NAME',
    'MISSING_BINDING',
    'CONTEXT_MISMATCH',
    'ACTION_KIND_MISMATCH',
    'QUESTION_BEGGING',
    'INCONSISTENT_PREMISES',
  ]);
  const wellFormed = !errors.some((item) => structuralErrors.has(item.code));
  const locallyLicensed = wellFormed && !errors.some((item) => [
    'MISSING_REQUIRED_PREMISE',
    'CONCLUSION_PATTERN_MISMATCH',
    'CONCLUSION_OVERREACH',
    'CRITICAL_QUESTION_DEFEATS',
    'CONSTRAINT_UNSATISFIED',
  ].includes(item.code));

  const inferenceStatus = !wellFormed
    ? 'ill_formed'
    : !locallyLicensed
      ? 'unlicensed'
      : scheme.inferenceKind === 'strict'
        ? 'strict_rule_licensed'
        : questionState.open.length
          ? 'open_critical_questions'
          : 'defeasibly_licensed';

  return {
    argumentId: argument.argumentId,
    schemeId: scheme.id,
    schemeLabel: scheme.label,
    inferenceKind: scheme.inferenceKind,
    ok: errors.length === 0,
    wellFormed,
    locallyLicensed,
    inferenceStatus,
    formalStatus: wellFormed && locallyLicensed ? 'qualified' : 'error',
    scopeStatus: unsupportedTargetElements.length ? 'overreach' : 'within_scope',
    dialecticalStatus: questionState.defeated.length
      ? 'rejected'
      : questionState.open.length ? 'undecided' : 'accepted',
    certificateHash: bundle.formalIndex?.nodes?.[argument.argumentId]?.certificateHash || null,
    missingPremises,
    supportedElements,
    unsupportedTargetElements,
    criticalQuestions: (scheme.criticalQuestions || []).map((item) => ({ ...item })),
    openCriticalQuestions: questionState.open.map((item) => item.id),
    errors,
    warnings,
  };
};

const runtimeCache = new Map();

const runtimeQuestionState = (certificate, argument, responses) => {
  const answers = { ...(argument.criticalQuestionAnswers || {}), ...(responses || {}) };
  return criticalQuestionState({ criticalQuestions: certificate.criticalQuestions || [] }, answers);
};

export const nextCriticalQuestion = (certificate, argument, responses = {}) => {
  if (!certificate?.wellFormed || !certificate?.locallyLicensed || !argument) return null;
  return [...(certificate.criticalQuestions || [])]
    .sort((left, right) => (left.priority || 100) - (right.priority || 100))
    .find((question) => {
      if (Object.hasOwn(responses, question.id)) return false;
      const answer = argument.criticalQuestionAnswers?.[question.id] || 'open';
      return !['satisfied', 'not_applicable', 'defeated'].includes(answer);
    }) || null;
};

export const evaluateFormalCheck = (
  certificate,
  argument,
  factResponses = {},
  bridgeResponse = null,
  options = {},
) => {
  if (!certificate || !argument) {
    return {
      version: ARGLOGIC_VERSION,
      certificateHash: null,
      wellFormed: null,
      locallyLicensed: null,
      formalStatus: 'not_formalized',
      inferenceStatus: 'not_formalized',
      evidenceStatus: 'not_evaluated',
      scopeStatus: 'not_evaluated',
      dialecticalStatus: 'not_evaluated',
      missingPremises: [],
      unsupportedTargetElements: [],
      openCriticalQuestions: [],
      errors: [],
      warnings: [issue('warning', 'FORMALIZATION_MISSING', '这条理由尚未完成形式化。')],
    };
  }

  const cacheKey = canonicalFormula({
    modelVersion: options.modelVersion || 'unknown',
    argumentId: argument.argumentId,
    factResponses,
    bridgeResponse,
    criticalQuestionResponses: options.criticalQuestionResponses || {},
    dialecticalStatus: options.dialecticalStatus || null,
  });
  if (runtimeCache.has(cacheKey)) return runtimeCache.get(cacheKey);

  const source = argument.source || {};
  const factValues = (source.factIds || []).map((factId) => factResponses[factId]);
  const premiseValues = (argument.premises || []).map((premise) => {
    if ((source.factIds || []).includes(premise.claimRef)) return factResponses[premise.claimRef];
    if (premise.claimRef === source.bridgeClaimId) {
      if (bridgeResponse === 'accept') return 'true';
      if (bridgeResponse === 'reject') return 'false';
      return 'unknown';
    }
    return premise.status === 'axiom' ? 'true' : undefined;
  });
  const bridgeValue = source.bridgeClaimId ? bridgeResponse : null;
  const evidenceValues = [...factValues, ...premiseValues];
  const evidenceStatus = evidenceValues.includes('false') || bridgeValue === 'reject'
    ? 'rejected'
    : evidenceValues.some((value) => value !== 'true')
      || (source.bridgeClaimId && bridgeValue !== 'accept')
      ? 'undetermined'
      : 'established';

  const questionState = runtimeQuestionState(
    certificate,
    argument,
    options.criticalQuestionResponses,
  );
  const baseErrors = (certificate.errors || []).filter((item) => item.code !== 'CRITICAL_QUESTION_DEFEATS');
  const baseWarnings = (certificate.warnings || []).filter((item) => item.code !== 'OPEN_CRITICAL_QUESTION');
  const errors = [
    ...baseErrors,
    ...questionState.defeated.map((question) => issue(
      'error',
      'CRITICAL_QUESTION_DEFEATS',
      `${question.label} 当前回答会击败这条推理。`,
      `$.criticalQuestionAnswers.${question.id}`,
      { criticalQuestionId: question.id },
    )),
  ];
  const warnings = [
    ...baseWarnings,
    ...questionState.open.map((question) => issue(
      'warning',
      'OPEN_CRITICAL_QUESTION',
      `${question.label} 尚未解决。`,
      `$.criticalQuestionAnswers.${question.id}`,
      { criticalQuestionId: question.id },
    )),
  ];
  const locallyLicensed = certificate.locallyLicensed && questionState.defeated.length === 0;
  const inferenceStatus = !certificate.wellFormed
    ? 'ill_formed'
    : !locallyLicensed
      ? 'unlicensed'
      : questionState.open.length
        ? 'open_critical_questions'
        : certificate.inferenceKind === 'strict' ? 'strict_rule_licensed' : 'defeasibly_licensed';
  const dialecticalStatus = evidenceStatus === 'rejected'
    || questionState.defeated.length
    || options.dialecticalStatus === 'rejected'
    ? 'rejected'
    : evidenceStatus !== 'established'
      || questionState.open.length
      || options.dialecticalStatus === 'undecided'
      ? 'undecided'
      : options.dialecticalStatus || 'accepted';

  const result = {
    version: argument.languageVersion,
    certificateHash: certificate.certificateHash || null,
    schemeId: certificate.schemeId,
    schemeLabel: certificate.schemeLabel,
    wellFormed: certificate.wellFormed,
    locallyLicensed,
    formalStatus: certificate.wellFormed && locallyLicensed ? 'qualified' : 'error',
    inferenceStatus,
    evidenceStatus,
    scopeStatus: certificate.scopeStatus || 'not_evaluated',
    dialecticalStatus,
    missingPremises: certificate.missingPremises || [],
    unsupportedTargetElements: certificate.unsupportedTargetElements || [],
    openCriticalQuestions: questionState.open.map((item) => item.id),
    errors,
    warnings,
  };
  if (runtimeCache.size >= 500) runtimeCache.clear();
  runtimeCache.set(cacheKey, result);
  return result;
};
