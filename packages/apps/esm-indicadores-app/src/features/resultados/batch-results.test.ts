import { describe, expect, it } from 'vitest';

import { isBatchTotalFailure } from './batch-results';

describe('isBatchTotalFailure', () => {
  it('is a total failure when 0 successes, at least one error, and a non-empty batch', () => {
    expect(isBatchTotalFailure({ successes: 0, errorCount: 3, total: 10 })).toBe(true);
  });

  it('is NOT a total failure when some items succeeded (partial success)', () => {
    expect(isBatchTotalFailure({ successes: 5, errorCount: 5, total: 10 })).toBe(false);
  });

  it('is NOT a total failure when there are no errors (full success)', () => {
    expect(isBatchTotalFailure({ successes: 10, errorCount: 0, total: 10 })).toBe(false);
  });

  it('is NOT a total failure when the batch was empty (backend attempted nothing)', () => {
    expect(isBatchTotalFailure({ successes: 0, errorCount: 0, total: 0 })).toBe(false);
  });

  it('is NOT a total failure when there are errors but successes is zero AND total is zero (nothing attempted)', () => {
    expect(isBatchTotalFailure({ successes: 0, errorCount: 4, total: 0 })).toBe(false);
  });

  it('is a total failure even when errorCount is less than total (the backend reports fewer errors than attempted items)', () => {
    // The whole point of `errorCount >= total` being unsafe: total = 10
    // attempted, only 3 reported errors, but 0 succeeded.
    expect(isBatchTotalFailure({ successes: 0, errorCount: 3, total: 10 })).toBe(true);
  });

  it('is a total failure with a single error on a single-item batch', () => {
    expect(isBatchTotalFailure({ successes: 0, errorCount: 1, total: 1 })).toBe(true);
  });

  it('treats negative inputs conservatively (not a total failure)', () => {
    // Defensive: malformed/unknown payloads should not be flagged as total failures.
    expect(isBatchTotalFailure({ successes: -1, errorCount: 3, total: 10 })).toBe(false);
    expect(isBatchTotalFailure({ successes: 0, errorCount: 0, total: -5 })).toBe(false);
  });
});
