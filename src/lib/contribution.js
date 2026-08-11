import {
  CONSENT_VERSION,
  CONTRIBUTION_SCHEMA,
  CONTRIBUTION_VERSION,
  normalizeContributionPackage,
} from '../../shared/contribution-contract.js';
import {
  argumentsById,
  claims,
  facts,
  formalCertificates,
} from '../data/model.js';
import { ARGLOGIC_VERSION, evaluateFormalCheck } from './formalValidator.js';

const formalCheckFrom = (step) => {
  const argument = argumentsById[step.argumentId];
  return evaluateFormalCheck(
    formalCertificates[argument?.id],
    argument?.formalization,
    step.factResponses,
    step.bridgeResponse,
  );
};

const toTarget = (claimId, fallbackKind = 'bridge') => {
  const claim = claims[claimId];
  return {
    kind: claim?.kind === 'policy' ? 'policy' : fallbackKind,
    text: claim.text,
  };
};

const toFact = (factId) => {
  const fact = facts[factId];
  return {
    kind: ['stipulated', 'empirical', 'descriptive'].includes(fact?.kind) ? fact.kind : 'descriptive',
    statement: fact.statement,
    plainExplanation: fact?.plainExplanation || fact?.note || '请独立判断这项事实是否成立。',
    truthConditions: fact?.truthConditions || '需要有可核查的信息支持这项事实。',
    plainTruthConditions: fact?.plainTruthConditions || fact?.truthConditions || '有可核查的信息支持这项事实。',
    falsifier: fact?.falsifier || '出现与这项事实直接冲突的可靠信息。',
    plainFalsifier: fact?.plainFalsifier || fact?.falsifier || '有可靠信息能够否定这项事实。',
    response: 'true',
  };
};

const toBridge = (claimId, isFinal) => {
  const claim = claims[claimId];
  return {
    kind: isFinal ? 'terminal' : 'bridge',
    shortLabel: claim.shortLabel,
    text: claim.text,
    explanation: claim?.explanation || '这条原则说明事实为什么能为上一层结论增加一项理由。',
    example: claim?.example || '在对象不同但结构相同的情境中，也需要重新检查这条原则。',
    response: 'accept',
  };
};

const stressTestFrom = (chain) => {
  const claim = claims[chain.terminal.claimId];
  const source = chain.stress?.test || claim?.stressTest || {};
  const response = chain.stress?.response;
  const relevantDistinction = ['qualified', 'distinction', 'qualified_exception'].includes(response);
  return {
    scenario: source.scenario
      || claim?.example
      || '把这条原则应用到政治对象不同、但事实与限制结构相同的案例。',
    question: source.question || '在这个结构相同的案例中，你是否仍接受这条原则？',
    response: relevantDistinction ? 'relevant_distinction' : 'applies',
    distinction: relevantDistinction ? chain.stress?.distinction : null,
  };
};

const defeaterReviewFrom = (chain) => {
  const review = chain.defeaterReview;
  const argument = argumentsById[review?.argumentId];
  return {
    argumentTitle: argument?.title || null,
    facts: (argument?.factIds || []).map((factId) => ({
      statement: facts[factId].statement,
      response: review.factResponses?.[factId] || 'unknown',
    })),
    bridge: argument ? {
      text: claims[argument.bridgeClaimId].text,
      response: review.bridgeResponse || 'uncertain',
    } : null,
    effect: review.effect || review.impact,
    stanceBefore: review.stanceBefore || chain.direction,
    stanceAfter: review.stanceAfter || chain.direction,
  };
};

