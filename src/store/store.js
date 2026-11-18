import { useSyncExternalStore } from 'react';
import { createSeed, STATE_VERSION } from '../data/seed';

const STORAGE_KEY = 'otlobauc.demo-state';
const listeners = new Set();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === STATE_VERSION) return { ...saved, now: Date.now() };
  } catch {
    // Storage can be blocked or corrupted. The demo then starts from fresh data.
  }
  return createSeed(Date.now());
}

let state = loadState();

export const getState = () => state;

export function setState(next) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The demo keeps working in memory when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Restores the original demo data and signs everyone out. */
export const resetDemoState = () => setState(createSeed(Date.now()));

export const useAppState = () => useSyncExternalStore(subscribe, getState);

export function useCurrentUser() {
  const { users, session } = useAppState();
  return users.find((u) => u.id === session.userId) ?? null;
}

setInterval(() => {
  state = { ...state, now: Date.now() };
  listeners.forEach((listener) => listener());
}, 10_000);
