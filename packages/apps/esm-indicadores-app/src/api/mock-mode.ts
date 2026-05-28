import { useSyncExternalStore } from 'react';

export interface MockModeState {
  isMockMode: boolean;
  errorMessage?: string;
}

let state: MockModeState = {
  isMockMode: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function activateMockMode(errorMessage: string) {
  state = {
    isMockMode: true,
    errorMessage,
  };
  emit();
}

export function resetMockMode() {
  state = {
    isMockMode: false,
  };
  emit();
}

export function getMockModeState() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMockMode() {
  return useSyncExternalStore(subscribe, getMockModeState);
}
