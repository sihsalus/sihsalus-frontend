import { openmrsFetch } from '@openmrs/esm-framework';

import { clearKeyCache } from './crypto';
import { clearEntries, getEntriesForUser, queueEntry } from './db';
import type { AuditEvent, AuditLoggerConfig, StoredAuditEntry } from './types';

const DEFAULTS: Required<AuditLoggerConfig> = {
  endpoint: '/ws/rest/v1/sihsalus/audit',
  dbName: 'sihsalus-audit-log',
  maxOfflineEntries: 500,
};

const FLUSH_BATCH_SIZE = 50;
const RATE_LIMIT_PER_SECOND = 20;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 60_000;

class AuditLogger {
  private config: Required<AuditLoggerConfig> = { ...DEFAULTS };
  private sessionRef: { userUuid: string; sessionId: string; locationUuid?: string } | null = null;
  private onlineHandler: (() => void) | null = null;
  private rateLimitFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;
  private retryAttempt = 0;
  private activeConsumers = 0;
  private queueRevision = 0;
  private sessionGeneration = 0;
  private initialized = false;

  private rateLimitCount = 0;
  private rateLimitResetAt = 0;

  configure(config: Partial<AuditLoggerConfig>): void {
    if (config.endpoint !== undefined && !AuditLogger.isSafeEndpoint(config.endpoint)) {
      console.error('[AuditLogger] Rejected unsafe endpoint:', config.endpoint);
      const { endpoint, ...rest } = config;
      void endpoint;
      this.config = { ...this.config, ...rest };
      return;
    }
    this.config = { ...DEFAULTS, ...config };
    // Reset rate-limit window on every reconfigure so that a fresh test setup
    // or app re-initialisation starts with a clean slate.
    this.rateLimitCount = 0;
    this.rateLimitResetAt = 0;
    this.clearRateLimitFlushTimer();
    this.resetRetry();
  }

  setSession(userUuid: string, sessionId: string, locationUuid?: string): void {
    const sessionChanged = this.sessionRef?.userUuid !== userUuid || this.sessionRef?.sessionId !== sessionId;
    if (sessionChanged) {
      this.sessionGeneration++;
      this.resetRetry();
    }
    this.sessionRef = { userUuid, sessionId, locationUuid };

    if (this.initialized && navigator.onLine) {
      this.flush().catch((err) => console.error('[AuditLogger] Session flush failed:', err));
    }
  }

  clearSession(): void {
    if (this.sessionRef) {
      this.sessionGeneration++;
    }
    this.sessionRef = null;
    this.resetRetry();
    // Release the derived key from memory so it cannot be read after logout.
    clearKeyCache();
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.onlineHandler = () => {
      this.flush().catch((err) => console.error('[AuditLogger] Online flush failed:', err));
    };
    globalThis.addEventListener('online', this.onlineHandler);
    if (navigator.onLine) {
      this.flush().catch((err) => console.error('[AuditLogger] Initial flush failed:', err));
    }
  }

  acquire(): void {
    this.activeConsumers++;
    this.init();
  }

  release(): void {
    if (this.activeConsumers === 0) return;
    this.activeConsumers--;
    if (this.activeConsumers === 0) {
      this.clearSession();
      this.destroy();
    }
  }

