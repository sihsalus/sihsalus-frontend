import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { DynamicOfflineData } from './dynamic-offline-data';
import type { SyncItem } from './sync';
import { createOfflineSynchronizationErrorRecord } from './synchronization-error';

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
    this.version(5)
      .stores(offlineDatabaseSchema)
      .upgrade(async (transaction) => {
        await transaction
          .table<SyncItem, number>('syncQueue')
          .filter((item) => Boolean(item.lastError))
          .modify((item) => {
            item.lastError = createOfflineSynchronizationErrorRecord();
          });
      });

    this.syncQueue = this.table('syncQueue');
    this.dynamicOfflineData = this.table('dynamicOfflineData');
  }
}

/**
 * @internal Temporarily added for esm-offline-tools-app and workarounds. Please don't use elsewhere.
 * @deprecated Should/Will be removed in the future per the above reason.
 */
export function getOfflineDb() {
  return new OfflineDb();
}
