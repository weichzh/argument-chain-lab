import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  applySessionOverlay,
  argumentsById,
  claims,
  facts,
  normalizeSessionOverlay,
  policies,
} from '../data/model.js';
import {
  createInitialState,
  getConditionalFollowUps,
  migrateSavedState,
  reducer,
} from '../lib/engine.js';

const STORAGE_KEY = 'argument-chain-lab:progress:v6';
const LEGACY_STORAGE_KEYS = ['argument-chain-lab:progress:v5', 'argument-chain-lab:progress:v4'];
const DRAFT_PREFIX = 'argument-chain-lab:draft:';
const HISTORY_KEY = 'argument-chain-lab:navigation:v1';

const loadState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
      || LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    const sessionOverlay = normalizeSessionOverlay(parsed.sessionOverlay);
    const migrated = migrateSavedState({ ...parsed, sessionOverlay });
    if (!migrated) {
      applySessionOverlay(normalizeSessionOverlay());
      return createInitialState();
    }
    applySessionOverlay(migrated.sessionOverlay);
    return migrated;
  } catch {
    applySessionOverlay(normalizeSessionOverlay());
    return createInitialState();
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

const loadNavigationHistory = () => {
  try {
    const { modelVersion, storageVersion } = createInitialState();
    const parsed = JSON.parse(window.sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => (
      entry?.state?.modelVersion === modelVersion
      && entry.state.storageVersion === storageVersion
    )).slice(-40) : [];
  } catch {
    return [];
  }
};

const saveNavigationHistory = (history) => {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Navigation history is optional; persisted progress still resumes at the current question.
  }
};

export const sessionDraftKey = (scope) => `${DRAFT_PREFIX}${scope}`;

const responseCopy = {
  support: '支持',
  oppose: '反对',
  conditional: '只在某些条件下支持',
  undecided: '暂时不能判断',
  true: '接受这个假设',
  false: '不接受这个假设',
  unknown: '暂时不能判断',
  accept: '接受',
  reject: '不接受',
  uncertain: '暂时不能判断',
  apply: '换一个对象仍然适用',
  qualified_exception: '需要补充适用条件',
  unexplained_exception: '暂时说不清区别',
  retract: '撤回这条理由',
};

const describeAction = (state, action) => {
  if (action.historyLabel) return action.historyLabel;
  const policy = policies[state.policyIndex];
  if (action.type === 'SKIP_SIMPLE_POLICY') return '跳过这道题';
  if (action.type === 'SET_SIMPLE_STANCE') {
    return `你的判断：${policy?.stanceOptions?.[action.stance] || responseCopy[action.stance]}`;
  }
  if (action.type === 'ANSWER_SIMPLE_ELEMENT') {
    const element = getConditionalFollowUps(policy)[state.currentElementIndex];
    const option = element?.simpleOptions?.find((item) => item.value === action.response);
    return element ? `${element.label} ${option?.label || responseCopy[action.response] || action.response}` : null;
  }
  if (action.type === 'SELECT_ARGUMENT') return `主要原因：${argumentsById[action.argumentId]?.title || '自选理由'}`;
  if (action.type === 'ANSWER_FACT') {
    const argument = argumentsById[state.currentArgumentId];
    const fact = facts[argument?.factIds?.[state.currentFactIndex]];
    return fact ? `${fact.statement} ${responseCopy[action.response] || action.response}` : null;
  }
  if (action.type === 'ANSWER_BRIDGE') {
    const bridge = claims[argumentsById[state.currentArgumentId]?.bridgeClaimId];
    return bridge ? `${bridge.text} ${responseCopy[action.response] || action.response}` : null;
  }
  if (action.type === 'ACCEPT_CURRENT_REASON_AS_TERMINAL') return '这就是我目前最根本的理由';
  if (action.type === 'SET_DEPTH') {
    return action.decision === 'deeper' ? '继续追问为什么' : action.decision === 'uncertain' ? '暂时说不清' : null;
  }
  if (action.type === 'CONFIRM_TERMINAL') return responseCopy[action.response] || null;
  if (action.type === 'ANSWER_STRESS') return responseCopy[action.response] || null;
  if (action.type === 'SELECT_DEFEATER') return `认真考虑：${argumentsById[action.argumentId]?.title || '相反理由'}`;
  if (action.type === 'ANSWER_DEFEATER') return '记录这条相反理由带来的影响';
  if (action.type === 'RESOLVE_CONFLICT') return '修改前后不一致的回答';
  return null;
};

