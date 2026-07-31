import { decryptPayload, encryptPayload } from './crypto';
import type { StoredAuditEntry } from './types';

const STORE_NAME = 'entries';
/**
 * v2 schema: encrypted payload + timestamp index + userUuid index.
 * Upgrading from v1 drops the plaintext store — old data is intentionally
 * discarded because it was stored without encryption (PHI risk).
 */
const DB_VERSION = 2;

/**
 * What actually lives in IndexedDB. Only `id`, `userUuid`, and `timestamp`
 * are in plaintext (needed for index lookups and eviction). Everything else —
 * including `sessionId`, `locationUuid`, `patientUuid`, `encounterUuid`,
 * `eventType`, and `metadata` — is inside the AES-GCM encrypted `payload`.
 */
interface EncryptedEntry {
  id: string;
  userUuid: string; // plaintext — key derivation and IDB index filtering
  timestamp: string; // plaintext — IDB index for timestamp-ordered eviction
  payload: string; // base64(IV ∥ AES-GCM ciphertext) of the full StoredAuditEntry
}

// Cache connections to avoid opening a new handle on every operation.
const dbCache = new Map<string, IDBDatabase>();

function openDb(dbName: string): Promise<IDBDatabase> {
  const cached = dbCache.get(dbName);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop any v1 plaintext store before creating the encrypted schema.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('timestamp', 'timestamp');
      store.createIndex('userUuid', 'userUuid');
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => dbCache.delete(dbName);
      dbCache.set(dbName, db);
      resolve(db);
    };

    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

/**
 * Atomically: count → evict oldest if at capacity → insert.
 * All within a single IDB `readwrite` transaction, so concurrent tabs cannot
 * race between the count check and the write (TOCTOU eliminated).
 */
function putEncryptedEntry(dbName: string, encEntry: EncryptedEntry, maxEntries: number): Promise<number> {
  return openDb(dbName).then(
    (db) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let evictedEntries = 0;

        const countReq = store.count();
        countReq.onsuccess = () => {
          const count = countReq.result;
          if (count >= maxEntries) {
            // Walk the timestamp index oldest-first and delete until we have room.
            const toDelete = count - maxEntries + 1;
            let deleted = 0;
            const cursorReq = store.index('timestamp').openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor && deleted < toDelete) {
                cursor.delete();
                deleted++;
                evictedEntries++;
                cursor.continue();
              } else {
                store.put(encEntry);
              }
            };
            cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Cursor error during eviction'));
          } else {
            store.put(encEntry);
          }
        };

        tx.oncomplete = () => resolve(evictedEntries);
        tx.onerror = () => reject(tx.error ?? new Error('Failed to put entry in IndexedDB'));
      }),
  );
}

/**
 * Encrypt `entry` with the user's derived key and store it atomically,
 * evicting the oldest entry if the store is at capacity.
 */
export async function queueEntry(dbName: string, entry: StoredAuditEntry, maxEntries: number): Promise<number> {
  const encEntry: EncryptedEntry = {
    id: entry.id,
    userUuid: entry.userUuid,
    timestamp: entry.timestamp,
    payload: await encryptPayload(entry, entry.userUuid),
  };
  return putEncryptedEntry(dbName, encEntry, maxEntries);
}

/**
 * Fetch and decrypt all entries belonging to `userUuid`.
 * Entries that cannot be decrypted are returned separately by id rather than
 * dropped, so the caller can report the loss and purge them.
 */
export async function getEntriesForUser(
  dbName: string,
  userUuid: string,
): Promise<{ entries: StoredAuditEntry[]; undecryptableIds: string[] }> {
  const db = await openDb(dbName);
  const encEntries = await new Promise<EncryptedEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('userUuid').getAll(userUuid);
    req.onsuccess = () => resolve(req.result as EncryptedEntry[]);
    req.onerror = () => reject(req.error ?? new Error('Failed to get entries from IndexedDB'));
  });

  const results: StoredAuditEntry[] = [];
  const undecryptableIds: string[] = [];
  for (const enc of encEntries) {
    const entry = await decryptPayload<StoredAuditEntry>(enc.payload, userUuid);
    if (entry) {
      results.push(entry);
    } else {
      // Key rotated, storage corrupted, or written before the per-device salt.
      // Report these rather than dropping them from the result and moving on:
      // an audit trail that loses records without saying so is not one you can
      // stand behind. The caller also purges them, because an entry that can
      // never be decrypted can never be sent, and would otherwise hold a slot
      // in the bounded queue until it evicted a readable event.
      undecryptableIds.push(enc.id);
    }
  }
  return { entries: results, undecryptableIds };
}

export async function clearEntries(dbName: string, ids: string[]): Promise<void> {
  const db = await openDb(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => {
      store.delete(id);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear entries from IndexedDB'));
  });
}
