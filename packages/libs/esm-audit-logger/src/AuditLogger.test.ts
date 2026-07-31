import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditLogger, calculateRetryDelayMs } from './AuditLogger';
import { clearKeyCache } from './crypto';
import { getEntriesForUser } from './db';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
}));

import { openmrsFetch } from '@openmrs/esm-framework';

const mockFetch = vi.mocked(openmrsFetch);

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
const SESSION = 'session-id-1';
const LOCATION = 'session-location-uuid-1';
let DB: string;

// Use a fresh DB name every test so the module-level dbCache in db.ts never
// returns a stale connection from a previously used database.
beforeEach(() => {
  DB = `test-audit-logger-${crypto.randomUUID()}`;
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  auditLogger.clearSession();
  auditLogger.destroy();
  clearKeyCache();
});

function setupSession(): void {
  auditLogger.configure({ dbName: DB });
  auditLogger.setSession(USER, SESSION, LOCATION);
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
    const [url, opts] = mockFetch.mock.calls[0] as [
      string,
      { method: string; body: Array<{ eventType: string; userUuid: string; sessionId: string; locationUuid: string }> },
    ];
    expect(url).toBe('/ws/rest/v1/sihsalus/audit');
    expect(opts.method).toBe('POST');
    const body = opts.body;
    expect(body[0]?.eventType).toBe('PATIENT_VIEW');
    expect(body[0]?.userUuid).toBe(USER);
    expect(body[0]?.sessionId).toBe(SESSION);
    expect(body[0]?.locationUuid).toBe(LOCATION);
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

  it('automatically retries a queued HTTP failure with bounded backoff', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    mockFetch.mockResolvedValueOnce(failResponse() as never).mockResolvedValue(okResponse() as never);
    setupSession();

    await auditLogger.log({ eventType: 'PATIENT_VIEW' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const flushSpy = vi.spyOn(auditLogger, 'flush');
    await vi.advanceTimersByTimeAsync(1000);
    expect(flushSpy).toHaveBeenCalledOnce();
    await flushSpy.mock.results[0]?.value;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, opts] = mockFetch.mock.calls[1] as [string, { body: Array<{ eventType: string }> }];
    expect(opts.body[0]?.eventType).toBe('PATIENT_VIEW');

    flushSpy.mockRestore();
    vi.mocked(Math.random).mockRestore();
    vi.useRealTimers();
  });

  it('never calculates a retry later than the configured one-minute ceiling', () => {
    expect(calculateRetryDelayMs(0, 1)).toBe(1200);
    expect(calculateRetryDelayMs(6, 1)).toBe(60_000);
    expect(calculateRetryDelayMs(100, 1)).toBe(60_000);
  });
});

describe('log() — offline path', () => {
  it('queues the event and flushes on demand', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();

    await auditLogger.log({ eventType: 'ENCOUNTER_VIEW' });
    expect(mockFetch).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: Array<{ eventType: string }> }];
    const body = opts.body;
    expect(body[0]?.eventType).toBe('ENCOUNTER_VIEW');
  });

  it('raises an operational event instead of silently evicting a full queue', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    auditLogger.configure({ dbName: DB, maxOfflineEntries: 1 });
    auditLogger.setSession(USER, SESSION, LOCATION);
    const overflowHandler = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.addEventListener('sihsalus:audit-queue-overflow', overflowHandler);

    await auditLogger.log({ eventType: 'FIRST' });
    await auditLogger.log({ eventType: 'SECOND' });

    expect(overflowHandler).toHaveBeenCalledOnce();
    expect((overflowHandler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      evictedEntries: 1,
      maxOfflineEntries: 1,
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('capacity exceeded'), 1);

    globalThis.removeEventListener('sihsalus:audit-queue-overflow', overflowHandler);
    errorSpy.mockRestore();
  });
});

