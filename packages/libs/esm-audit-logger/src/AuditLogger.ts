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

class AuditLogger {
  private config: Required<AuditLoggerConfig> = { ...DEFAULTS };
  private sessionRef: { userUuid: string; sessionId: string } | null = null;
  private onlineHandler: (() => void) | null = null;
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
  }

  setSession(userUuid: string, sessionId: string): void {
    this.sessionRef = { userUuid, sessionId };
  }

  clearSession(): void {
    this.sessionRef = null;
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

  destroy(): void {
    if (this.onlineHandler) {
      globalThis.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    this.initialized = false;
    // Reset rate-limit state so tests using fake clocks don't bleed into each other.
    this.rateLimitCount = 0;
    this.rateLimitResetAt = 0;
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
      id: crypto.randomUUID(),
    };

    if (navigator.onLine) {
      // Rate limiting only applies to the online path — its purpose is preventing
      // server flood attacks. The offline queue is bounded by maxOfflineEntries.
      if (this.isRateLimited()) {
        console.warn('[AuditLogger] Rate limit exceeded, event dropped:', event.eventType);
        return;
      }
      try {
        await this.sendEntries([entry]);
      } catch (err) {
        console.error('[AuditLogger] Send failed, queuing offline:', err);
        try {
          await this.storeOffline(entry);
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

  async flush(): Promise<void> {
    // Can only decrypt if we know the current user's key.
    if (!this.sessionRef) return;

    const { dbName } = this.config;
    const { userUuid } = this.sessionRef;
    const entries = await getEntriesForUser(dbName, userUuid);
    if (!entries.length) return;

    for (let i = 0; i < entries.length; i += FLUSH_BATCH_SIZE) {
      const batch = entries.slice(i, i + FLUSH_BATCH_SIZE);
      try {
        await this.sendEntries(batch);
        await clearEntries(
          dbName,
          batch.map((e) => e.id),
        );
      } catch (err) {
        console.error('[AuditLogger] Flush batch failed, stopping:', err);
        break;
      }
    }
  }

  private async storeOffline(entry: StoredAuditEntry): Promise<void> {
    await queueEntry(this.config.dbName, entry, this.config.maxOfflineEntries);
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
