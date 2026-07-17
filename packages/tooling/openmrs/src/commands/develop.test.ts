import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { shouldProxyApiRequest } from './develop-path-filter';
import { createInMemoryRateLimit, readRateLimitEnv } from './develop-rate-limit';

function createResponse() {
  return {
    setHeader: vi.fn(),
    status: vi.fn(function (this: unknown) {
      return this;
    }),
    send: vi.fn(function (this: unknown) {
      return this;
    }),
  };
}

describe('createInMemoryRateLimit', () => {
  it('rejects requests beyond the configured per-client limit', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-31T00:00:00Z'));

      const limiter = createInMemoryRateLimit({ windowMs: 60_000, max: 2 });
      const req = { ip: '127.0.0.1', socket: {} };
      const res = createResponse();
      const next = vi.fn();

      limiter(req as never, res as never, next);
      limiter(req as never, res as never, next);
      limiter(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.setHeader).toHaveBeenCalledWith('retry-after', 60);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith('Too many requests');
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be disabled for local development troubleshooting', () => {
    const limiter = createInMemoryRateLimit({ windowMs: 60_000, max: 0 });
    const req = { ip: '::1', socket: { remoteAddress: '::1' } };
    const res = createResponse();
    const next = vi.fn();

    for (let i = 0; i < 100; i++) {
      limiter(req as never, res as never, next);
    }

    expect(next).toHaveBeenCalledTimes(100);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('readRateLimitEnv', () => {
  it('can default to disabled when no environment value is configured', () => {
    const previousValue = process.env.SIHSALUS_TEST_RATE_LIMIT_MAX;

    try {
      delete process.env.SIHSALUS_TEST_RATE_LIMIT_MAX;

      expect(readRateLimitEnv('SIHSALUS_TEST_RATE_LIMIT_MAX', 0)).toBe(0);
    } finally {
      if (previousValue !== undefined) {
        process.env.SIHSALUS_TEST_RATE_LIMIT_MAX = previousValue;
      }
    }
  });

  it('honors zero so developers can disable a local limiter explicitly', () => {
    const previousValue = process.env.SIHSALUS_TEST_RATE_LIMIT_MAX;

    try {
      process.env.SIHSALUS_TEST_RATE_LIMIT_MAX = '0';

      expect(readRateLimitEnv('SIHSALUS_TEST_RATE_LIMIT_MAX', 12_000)).toBe(0);
    } finally {
      if (previousValue === undefined) {
        delete process.env.SIHSALUS_TEST_RATE_LIMIT_MAX;
      } else {
        process.env.SIHSALUS_TEST_RATE_LIMIT_MAX = previousValue;
      }
    }
  });
});

describe('shouldProxyApiRequest', () => {
  it('proxies OpenMRS REST and FHIR resources needed during login', () => {
    expect(shouldProxyApiRequest('/openmrs/ws/rest/v1/module', '/openmrs', '/openmrs/spa')).toBe(true);
    expect(shouldProxyApiRequest('/openmrs/ws/fhir2/R4/Location', '/openmrs', '/openmrs/spa')).toBe(true);
  });

  it('does not proxy SPA routes or unrelated paths', () => {
    expect(shouldProxyApiRequest('/openmrs/spa/login/location', '/openmrs', '/openmrs/spa')).toBe(false);
    expect(shouldProxyApiRequest('/health', '/openmrs', '/openmrs/spa')).toBe(false);
  });
});

describe('start-dev rate limit defaults', () => {
  it('keeps the local SPA proxy rate limiter disabled by default', () => {
    const startDevScript = readFileSync(new URL('../../../scripts/start-dev.js', import.meta.url), 'utf8');

    expect(startDevScript).toContain("max: readRateLimitEnv('SIHSALUS_SPA_RATE_LIMIT_MAX', 0)");
    expect(startDevScript).toContain('if (windowMs <= 0 || max <= 0)');
  });
});
