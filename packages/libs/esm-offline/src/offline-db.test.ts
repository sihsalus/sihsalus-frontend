import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { OfflineDb } from './offline-db';
import type { SyncItem } from './sync';

const databaseName = 'EsmOffline';
const legacySchema = {
  syncQueue: '++id,userId,type,[userId+type]',
  dynamicOfflineData: '++id,type,identifier,*users,&[type+identifier]',
};

afterEach(async () => {
  await Dexie.delete(databaseName);
});

describe('OfflineDb migrations', () => {
  it('replaces legacy synchronization error details in the persisted row', async () => {
    const legacyDb = new Dexie(databaseName);
    legacyDb.version(4).stores(legacySchema);
    const legacyQueue = legacyDb.table<SyncItem, number>('syncQueue');
    const id = await legacyQueue.add({
      userId: '00000000-0000-0000-0000-000000000000',
      type: 'legacy-sync-item',
      content: { value: 123 },
      descriptor: {},
      createdOn: new Date('2026-08-20T12:00:00.000Z'),
      lastError: {
        name: 'Patient 00000000-0000-0000-0000-000000000001',
        message: 'POST https://clinical.example.test/openmrs/ws/rest/v1/patient returned a private body',
      },
    });
    legacyDb.close();

    const upgradedDb = new OfflineDb();
    await upgradedDb.open();
    const persistedItem = await upgradedDb.syncQueue.get(id);

    expect(persistedItem?.lastError).toEqual({
      name: 'OfflineSynchronizationError',
      message: 'Offline synchronization failed.',
    });
    expect(JSON.stringify(persistedItem?.lastError)).not.toContain('clinical.example.test');
    upgradedDb.close();
  });
});