export const contributionEligibility = (state, chain) => {
  const reasons = [];
  if (!chain || chain.status !== 'complete') reasons.push('这条理由链尚未闭合。');
  if (chain?.matchingStatus !== 'active') reasons.push('这条理由链当前不是可用于报告或匹配的有效路径。');
  if (!chain?.steps?.length) reasons.push('论证没有已确认步骤。');
  if (chain?.steps?.some((step) => (
    Object.values(step.factResponses || {}).some((response) => response !== 'true')
    || step.bridgeResponse !== 'accept'
  ))) reasons.push('仍有事实或规范原则未被完整接受。');
  if (chain?.terminal?.status !== 'provisional_fixed_point') reasons.push('当前基本价值尚未被独立确认。');
  if (!chain?.stress || ['unexplained_exception', 'qualified_exception', 'retract', 'uncertain'].includes(chain.stress.response)) {
    reasons.push('压力测试仍有未说明张力。');
  }
  if (chain?.steps?.some((step) => step.assessmentMode !== 'real_world_belief')) {
    reasons.push('只有现实判断模式确认的经验前提可以进入公开贡献。');
  }
  for (const step of chain?.steps || []) {
    const argument = argumentsById[step.argumentId];
    const formalCheck = formalCheckFrom(step);
    if (argument?.formalization && !formalCertificates[argument.id]) {
      reasons.push('当前题库缺少这条论证的形式检查证书。');
      break;
    }
    if (argument?.formalization && formalCheck.version !== argument.formalization.languageVersion) {
      reasons.push('形式检查证书版本与当前题库不一致。');
      break;
    }
    if (formalCheck.errors?.length) {
      reasons.push(`形式检查仍有错误：${formalCheck.errors.map((item) => item.code).join('、')}。`);
      break;
    }
  }
  if (chain?.scopeConflicts?.length) reasons.push('仍有未说明的适用范围冲突。');
  if (chain?.compatibilityIssues?.length) reasons.push('论证依赖与其他路径不相容的事实情景。');
  if (!chain?.defeaterReview) reasons.push('尚未完成最强反方理由复核。');
  if (chain?.defeaterReview && !chain.defeaterReview.argumentId
    && (chain.defeaterReview.effect || chain.defeaterReview.impact) !== 'none_accepted') {
    reasons.push('最强反方理由的复核结果缺少对应论证。');
  }
  if (chain?.defeaterReview?.argumentId) {
    const defeater = argumentsById[chain.defeaterReview.argumentId];
    const reviewedFactIds = Object.keys(chain.defeaterReview.factResponses || {});
    if (!defeater
      || chain.defeaterReview.bridgeClaimId !== defeater.bridgeClaimId
      || reviewedFactIds.length !== defeater.factIds.length
      || !defeater.factIds.every((factId) => reviewedFactIds.includes(factId))) {
      reasons.push('最强反方理由引用了当前题库无法解析的结构。');
    } else if (defeater.factIds.some((factId) => !['true', 'false'].includes(chain.defeaterReview.factResponses?.[factId]))) {
      reasons.push('最强反方理由仍有事实前提未判断。');
    }
    if (!['accept', 'reject'].includes(chain.defeaterReview.bridgeResponse)) {
      reasons.push('最强反方理由的判断依据仍未决定。');
    }
    if (defeater) {
      const established = defeater.factIds.every((factId) => chain.defeaterReview.factResponses?.[factId] === 'true')
        && chain.defeaterReview.bridgeResponse === 'accept';
      const effect = chain.defeaterReview.effect || chain.defeaterReview.impact;
      if (effect === 'none_accepted'
        || (established && effect === 'reject')
        || (!established && ['supplement', 'weaken', 'offset', 'outweigh'].includes(effect))) {
        reasons.push('最强反方理由是否成立与复核结果不一致。');
      }
    }
  }
  if (['weaken', 'offset', 'outweigh'].includes(chain?.defeaterReview?.effect || chain?.defeaterReview?.impact)) {
    reasons.push('最强反方理由已经削弱或改变当前政策立场。');
  }
  if (state.pendingConflict?.chainId === chain?.id) reasons.push('当前论证仍有未处理冲突。');
  if ((state.modelGaps || []).some((gap) => gap.chainId === chain?.id)) {
    reasons.push('当前论证仍有题库未覆盖的缺口。');
  }
  if (chain?.stress?.response === 'qualified_exception'
    && !chain.stress.distinction?.trim()) {
    reasons.push('压力测试的相关区别尚未写清楚。');
  }
  if (chain) {
    if (!claims[chain.targetClaimId] || !claims[chain.terminal?.claimId]) {
      reasons.push('论证引用了当前题库无法解析的结论。');
    }
    for (const step of chain.steps || []) {
      const argument = argumentsById[step.argumentId];
      if (!argument || !claims[step.targetClaimId] || !claims[step.bridgeClaimId]) {
        reasons.push('论证引用了当前题库无法解析的结构节点。');
        break;
      }
      if (argument.factIds.some((factId) => !facts[factId])) {
        reasons.push('论证引用了当前题库无法解析的事实。');
        break;
      }
    }
  }
  return { eligible: reasons.length === 0, reasons };
};

export const listCompleteArguments = (state) => Object.values(state.records)
  .flatMap((record) => record.chains || [])
  .filter((chain) => contributionEligibility(state, chain).eligible);

export const buildContributionPackage = (state, chain) => {
  const eligibility = contributionEligibility(state, chain);
  if (!eligibility.eligible) return { ok: false, reasons: eligibility.reasons };
  const finalIndex = chain.steps.length - 1;
  const formalizedSteps = chain.steps.filter((step) => argumentsById[step.argumentId]?.formalization).length;
  const value = {
    schema: CONTRIBUTION_SCHEMA,
    version: CONTRIBUTION_VERSION,
    bankVersion: state.modelVersion,
    consentVersion: CONSENT_VERSION,
    status: 'complete',
    checks: {
      noUnresolvedConflicts: true,
      noModelGaps: true,
      formalValidationVersion: ARGLOGIC_VERSION,
      noFormalErrors: true,
      formalizationCoverage: formalizedSteps === chain.steps.length
        ? 'complete'
        : formalizedSteps ? 'partial' : 'none',
    },
    argument: {
      direction: ['support', 'oppose'].includes(chain.direction) ? chain.direction : 'undirected',
      target: toTarget(chain.targetClaimId, 'policy'),
      steps: chain.steps.map((step, index) => {
        const argument = argumentsById[step.argumentId];
        return {
          target: toTarget(step.targetClaimId, index === 0 ? 'policy' : 'bridge'),
          facts: (argument?.factIds || Object.keys(step.factResponses || {})).map(toFact),
          bridge: toBridge(step.bridgeClaimId, index === finalIndex),
          inference: 'defeasible_support',
        };
      }),
      fixedPoint: {
        claimText: claims[chain.terminal.claimId].text,
        confirmation: 'independently_accepted',
      },
      stressTest: stressTestFrom(chain),
      defeaterReview: defeaterReviewFrom(chain),
    },
  };
  const normalized = normalizeContributionPackage(value);
  return normalized.ok
    ? normalized
    : { ok: false, reasons: normalized.issues.map((item) => `${item.path}: ${item.code}`) };
};
