import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { appReducer, createInitialState, restorePersistentState, serializePersistentState, serializeSessionState } from './appStore.js';

const AppContext = createContext(null);
const STORAGE_KEY = 'local-way-consumer-state';
const SESSION_STORAGE_KEY = 'local-way-consumer-session';

function loadInitialState() {
  const fallback = createInitialState();
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const session = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return restorePersistentState({}, fallback, session);
    return restorePersistentState(saved, fallback, session);
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePersistentState(state)));
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializeSessionState(state)));
    } catch {
      // Storage can be unavailable in private browsing or restricted file contexts.
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppState must be used inside AppProvider');
  return context;
}
