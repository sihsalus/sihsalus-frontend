import { useSyncExternalStore } from 'react';

export interface MockModeState {
  isMockMode: boolean;
  isBackendAvailable: boolean;
  errorMessage?: string;
}

let state: MockModeState = {
  isMockMode: false,
  isBackendAvailable: true,
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
    isBackendAvailable: false,
    errorMessage,
  };
  emit();
}

export function reportBackendUnavailable(errorMessage: string) {
  state = {
    isMockMode: false,
    isBackendAvailable: false,
    errorMessage,
  };
  emit();
}

export function resetMockMode() {
  state = {
    isMockMode: false,
    isBackendAvailable: true,
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
