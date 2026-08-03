import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearKeyCache } from './crypto';
import { clearEntries, getEntriesForUser, queueEntry } from './db';
import type { StoredAuditEntry } from './types';

// Use a fresh DB name per test so the module-level dbCache never returns
// a stale connection from a previously deleted database.
let DB: string;

function makeEntry(overrides: Partial<StoredAuditEntry> = {}): StoredAuditEntry {
  return {
    id: crypto.randomUUID(),
    eventType: 'VIEW',
    userUuid: 'user-1',
    sessionId: 'sess-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  DB = `test-audit-db-${crypto.randomUUID()}`;
});

afterEach(() => {
  clearKeyCache();
});

describe('queueEntry / getEntriesForUser', () => {
  it('stores and retrieves an entry', async () => {
    const entry = makeEntry();
    await queueEntry(DB, entry, 10);
    const { entries: results } = await getEntriesForUser(DB, 'user-1');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: entry.id, eventType: 'VIEW', sessionId: 'sess-1' });
  });

  it('decrypts — the raw IDB row does not contain plaintext PHI', async () => {
    const entry = makeEntry({ patientUuid: 'sensitive-patient' });
    await queueEntry(DB, entry, 10);

    // Read the raw encrypted row directly from IDB.
    const rawRow = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const req = indexedDB.open(DB, 2);
      req.onsuccess = () => {
        const tx = req.result.transaction('entries', 'readonly');
        const getReq = tx.objectStore('entries').getAll();
        getReq.onsuccess = () => resolve(getReq.result[0] as Record<string, unknown>);
        getReq.onerror = () => reject(new Error(getReq.error?.message ?? 'IndexedDB read error'));
      };
      req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB open error'));
    });

    expect(rawRow['userUuid']).toBe('user-1'); // plaintext index field
    expect(rawRow['payload']).toBeTypeOf('string'); // ciphertext blob
    expect(JSON.stringify(rawRow)).not.toContain('sensitive-patient');
    expect(JSON.stringify(rawRow)).not.toContain('sess-1');
  });

  it('only returns entries for the requesting user', async () => {
    await queueEntry(DB, makeEntry({ id: 'a', userUuid: 'user-1' }), 10);
    await queueEntry(DB, makeEntry({ id: 'b', userUuid: 'user-2' }), 10);
    const { entries: forUser1 } = await getEntriesForUser(DB, 'user-1');
    const { entries: forUser2 } = await getEntriesForUser(DB, 'user-2');
    expect(forUser1.map((e) => e.id)).toEqual(['a']);
    expect(forUser2.map((e) => e.id)).toEqual(['b']);
  });

  it('evicts the oldest entry when capacity is reached (atomic)', async () => {
    const MAX = 3;
    const t0 = new Date('2024-01-01T00:00:00.000Z');

    // Fill to capacity — oldest timestamp first so eviction is predictable.
    for (let i = 0; i < MAX; i++) {
      await queueEntry(DB, makeEntry({ id: `entry-${i}`, timestamp: new Date(t0.getTime() + i).toISOString() }), MAX);
    }

    // Add one more — should evict entry-0 (oldest).
    await queueEntry(DB, makeEntry({ id: 'entry-new', timestamp: new Date(t0.getTime() + MAX).toISOString() }), MAX);

    const { entries: results } = await getEntriesForUser(DB, 'user-1');
    expect(results).toHaveLength(MAX);
    expect(results.map((e) => e.id)).not.toContain('entry-0');
    expect(results.map((e) => e.id)).toContain('entry-new');
  });
});

describe('undecryptable entries', () => {
  it('reports them by id instead of dropping them from the result', async () => {
    // A record the trail cannot read is still a record it lost. Returning the
    // ids is what lets the caller say so, and reclaim the slot it holds.
    await queueEntry(DB, makeEntry({ id: 'readable' }), 10);
    await queueEntry(DB, makeEntry({ id: 'corrupt' }), 10);

    const crypto = await import('./crypto');
    const realDecrypt = crypto.decryptPayload;
    vi.spyOn(crypto, 'decryptPayload').mockImplementation(async (payload, user) => {
      const entry = await realDecrypt<{ id: string }>(payload, user);
      return entry?.id === 'corrupt' ? null : entry;
    });

    const { entries, undecryptableIds } = await getEntriesForUser(DB, 'user-1');

    expect(entries.map((e) => e.id)).toEqual(['readable']);
    expect(undecryptableIds).toEqual(['corrupt']);
    vi.restoreAllMocks();
  });
});

describe('clearEntries', () => {
  it('removes only the specified ids', async () => {
    await queueEntry(DB, makeEntry({ id: 'keep' }), 10);
    await queueEntry(DB, makeEntry({ id: 'remove' }), 10);
    await clearEntries(DB, ['remove']);
    const { entries: results } = await getEntriesForUser(DB, 'user-1');
    expect(results.map((e) => e.id)).toEqual(['keep']);
  });

  it('is a no-op for non-existent ids', async () => {
    await queueEntry(DB, makeEntry({ id: 'a' }), 10);
    await clearEntries(DB, ['does-not-exist']);
    const { entries: results } = await getEntriesForUser(DB, 'user-1');
    expect(results).toHaveLength(1);
  });
});
