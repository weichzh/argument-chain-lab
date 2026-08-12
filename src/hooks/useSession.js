import { useCallback, useEffect, useMemo, useState } from 'react';
import { getModelV4 } from '../lib/modelV4.js';
import {
  PHASES,
  answer,
  back,
  backToAnswer,
  createSession,
  openPolicy,
  skipPolicy,
  startSession,
} from '../lib/decisionEngine.js';
import { migrateLegacySessionV09 } from '../lib/sessionMigration.js';

export const STORAGE_KEY = 'argument-chain-lab:progress:v10';
const LEGACY_STORAGE_KEYS = Array.from(
  { length: 9 },
  (_, index) => `argument-chain-lab:progress:v${9 - index}`,
);
const DRAFT_PREFIX = 'argument-chain-lab:draft:v10:';
const STORAGE_VERSION = 10;

export const VIEWS = Object.freeze({
  LANDING: 'landing',
  QUESTIONNAIRE: 'questionnaire',
  OVERVIEW: 'overview',
  RESULTS: 'results',
});

const freshState = (model, retained = {}) => ({
  ...startSession(model, createSession(model)),
  storageVersion: STORAGE_VERSION,
  startedAt: null,
  view: VIEWS.LANDING,
  migrationNotice: null,
  legacyArchive: null,
  entertainmentEnabled: false,
  ...retained,
});

const normalizeCurrentState = (value, model) => {
  const compatibleModel = value?.modelVersion === model.meta.version
    || (value?.modelVersion === '1.0.0' && model.meta.version === '1.1.0');
  if (value?.storageVersion !== STORAGE_VERSION || !compatibleModel) return null;
  const allPolicyIds = [...model.policies]
    .sort((left, right) => left.order - right.order)
    .map((policy) => policy.id);
  const defaultPolicyIds = model.product.defaultPolicyIds?.length
    ? model.product.defaultPolicyIds
    : allPolicyIds;
  const savedPolicyIds = Array.isArray(value.policyIds) ? value.policyIds : [];
  const extraPolicyIds = [...savedPolicyIds, ...Object.keys(value.policyResults || {}), value.currentPolicyId]
    .filter((policyId, index, items) => (
      allPolicyIds.includes(policyId)
      && !defaultPolicyIds.includes(policyId)
      && items.indexOf(policyId) === index
    ));
  const policyIds = [...defaultPolicyIds, ...extraPolicyIds];
  const currentPolicyId = policyIds.includes(value.currentPolicyId) ? value.currentPolicyId : policyIds[0];
  const policyPosition = Math.max(0, policyIds.indexOf(currentPolicyId));
  return {
    ...freshState(model),
    ...value,
    modelVersion: model.meta.version,
    policyIds,
    policyPosition,
    currentPolicyId,
    policyResults: value.policyResults && typeof value.policyResults === 'object' ? value.policyResults : {},
    history: Array.isArray(value.history)
      ? value.history.map((snapshot) => ({ ...snapshot, modelVersion: model.meta.version }))
      : [],
    answerLog: Array.isArray(value.answerLog) ? value.answerLog : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
    entertainmentEnabled: value.entertainmentEnabled === true,
    view: Object.values(VIEWS).includes(value.view) ? value.view : VIEWS.LANDING,
  };
};

const loadState = (model) => {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeCurrentState(JSON.parse(current), model) || freshState(model);
    const legacyRaw = LEGACY_STORAGE_KEYS
      .map((key) => window.localStorage.getItem(key))
      .find(Boolean);
    if (!legacyRaw) return freshState(model);
    const migrated = migrateLegacySessionV09(JSON.parse(legacyRaw), model);
    return freshState(model, {
      legacyArchive: migrated.legacyArchive,
      migrationNotice: migrated.migrationNotice,
    });
  } catch {
    return freshState(model, {
      migrationNotice: '本地旧进度无法读取，当前已从新版问卷重新开始。原文件不会自动上传。',
    });
  }
};

const clearDrafts = () => {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Draft persistence is optional.
  }
};

export const sessionDraftKey = (claimId) => `${DRAFT_PREFIX}${claimId || 'unknown'}`;

const nextUnansweredPolicy = (model, state) => (
  state.policyIds
    .map((policyId) => model.policies.find((policy) => policy.id === policyId))
    .find((policy) => policy && !state.policyResults[policy.id])?.id || null
);

export function useSession() {
  const model = getModelV4();
  const [state, setState] = useState(() => loadState(model));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // The questionnaire still works when local persistence is unavailable.
    }
  }, [state]);

  const dispatch = useCallback((action) => {
    setState((current) => {
      let next = current;
      switch (action.type) {
        case 'START': {
          if (!current.startedAt) {
            next = startSession(model, {
              ...createSession(model),
              storageVersion: STORAGE_VERSION,
              legacyArchive: current.legacyArchive,
              migrationNotice: current.migrationNotice,
            });
          } else if (current.phase === PHASES.RESULTS) {
            const policyId = nextUnansweredPolicy(model, current);
            next = policyId ? openPolicy(model, current, policyId) : current;
          }
          return { ...next, view: next.phase === PHASES.RESULTS ? VIEWS.RESULTS : VIEWS.QUESTIONNAIRE };
        }
        case 'ANSWER':
          next = answer(model, current, action.optionId, action.extra);
          return { ...next, view: next.phase === PHASES.RESULTS ? VIEWS.RESULTS : VIEWS.QUESTIONNAIRE };
        case 'GO_BACK':
          return { ...back(current), view: VIEWS.QUESTIONNAIRE };
        case 'BACK_TO_ANSWER':
          return { ...backToAnswer(current, action.answerId), view: VIEWS.QUESTIONNAIRE };
        case 'SKIP_POLICY':
          next = skipPolicy(model, current);
          return { ...next, view: next.phase === PHASES.RESULTS ? VIEWS.RESULTS : VIEWS.QUESTIONNAIRE };
        case 'OPEN_POLICY':
          return { ...openPolicy(model, current, action.policyId), view: VIEWS.QUESTIONNAIRE };
        case 'OPEN_OVERVIEW':
          return { ...current, view: VIEWS.OVERVIEW };
        case 'SHOW_RESULTS':
          return { ...current, view: VIEWS.RESULTS };
        case 'ENABLE_ENTERTAINMENT':
          return { ...current, entertainmentEnabled: true };
        case 'EXIT_TO_LANDING':
          return { ...current, view: VIEWS.LANDING };
        case 'DISMISS_MIGRATION':
          return { ...current, migrationNotice: null };
        case 'RESET':
          clearDrafts();
          return freshState(model);
        default:
          return current;
      }
    });
  }, [model]);

  const clearLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Continue with the in-memory reset.
    }
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const controls = useMemo(() => {
    const results = Object.values(state.policyResults);
    const currentAnswers = (state.answerLog || []).filter((entry) => entry.policyId === state.currentPolicyId);
    return {
      clearLocalData,
      hasSavedProgress: Boolean(state.startedAt),
      canGoBack: state.history.length > 0,
      answerHistory: currentAnswers,
      completedCount: results.filter((result) => result.rootAnswer !== 'skipped').length,
      answeredCount: results.length,
      nextPolicyId: nextUnansweredPolicy(model, state),
    };
  }, [clearLocalData, model, state]);

  return [state, dispatch, controls];
}