const navigationStartActions = new Set([
  'START_QUESTIONNAIRE',
  'REVISE_POLICY_SIMPLE',
  'NEXT_QUESTIONNAIRE',
]);

const reversibleActions = new Set([
  'MISSING_STRESS_TEST',
  'NO_ARGUMENT',
  'NO_DEFEATER_ACCEPTED',
  'RESOLVE_BREAK',
  'RESOLVE_CONFLICT',
  'SET_CUSTOM_STRESS_TEST',
]);

export function useSession() {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  const historyRef = useRef(null);
  if (historyRef.current === null) historyRef.current = loadNavigationHistory();
  const historyId = useRef(Math.max(0, ...historyRef.current.map((entry) => entry.id || 0)));
  const [historyVersion, setHistoryVersion] = useState(0);
  stateRef.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // The protocol remains usable when storage is blocked.
    }
  }, [state]);

  useEffect(() => saveNavigationHistory(historyRef.current), [historyVersion]);

  const dispatch = useCallback((action) => {
    if (action.type === 'GO_BACK') {
      const previous = historyRef.current.pop();
      if (!previous) return;
      stateRef.current = previous.state;
      applySessionOverlay(previous.state.sessionOverlay);
      rawDispatch({ type: 'RESTORE_NAVIGATION', state: previous.state });
      setHistoryVersion((value) => value + 1);
      return;
    }
    if (action.type === 'SET_SESSION_OVERLAY') {
      applySessionOverlay(action.overlay);
    }
    if (action.type === 'RESET') {
      applySessionOverlay(normalizeSessionOverlay());
      clearDrafts();
      historyRef.current = [];
      setHistoryVersion((value) => value + 1);
    }
    const current = stateRef.current;
    const openingPolicyId = action.type === 'START_QUESTIONNAIRE'
      ? action.policyId || policies.find((policy) => current.records[policy.id]?.draft)?.id
      : action.policyId;
    const resumingCurrentPolicy = action.type === 'START_QUESTIONNAIRE'
      && openingPolicyId === policies[current.policyIndex]?.id
      && Boolean(current.records[openingPolicyId]?.draft);
    if (navigationStartActions.has(action.type) && !resumingCurrentPolicy) {
      historyRef.current = [];
      setHistoryVersion((value) => value + 1);
    }
    const label = describeAction(current, action);
    const captureNavigationStart = navigationStartActions.has(action.type)
      && action.type !== 'NEXT_QUESTIONNAIRE'
      && !resumingCurrentPolicy;
    if (label || action.type.startsWith('ANSWER_') || reversibleActions.has(action.type) || captureNavigationStart) {
      historyId.current += 1;
      historyRef.current.push({
        id: historyId.current,
        label,
        policyId: policies[current.policyIndex]?.id || null,
        state: current,
      });
      if (historyRef.current.length > 80) historyRef.current.shift();
      setHistoryVersion((value) => value + 1);
    }
    const next = reducer(current, action);
    stateRef.current = next;
    rawDispatch({ type: 'RESTORE_NAVIGATION', state: next });
  }, []);

  const goBackTo = useCallback((id) => {
    const index = historyRef.current.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [target] = historyRef.current.splice(index);
    stateRef.current = target.state;
    applySessionOverlay(target.state.sessionOverlay);
    rawDispatch({ type: 'RESTORE_NAVIGATION', state: target.state });
    setHistoryVersion((value) => value + 1);
  }, []);

  const clearLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Continue with the in-memory reset.
    }
    clearDrafts();
    applySessionOverlay(normalizeSessionOverlay());
    historyRef.current = [];
    setHistoryVersion((value) => value + 1);
    rawDispatch({ type: 'RESET' });
  }, []);

  const controls = useMemo(() => ({
    clearLocalData,
    hasSavedProgress: Boolean(state.startedAt),
    canGoBack: historyRef.current.length > 0,
    answerHistory: historyRef.current
      .filter((entry) => entry.label && entry.policyId === policies[state.policyIndex]?.id)
      .map(({ id, label }) => ({ id, label })),
    goBackTo,
  }), [clearLocalData, goBackTo, historyVersion, state.policyIndex, state.startedAt]);

  return [state, dispatch, controls];
}
