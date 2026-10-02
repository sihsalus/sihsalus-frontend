import { useSyncExternalStore } from 'react';

interface MockModeState {
  isMockMode: boolean;
  isBackendAvailable: boolean;
  errorMessage?: string;
}

const STATE_HEALTHY: MockModeState = {
  isMockMode: false,
  isBackendAvailable: true,
};

let state: MockModeState = STATE_HEALTHY;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

// Batched-verdict bookkeeping. Multiple concurrent reads (SWR fans out one
// request per hook; the health check adds another) all funnel through the
// same queue. The store is only settled once the LAST in-flight operation
// settles, so the user-facing banner reflects the verdict of the whole
// batch instead of whichever request happened to resolve last.
let inFlightCount = 0;
let batchHadFailure = false;
let batchFailureMessage: string | undefined;
let batchFailureUsesDemo = false;

function flushIfEmpty() {
  if (inFlightCount === 0) {
    if (batchHadFailure) {
      state = batchFailureUsesDemo
        ? {
            isMockMode: true,
            isBackendAvailable: false,
            errorMessage: batchFailureMessage,
          }
        : {
            isMockMode: false,
            isBackendAvailable: false,
            errorMessage: batchFailureMessage,
          };
    } else {
      // Every operation in the batch succeeded → the backend is healthy.
      // Resetting here (rather than only on the first success) is what makes
      // the store reflect recovery after a previous unavailable batch.
      state = STATE_HEALTHY;
    }
    batchHadFailure = false;
    batchFailureMessage = undefined;
    batchFailureUsesDemo = false;
    emit();
  }
}

/**
 * Mark the start of a backend operation. Must be balanced by exactly one
 * `settleBackendOperation` call with the outcome. Re entrant safe via a
 * plain counter; the count goes to zero only when every in-flight operation
 * has reported back.
 */
export function startBackendOperation() {
  inFlightCount += 1;
}

/**
 * Report the outcome of a backend operation and settle the mock-mode store
 * once the whole batch has drained.
 *
 * @param ok         true when the operation succeeded
 * @param message    error message when `ok === false`
 * @param usesDemo   true when the failure should drive demo/mock mode (i.e.
 *                   `enableDemoData` is on and the failure qualifies). When
 *                   false a failure marks the backend unavailable but does
 *                   not flip on demo data.
 */
export function settleBackendOperation(ok: boolean, message?: string, usesDemo = false) {
  inFlightCount = Math.max(0, inFlightCount - 1);

  if (!ok) {
    batchHadFailure = true;
    if (message) {
      batchFailureMessage = message;
    }
    if (usesDemo) {
      batchFailureUsesDemo = true;
    }
  }

  flushIfEmpty();
}

// Direct state mutators kept for tests and for non-batched call sites
// (none in app code today, but available so a deliberate outside reset
// is still expressible).
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
  state = STATE_HEALTHY;
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

// Test helpers: reset the singleton between tests without exposing the
// internal counter to production code.
export function __resetMockModeStoreForTests() {
  state = STATE_HEALTHY;
  inFlightCount = 0;
  batchHadFailure = false;
  batchFailureMessage = undefined;
  batchFailureUsesDemo = false;
  listeners.clear();
}
