import { describe, expect, it, vi } from 'vitest';

import { createInMemoryRateLimit } from './develop-rate-limit';

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
});
