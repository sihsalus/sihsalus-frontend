import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { DynamicOfflineData } from './dynamic-offline-data';
import type { SyncItem } from './sync';
import { createOfflineSynchronizationErrorRecord, offlineSynchronizationError } from './synchronization-error';

const offlineDatabaseSchema = {
  syncQueue: '++id,userId,type,[userId+type]',
  dynamicOfflineData: '++id,type,identifier,*users,&[type+identifier]',
};

/**
 * Accesses the central IndexedDB used by the `esm-offline` module to persist offline related state.
 * Leverages the `dexie` library for IndexedDB management.
 */
export class OfflineDb extends Dexie {
  /**
   * The table used to store the data of the offline synchronization queue (aka "sync queue" / "offline actions").
   */
  syncQueue: Table<SyncItem, number>;
  dynamicOfflineData: Table<DynamicOfflineData, number>;

  constructor() {
    super('EsmOffline');

    this.version(4).stores(offlineDatabaseSchema);

    this.syncQueue = this.table('syncQueue');
    this.dynamicOfflineData = this.table('dynamicOfflineData');

    // Keep the physical schema at v4 so the currently deployed client can still
    // open the queue after a frontend rollback. Dexie's ready promise blocks
    // queued consumers until this idempotent privacy scrub has completed.
    this.on(
      'ready',
      async () => {
        await this.transaction('rw', this.syncQueue, async () => {
          await this.syncQueue
            .filter((item) => hasUnsafeSynchronizationError(item.lastError))
            .modify((item) => {
              item.lastError = createOfflineSynchronizationErrorRecord();
            });
        });
      },
      true,
    );
  }
}

function hasUnsafeSynchronizationError(lastError: unknown): boolean {
  if (lastError === null || lastError === undefined) {
    return false;
  }

  if (typeof lastError !== 'object' || Array.isArray(lastError)) {
    return true;
  }

  const record = lastError as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length !== 2 ||
    !Object.hasOwn(record, 'name') ||
    !Object.hasOwn(record, 'message') ||
    record.name !== offlineSynchronizationError.name ||
    record.message !== offlineSynchronizationError.message
  );
}

/**
 * @internal Temporarily added for esm-offline-tools-app and workarounds. Please don't use elsewhere.
 * @deprecated Should/Will be removed in the future per the above reason.
 */
export function getOfflineDb() {
  return new OfflineDb();
}
