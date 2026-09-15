import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditLogger } from './AuditLogger';
import { clearKeyCache } from './crypto';
import * as auditDb from './db';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
}));

import { openmrsFetch } from '@openmrs/esm-framework';

const mockFetch = vi.mocked(openmrsFetch);

function sentBody(): string {
  const body = mockFetch.mock.calls[0]?.[1]?.body;
  expect(body).toBeTypeOf('string');
  if (typeof body !== 'string') throw new Error('Expected a serialized audit batch');
  return body;
}

function okResponse(): Promise<{ ok: boolean; status: number }> {
  return Promise.resolve({ ok: true, status: 200 });
}

function failResponse(status = 500): Promise<{ ok: boolean; status: number }> {
  return Promise.resolve({ ok: false, status });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const USER = 'user-uuid-1';
let DB: string;

// Use a fresh DB name every test so the module-level dbCache in db.ts never
// returns a stale connection from a previously used database.
beforeEach(() => {
  DB = `test-audit-logger-${crypto.randomUUID()}`;
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
  });
});

afterEach(() => {
  auditLogger.clearSession();
  auditLogger.destroy();
  clearKeyCache();
  vi.restoreAllMocks();
});

function setupSession(): void {
  auditLogger.configure({ dbName: DB });
  auditLogger.setSession(USER);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('log() — online path', () => {
  it('sends the event directly when online', async () => {
    mockFetch.mockResolvedValue(okResponse() as never);
    setupSession();

    await auditLogger.log({ eventType: 'PATIENT_VIEW' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('/ws/rest/v1/sihsalus/audit');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeTypeOf('string');
    const body = JSON.parse(opts.body);
    expect(body[0].eventType).toBe('PATIENT_VIEW');
    expect(body[0].userUuid).toBe(USER);
    expect(body[0]).not.toHaveProperty('sessionId');
  });

  it('queues offline when the HTTP call fails', async () => {
    mockFetch.mockResolvedValue(failResponse() as never);
    setupSession();

    await auditLogger.log({ eventType: 'PATIENT_VIEW' });

    // Flush should pick up the queued entry.
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('log() — offline path', () => {
  it('queues the event and flushes on demand', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();

    await auditLogger.log({ eventType: 'ENCOUNTER_VIEW' });
    expect(mockFetch).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(opts.body).toBeTypeOf('string');
    const body = JSON.parse(opts.body);
    expect(body[0].eventType).toBe('ENCOUNTER_VIEW');
  });
});

describe('log() — guards', () => {
  it('is a no-op when session is not set', async () => {
    auditLogger.configure({ dbName: DB });
    // No setSession call.
    await auditLogger.log({ eventType: 'PATIENT_VIEW' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('drops events after rate limit is exceeded', async () => {
    // Use fake timers so we control the rate-limit window precisely and avoid
    // bleed-in of event counts from other tests that run in the same second.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    mockFetch.mockResolvedValue(okResponse() as never);
    setupSession();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Send 21 events — first 20 succeed, 21st is rate-limited.
    for (let i = 0; i < 21; i++) {
      await auditLogger.log({ eventType: 'PING' });
    }

    expect(mockFetch).toHaveBeenCalledTimes(20);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit'), expect.any(String));

    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('flush()', () => {
  it('is a no-op when session is not set', async () => {
    auditLogger.configure({ dbName: DB });
    await auditLogger.flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends entries in batches and clears them on success', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();

    // Queue 55 events (> FLUSH_BATCH_SIZE of 50).
    for (let i = 0; i < 55; i++) {
      await auditLogger.log({ eventType: `EVT_${i}` });
    }

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();

    // Expect 2 POST calls (batch of 50 + batch of 5).
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After a successful flush the queue should be empty.
    mockFetch.mockClear();
    await auditLogger.flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stops flushing on first batch failure and keeps remaining entries', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();
    for (let i = 0; i < 3; i++) {
      await auditLogger.log({ eventType: 'EVT' });
    }

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockResolvedValue(failResponse() as never);
    await auditLogger.flush();

    // Entries must still be in the queue; retry should send them.
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('clearSession()', () => {
  it('prevents subsequent log() calls from sending events', async () => {
    mockFetch.mockResolvedValue(okResponse() as never);
    setupSession();

    await auditLogger.log({ eventType: 'BEFORE_LOGOUT' });
    auditLogger.clearSession();
    await auditLogger.log({ eventType: 'AFTER_LOGOUT' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(opts.body).toBeTypeOf('string');
    const body = JSON.parse(opts.body);
    expect(body[0].eventType).toBe('BEFORE_LOGOUT');
  });
});

describe('configure() — endpoint validation', () => {
  it('accepts a relative path', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    auditLogger.configure({ endpoint: '/ws/rest/v1/custom/audit' });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects an external URL and keeps the previous endpoint', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    auditLogger.configure({ endpoint: '/ws/rest/v1/sihsalus/audit' });
    auditLogger.configure({ endpoint: 'https://evil.example.com/exfil' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Rejected unsafe endpoint'), expect.any(String));
    errorSpy.mockRestore();
  });
});

describe('init() / destroy()', () => {
  it('init() is idempotent — registers only one online listener', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener');
    setupSession();
    auditLogger.init();
    auditLogger.init();
    auditLogger.init();
    const onlineListeners = addSpy.mock.calls.filter(([event]) => event === 'online');
    expect(onlineListeners).toHaveLength(1);
    addSpy.mockRestore();
    auditLogger.destroy();
  });
});

describe('authenticated actor isolation', () => {
  it('replays the user’s pending entries when authentication arrives after initialization', async () => {
    auditLogger.configure({ dbName: DB });
    await auditDb.queueEntry(
      DB,
      {
        id: 'pending-before-login',
        eventType: 'PATIENT_SEARCH',
        userUuid: USER,
        timestamp: '2026-01-02T03:04:05.000Z',
      },
      10,
    );
    mockFetch.mockResolvedValue(okResponse() as never);
    auditLogger.init();

    auditLogger.setSession(USER);

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(JSON.parse(sentBody())).toEqual([expect.objectContaining({ id: 'pending-before-login', userUuid: USER })]);
    await vi.waitFor(async () => expect((await auditDb.getEntriesForUser(DB, USER)).entries).toHaveLength(0));
  });

  it('stops before the next batch when the authenticated actor changes', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();
    for (let i = 0; i < 55; i++) await auditLogger.log({ eventType: 'PATIENT_SEARCH' });
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockImplementationOnce(() => {
      auditLogger.setSession('user-uuid-2');
      return okResponse() as never;
    });

    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    expect((await auditDb.getEntriesForUser(DB, USER)).entries).toHaveLength(5);
  });

  it('does not replay another user’s encrypted queue after an account switch', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();
    await auditLogger.log({ eventType: 'FIRST_USER' });
    auditLogger.setSession('user-uuid-2');
    await auditLogger.log({ eventType: 'SECOND_USER' });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(sentBody());
    expect(body).toEqual([
      expect.objectContaining({
        eventType: 'SECOND_USER',
        userUuid: 'user-uuid-2',
      }),
    ]);
    expect((await auditDb.getEntriesForUser(DB, USER)).entries).toHaveLength(1);
  });

  it.each(['logout', 'switch'])('stops a pending replay if the actor changes during decryption: %s', async (change) => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    setupSession();
    await auditLogger.log({ eventType: 'FIRST_USER' });
    const getEntries = auditDb.getEntriesForUser;
    vi.spyOn(auditDb, 'getEntriesForUser').mockImplementationOnce(async (...args) => {
      const entries = await getEntries(...args);
      if (change === 'logout') auditLogger.clearSession();
      else auditLogger.setSession('user-uuid-2');
      return entries;
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();

    expect(mockFetch).not.toHaveBeenCalled();
    expect((await getEntries(DB, USER)).entries).toHaveLength(1);
  });

  it('omits legacy authentication identifiers when replaying stored entries', async () => {
    setupSession();
    const legacy = {
      id: 'legacy-event',
      eventType: 'PATIENT_SEARCH',
      userUuid: USER,
      timestamp: '2026-01-02T03:04:05.000Z',
      sessionId: 'legacy-authentication-identifier',
    };
    await auditDb.queueEntry(DB, legacy, 10);
    mockFetch.mockResolvedValue(okResponse() as never);

    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    const wireBody = sentBody();
    expect(wireBody).toBeTypeOf('string');
    const body = JSON.parse(wireBody as string);
    expect(body[0]).toMatchObject({
      id: legacy.id,
      eventType: legacy.eventType,
    });
    expect(body[0]).not.toHaveProperty('sessionId');
    expect(wireBody).not.toContain('legacy-authentication-identifier');
  });
});
