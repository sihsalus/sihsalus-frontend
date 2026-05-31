import type { RequestHandler } from 'express';

export function createInMemoryRateLimit({ windowMs, max }: { windowMs: number; max: number }): RequestHandler {
  const requestsByIp = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = requestsByIp.get(key);

    if (!current || current.resetAt <= now) {
      requestsByIp.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('retry-after', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).send('Too many requests');
    }

    return next();
  };
}
