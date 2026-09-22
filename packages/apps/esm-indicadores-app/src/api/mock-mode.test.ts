import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetMockModeStoreForTests,
  activateMockMode,
  getMockModeState,
  reportBackendUnavailable,
  resetMockMode,
  settleBackendOperation,
  startBackendOperation,
} from './mock-mode';

describe('mock-mode store — batch verdict', () => {
  beforeEach(() => {
    __resetMockModeStoreForTests();
  });

  it('stays healthy when the only in-flight operation succeeds', () => {
    startBackendOperation();
    settleBackendOperation(true);

    const s = getMockModeState();
    expect(s.isMockMode).toBe(false);
    expect(s.isBackendAvailable).toBe(true);
  });

  it('settles to unavailable when an in-flight operation fails (demo disabled)', () => {
    startBackendOperation();
    settleBackendOperation(false, 'Network Error', false);

    const s = getMockModeState();
    expect(s.isMockMode).toBe(false);
    expect(s.isBackendAvailable).toBe(false);
    expect(s.errorMessage).toBe('Network Error');
  });

  it('settles to mock mode when an in-flight operation fails with demo enabled', () => {
    startBackendOperation();
    settleBackendOperation(false, 'Network Error', true);

    const s = getMockModeState();
    expect(s.isMockMode).toBe(true);
    expect(s.isBackendAvailable).toBe(false);
    expect(s.errorMessage).toBe('Network Error');
  });

  it('does not settle while operations are still in flight', () => {
    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(true);

    const mid = getMockModeState();
    expect(mid.isBackendAvailable).toBe(true);

    settleBackendOperation(false, 'upstream 500', false);

    const after = getMockModeState();
    expect(after.isBackendAvailable).toBe(false);
    expect(after.isMockMode).toBe(false);
    expect(after.errorMessage).toBe('upstream 500');
  });

  it('prevents the read-success-resolves-last race (A success while B fails does NOT reset the store)', () => {
    // Two concurrent reads. B fails first (unavailable), A succeeds later.
    // Without the batch verdict the late A success would flip the banner back
    // to "all good" — lying to the user about the failed read.
    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(false, 'Network Error', false);
    settleBackendOperation(true);

    const after = getMockModeState();
    expect(after.isBackendAvailable).toBe(false);
    expect(after.errorMessage).toBe('Network Error');
  });

  it('prevents the read-failure-resolves-last race (B fails after A succeeded keeps the batch verdict)', () => {
    // Mirror case: A resolves first (would have reset the store), B fails
    // afterwards. Either order yields the same verdict — that is the point.
    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(true);
    settleBackendOperation(false, 'Network Error', false);

    const after = getMockModeState();
    expect(after.isBackendAvailable).toBe(false);
    expect(after.errorMessage).toBe('Network Error');
  });

  it('any-failure in the batch promotes to demo mode when at least one settle used demo', () => {
    startBackendOperation();
    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(true);
    settleBackendOperation(false, 'Network Error', true);
    settleBackendOperation(true);

    const after = getMockModeState();
    expect(after.isMockMode).toBe(true);
    expect(after.isBackendAvailable).toBe(false);
    expect(after.errorMessage).toBe('Network Error');
  });

  it('a later demo failure overrides an earlier non-demo failure (demo wins)', () => {
    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(false, 'upstream 500', false);
    settleBackendOperation(false, 'fetch failed', true);

    const after = getMockModeState();
    expect(after.isMockMode).toBe(true);
    expect(after.errorMessage).toBe('fetch failed');
  });

  it('clears the batch verdict after settling; the next batch starts fresh', () => {
    startBackendOperation();
    settleBackendOperation(false, 'Network Error', false);
    expect(getMockModeState().isBackendAvailable).toBe(false);

    startBackendOperation();
    startBackendOperation();
    settleBackendOperation(true);
    settleBackendOperation(true);

    const after = getMockModeState();
    expect(after.isBackendAvailable).toBe(true);
    expect(after.isMockMode).toBe(false);
    expect(after.errorMessage).toBeUndefined();
  });

  it('extra settles do not underflow the counter and accidentally settle a future batch', () => {
    startBackendOperation();
    settleBackendOperation(true);
    // Defensive: a stray late settle with no matching start should NOT drive
    // the counter negative.
    settleBackendOperation(true);

    // A real new batch must still settle correctly.
    startBackendOperation();
    settleBackendOperation(false, 'fetch failed', false);

    expect(getMockModeState().isBackendAvailable).toBe(false);
    expect(getMockModeState().errorMessage).toBe('fetch failed');
  });
});

describe('mock-mode store — direct mutators (kept for completeness)', () => {
  beforeEach(() => {
    __resetMockModeStoreForTests();
  });

  it('activateMockMode sets demo+unavailable with error message', () => {
    activateMockMode('boom');
    const s = getMockModeState();
    expect(s.isMockMode).toBe(true);
    expect(s.isBackendAvailable).toBe(false);
    expect(s.errorMessage).toBe('boom');
  });

  it('reportBackendUnavailable sets unavailable without demo', () => {
    reportBackendUnavailable('boom');
    const s = getMockModeState();
    expect(s.isMockMode).toBe(false);
    expect(s.isBackendAvailable).toBe(false);
    expect(s.errorMessage).toBe('boom');
  });

  it('resetMockMode returns to the healthy state', () => {
    activateMockMode('boom');
    resetMockMode();
    const s = getMockModeState();
    expect(s.isMockMode).toBe(false);
    expect(s.isBackendAvailable).toBe(true);
    expect(s.errorMessage).toBeUndefined();
  });
});