  destroy(): void {
    if (this.onlineHandler) {
      globalThis.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    this.initialized = false;
    this.activeConsumers = 0;
    // Reset rate-limit state so tests using fake clocks don't bleed into each other.
    this.rateLimitCount = 0;
    this.rateLimitResetAt = 0;
    this.clearRateLimitFlushTimer();
    this.resetRetry();
  }

  async log(event: Omit<AuditEvent, 'timestamp' | 'userUuid' | 'sessionId'>): Promise<void> {
    if (!this.sessionRef) return;

    const entry: StoredAuditEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      userUuid: this.sessionRef.userUuid,
      // sessionId is intentionally embedded in the entry so the server can
      // correlate the action with the exact session — but it travels only in
      // the encrypted offline payload or over TLS; it is never stored in plaintext.
      sessionId: this.sessionRef.sessionId,
      locationUuid: event.locationUuid ?? this.sessionRef.locationUuid,
      id: crypto.randomUUID(),
    };

    if (navigator.onLine) {
      // Rate limiting only applies to the online path — its purpose is preventing
      // server flood attacks. The offline queue is bounded by maxOfflineEntries.
      if (this.isRateLimited()) {
        console.warn('[AuditLogger] Rate limit exceeded, event queued for retry:', event.eventType);
        try {
          await this.storeOffline(entry);
          this.scheduleRateLimitFlush();
        } catch (err) {
          console.error('[AuditLogger] Queue failed, event lost:', err);
        }
        return;
      }
      try {
        await this.sendEntries([entry]);
      } catch (err) {
        console.error('[AuditLogger] Send failed, queuing offline:', err);
        try {
          await this.storeOffline(entry);
          this.scheduleRetry();
        } catch (qErr) {
          console.error('[AuditLogger] Queue failed, event lost:', qErr);
        }
      }
      return;
    }

    try {
      await this.storeOffline(entry);
    } catch (err) {
      console.error('[AuditLogger] Queue failed, event lost:', err);
    }
  }

  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;

    const task = this.runFlushLoop();
    this.flushPromise = task;

