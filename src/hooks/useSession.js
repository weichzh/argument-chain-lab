import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { applySessionOverlay, MODEL_META, normalizeSessionOverlay } from '../data/model.js';
import { createInitialState, reducer } from '../lib/engine.js';

const STORAGE_KEY = 'argument-chain-lab:progress:v4';
const DRAFT_PREFIX = 'argument-chain-lab:draft:';

const loadState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed?.storageVersion !== 4 || parsed?.modelVersion !== MODEL_META.version) {
      return createInitialState();
    }
    const sessionOverlay = normalizeSessionOverlay(parsed.sessionOverlay);
    applySessionOverlay(sessionOverlay);
    return { ...parsed, sessionOverlay };
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

export const sessionDraftKey = (scope) => `${DRAFT_PREFIX}${scope}`;

export function useSession() {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The protocol remains usable when storage is blocked.
    }
  }, [state]);

  const dispatch = useCallback((action) => {
    if (action.type === 'SET_SESSION_OVERLAY') {
      applySessionOverlay(action.overlay);
    }
    if (action.type === 'RESET') {
      applySessionOverlay(normalizeSessionOverlay());
      clearDrafts();
    }
    rawDispatch(action);
  }, []);

  const clearLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Continue with the in-memory reset.
    }
    clearDrafts();
    applySessionOverlay(normalizeSessionOverlay());
    rawDispatch({ type: 'RESET' });
  }, []);

  const controls = useMemo(() => ({
    clearLocalData,
    hasSavedProgress: Boolean(state.startedAt),
  }), [clearLocalData, state.startedAt]);

  return [state, dispatch, controls];
}