describe('log() — guards', () => {
  it('is a no-op when session is not set', async () => {
    auditLogger.configure({ dbName: DB });
    // No setSession call.
    await auditLogger.log({ eventType: 'PATIENT_VIEW' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('queues events after the online rate limit instead of losing them', async () => {
    // Use fake timers so we control the rate-limit window precisely and avoid
    // bleed-in of event counts from other tests that run in the same second.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    mockFetch.mockResolvedValue(okResponse() as never);
    setupSession();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Send 21 events — first 20 succeed, 21st is queued instead of being lost.
    for (let i = 0; i < 21; i++) {
      await auditLogger.log({ eventType: 'PING' });
    }

    expect(mockFetch).toHaveBeenCalledTimes(20);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit'), expect.any(String));

    // A flush can recover the queued event; the production timer does this
    // automatically after the one-second rate-limit window.
    await auditLogger.flush();

    expect(mockFetch).toHaveBeenCalledTimes(21);
    const [, opts] = mockFetch.mock.calls[20] as [string, { body: Array<{ eventType: string }> }];
    expect(opts.body).toHaveLength(1);
    expect(opts.body[0]?.eventType).toBe('PING');

    const timerFlushSpy = vi.spyOn(auditLogger, 'flush').mockResolvedValue();
    await vi.advanceTimersByTimeAsync(1001);
    expect(timerFlushSpy).toHaveBeenCalledOnce();
    timerFlushSpy.mockRestore();

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
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();

    // Queue 55 events (> FLUSH_BATCH_SIZE of 50).
    for (let i = 0; i < 55; i++) {
      await auditLogger.log({ eventType: `EVT_${i}` });
    }

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
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
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    for (let i = 0; i < 3; i++) {
      await auditLogger.log({ eventType: 'EVT' });
    }

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFetch.mockResolvedValue(failResponse() as never);
    await expect(auditLogger.flush()).rejects.toThrow('Audit flush failed: 500');

    // Entries must still be in the queue; retry should send them.
    mockFetch.mockResolvedValue(okResponse() as never);
    await auditLogger.flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses one in-flight flush when several triggers fire concurrently', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    await auditLogger.log({ eventType: 'PATIENT_VIEW' });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    let resolveRequest!: (response: { ok: boolean; status: number }) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    const firstFlush = auditLogger.flush();
    const secondFlush = auditLogger.flush();

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    resolveRequest({ ok: true, status: 200 });
    await Promise.all([firstFlush, secondFlush]);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('drains an event queued during an in-flight flush before cancelling its retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    await auditLogger.log({ eventType: 'QUEUED_BEFORE_FLUSH' });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    let resolveFirstBatch!: (response: { ok: boolean; status: number }) => void;
    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstBatch = resolve;
          }) as never,
      )
      .mockResolvedValueOnce(failResponse() as never)
      .mockResolvedValue(okResponse() as never);

    const flush = auditLogger.flush();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    await auditLogger.log({ eventType: 'QUEUED_DURING_FLUSH' });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    resolveFirstBatch({ ok: true, status: 200 });
    await flush;

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const [, opts] = mockFetch.mock.calls[2] as [string, { body: Array<{ eventType: string }> }];
    expect(opts.body[0]?.eventType).toBe('QUEUED_DURING_FLUSH');

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    errorSpy.mockRestore();
    vi.mocked(Math.random).mockRestore();
    vi.useRealTimers();
  });

  it('does not start another batch after the authenticated session changes', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    for (let i = 0; i < 55; i++) {
      await auditLogger.log({ eventType: `USER_A_${i}` });
    }

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    let resolveFirstBatch!: (response: { ok: boolean; status: number }) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFirstBatch = resolve;
      }) as never,
    );

    const flush = auditLogger.flush();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    auditLogger.clearSession();
    auditLogger.setSession('user-uuid-2', 'session-id-2', 'session-location-uuid-2');
    resolveFirstBatch({ ok: true, status: 200 });
    await flush;

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('reports and purges unreadable rows without exposing their encrypted contents', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    await auditLogger.log({ eventType: 'EVENT_ENCRYPTED_WITH_OLD_KEY', patientUuid: 'patient-must-not-leak' });

    const { entries: oldEntries } = await getEntriesForUser(DB, USER);
    const unreadableId = oldEntries[0]?.id;
    expect(unreadableId).toBeTypeOf('string');

    // Simulate a lost/rotated device salt, then create an entry with the new
    // key. The old row must be surfaced and purged; the new one must still send.
    localStorage.removeItem(`sihsalus-audit-salt-v2-${USER}`);
    clearKeyCache();
    await auditLogger.log({ eventType: 'EVENT_ENCRYPTED_WITH_CURRENT_KEY' });

    const unreadableHandler = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.addEventListener('sihsalus:audit-entries-unreadable', unreadableHandler);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFetch.mockResolvedValue(okResponse() as never);

    await auditLogger.flush();

    expect(unreadableHandler).toHaveBeenCalledOnce();
    const detail = (unreadableHandler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail).toEqual({ discardedEntries: 1, entryIds: [unreadableId] });
    expect(JSON.stringify(detail)).not.toContain('patient-must-not-leak');
    expect(JSON.stringify(detail)).not.toContain(USER);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not be decrypted'),
      1,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: Array<{ eventType: string }> }];
    expect(opts.body.map((entry) => entry.eventType)).toEqual(['EVENT_ENCRYPTED_WITH_CURRENT_KEY']);

    const pending = await getEntriesForUser(DB, USER);
    expect(pending).toEqual({ entries: [], undecryptableIds: [] });

    globalThis.removeEventListener('sihsalus:audit-entries-unreadable', unreadableHandler);
    errorSpy.mockRestore();
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
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: Array<{ eventType: string }> }];
    const body = opts.body;
    expect(body[0]?.eventType).toBe('BEFORE_LOGOUT');
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
  it('flushes an existing offline queue after the session is bound', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    setupSession();
    await auditLogger.log({ eventType: 'QUEUED_BEFORE_RELOAD' });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFetch.mockResolvedValue(okResponse() as never);
    auditLogger.init();

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [, opts] = mockFetch.mock.calls[0] as [string, { body: Array<{ eventType: string }> }];
    expect(opts.body[0]?.eventType).toBe('QUEUED_BEFORE_RELOAD');
  });

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

  it('keeps the shared listener active until the last consumer releases it', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener');
    const removeSpy = vi.spyOn(globalThis, 'removeEventListener');
    setupSession();

    auditLogger.acquire();
    auditLogger.acquire();
    expect(addSpy.mock.calls.filter(([event]) => event === 'online')).toHaveLength(1);

    auditLogger.release();
    expect(removeSpy.mock.calls.filter(([event]) => event === 'online')).toHaveLength(0);

    auditLogger.release();
    expect(removeSpy.mock.calls.filter(([event]) => event === 'online')).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
