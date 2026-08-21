import { describe, expect, it } from 'vitest';
import { formatHttpFailure, summarizePendingSyncItems } from './evidence-sanitization';

describe('offline laptop evidence sanitization', () => {
  it('does not include a backend response body in an HTTP failure summary', () => {
    expect(formatHttpFailure('Could not verify the synthetic patient', 500)).toBe(
      'Could not verify the synthetic patient (500)',
    );
  });

  it('does not expose stored synchronization error details', () => {
    const sensitiveError = {
      message: 'GET /patient/private-uuid?name=Sensitive failed',
      stack: 'internal-host.example.test',
    };
    const summary = summarizePendingSyncItems([{ lastError: sensitiveError, type: 'visit' }]);

    expect(summary).toEqual([{ hasStoredError: true, type: 'visit' }]);
    expect(JSON.stringify(summary)).not.toMatch(/private-uuid|Sensitive|internal-host/);
  });
});
