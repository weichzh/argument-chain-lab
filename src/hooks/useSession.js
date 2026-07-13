import { useEffect, useReducer } from 'react';
import { MODEL_META } from '../data/model.js';
import { createInitialState, reducer } from '../lib/engine.js';

const STORAGE_KEY = 'minimal-bridge-dialogue:v3';

const loadState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed?.modelVersion !== MODEL_META.version) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
};

export function useSession() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The assessment remains usable when storage is blocked.
    }
  }, [state]);

  return [state, dispatch];
}