    task.then(
      () => {
        if (this.flushPromise === task) this.flushPromise = null;
      },
      () => {
        if (this.flushPromise === task) this.flushPromise = null;
      },
    );
    return task;
  }

  private async runFlushLoop(): Promise<void> {
    while (this.sessionRef) {
      // Capture attribution and storage before asynchronous work. If the user
      // changes, stop the old user's next batch and continue with the new one.
      const session = this.sessionRef;
      const generation = this.sessionGeneration;
      const queueRevision = this.queueRevision;
      const { dbName } = this.config;

      try {
        await this.flushSession(dbName, session, generation);
      } catch (err) {
        if (this.sessionRef && this.sessionGeneration !== generation) {
          continue;
        }
        this.scheduleRetry();
        throw err;
      }

      if (!this.sessionRef) {
        this.resetRetry();
        return;
      }

      if (this.sessionGeneration !== generation) {
        continue;
      }

      // A direct send may fail and enqueue a new event while this flush is
      // sending an earlier snapshot. Read the queue again before cancelling
      // the retry scheduled by that newer write.
      if (this.queueRevision !== queueRevision) {
        continue;
      }

      this.resetRetry();
      return;
    }
  }

  private async flushSession(
    dbName: string,
    session: { userUuid: string; sessionId: string },
    generation: number,
  ): Promise<void> {
    const { userUuid } = session;
    const { entries, undecryptableIds } = await getEntriesForUser(dbName, userUuid);

    if (undecryptableIds.length > 0) {
      // These can never be sent, so leaving them would hold slots in the
      // bounded queue until they evicted readable events. Surfaced the same way
      // as eviction: a silently shrinking audit trail is not auditable.
      console.error('[AuditLogger] Pending events could not be decrypted and were discarded:', undecryptableIds.length);
      globalThis.dispatchEvent(
        new CustomEvent('sihsalus:audit-entries-unreadable', {
          // Audit entry ids are random technical identifiers, not clinical
          // data. Include them so operations can correlate the loss without
          // exposing the encrypted payload, user, patient, or session.
          detail: {
            discardedEntries: undecryptableIds.length,
            entryIds: [...undecryptableIds],
          },
        }),
      );
      await clearEntries(dbName, undecryptableIds);
    }

    if (!entries.length) return;

    for (let i = 0; i < entries.length; i += FLUSH_BATCH_SIZE) {
      if (!this.isCurrentSession(session, generation)) return;

      const batch = entries.slice(i, i + FLUSH_BATCH_SIZE);
      try {
        await this.sendEntries(batch);
        await clearEntries(
          dbName,
          batch.map((e) => e.id),
        );
      } catch (err) {
        console.error('[AuditLogger] Flush batch failed, stopping:', err);
        throw err;
      }
    }
  }

  private isCurrentSession(session: { userUuid: string; sessionId: string }, generation: number): boolean {
    return (
      this.sessionGeneration === generation &&
      this.sessionRef?.userUuid === session.userUuid &&
      this.sessionRef?.sessionId === session.sessionId
    );
  }

  private async storeOffline(entry: StoredAuditEntry): Promise<void> {
    const evictedEntries = await queueEntry(this.config.dbName, entry, this.config.maxOfflineEntries);
    this.queueRevision++;
    if (evictedEntries > 0) {
      console.error('[AuditLogger] Offline queue capacity exceeded; oldest pending events evicted:', evictedEntries);
      globalThis.dispatchEvent(
        new CustomEvent('sihsalus:audit-queue-overflow', {
          detail: { evictedEntries, maxOfflineEntries: this.config.maxOfflineEntries },
        }),
      );
    }
  }

  private async sendEntries(entries: StoredAuditEntry[]): Promise<void> {
    const response = await openmrsFetch(this.config.endpoint, {
      method: 'POST',
      body: entries,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Audit flush failed: ${response.status}`);
    }
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    if (now >= this.rateLimitResetAt) {
      this.rateLimitCount = 0;
      this.rateLimitResetAt = now + 1000;
    }
    this.rateLimitCount++;
    return this.rateLimitCount > RATE_LIMIT_PER_SECOND;
  }

  private scheduleRateLimitFlush(): void {
    if (this.rateLimitFlushTimer) return;

    const delay = Math.max(0, this.rateLimitResetAt - Date.now()) + 1;
    this.rateLimitFlushTimer = setTimeout(() => {
      this.rateLimitFlushTimer = null;
      if (navigator.onLine) {
        this.flush().catch((err) => console.error('[AuditLogger] Rate-limit flush failed:', err));
      }
    }, delay);
  }

  private clearRateLimitFlushTimer(): void {
    if (!this.rateLimitFlushTimer) return;
    clearTimeout(this.rateLimitFlushTimer);
    this.rateLimitFlushTimer = null;
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.sessionRef) return;

    const exponentialDelay = Math.min(RETRY_BASE_DELAY_MS * 2 ** this.retryAttempt, RETRY_MAX_DELAY_MS);
    const jitteredDelay = Math.min(
      Math.round(exponentialDelay * (0.8 + Math.random() * 0.4)),
      RETRY_MAX_DELAY_MS,
    );
    this.retryAttempt++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!navigator.onLine || !this.sessionRef) return;
      this.flush().catch((err) => console.error('[AuditLogger] Scheduled retry failed:', err));
    }, jitteredDelay);
  }

  private resetRetry(): void {
    this.retryAttempt = 0;
    if (!this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /**
   * Only allow relative paths (same-origin) or absolute URLs on the current origin.
   * Prevents config injection from redirecting audit logs to an external server.
   */
  private static isSafeEndpoint(endpoint: string): boolean {
    if (endpoint.startsWith('/')) return true;
    try {
      const url = new URL(endpoint);
      return url.origin === globalThis.location?.origin;
    } catch {
      return false;
    }
  }
}

type AuditLoggerGlobal = typeof globalThis & {
  __sihsalusAuditLogger?: AuditLogger;
};

const auditLoggerGlobal = globalThis as AuditLoggerGlobal;

// Microfrontends can bundle workspace libraries independently. Keeping the
// logger on globalThis ensures that the session bridge and every consumer use
// the same in-memory session and online listener across bundle boundaries.
export const auditLogger =
  auditLoggerGlobal.__sihsalusAuditLogger ??
  (() => {
    const logger = new AuditLogger();
    Object.defineProperty(auditLoggerGlobal, '__sihsalusAuditLogger', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: logger,
    });
    return logger;
  })();
