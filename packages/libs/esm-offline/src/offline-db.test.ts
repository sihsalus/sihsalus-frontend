import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { DynamicOfflineData } from './dynamic-offline-data';
import { OfflineDb } from './offline-db';
import type { SyncItem } from './sync';

const databaseName = 'EsmOffline';
const legacySchema = {
  syncQueue: '++id,userId,type,[userId+type]',
  dynamicOfflineData: '++id,type,identifier,*users,&[type+identifier]',
};
const fixedSynchronizationError = {
  name: 'OfflineSynchronizationError',
  message: 'Offline synchronization failed.',
};
const openDatabases: Array<Dexie> = [];

afterEach(async () => {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }
  await Dexie.delete(databaseName);
});

describe('OfflineDb opening scrub', () => {
  it('sanitizes unsafe errors at schema v4 without changing queue or dynamic data', async () => {
    const legacyDb = trackDatabase(new Dexie(databaseName));
    legacyDb.version(4).stores(legacySchema);
    const legacyQueue = legacyDb.table<SyncItem, number>('syncQueue');
    const legacyDynamicData = legacyDb.table<DynamicOfflineData, number>('dynamicOfflineData');
    const createdOn = new Date('2026-08-20T12:00:00.000Z');
    const descriptor = { id: 'synthetic-item', patientUuid: 'synthetic-patient' };
    const content = { value: 123, nested: { preserved: true } };
    const unsafeId = await legacyQueue.add({
      userId: 'synthetic-user',
      type: 'legacy-sync-item',
      content,
      descriptor,
      createdOn,
      lastError: {
        name: 'Patient synthetic-patient',
        message: 'POST https://clinical.example.test/openmrs/ws/rest/v1/patient returned a private body',
      },
    });
    const safeId = await legacyQueue.add({
      userId: 'synthetic-user',
      type: 'safe-sync-item',
      content: { value: 456 },
      descriptor: {},
      createdOn,
      lastError: fixedSynchronizationError,
    });
    const noErrorId = await legacyQueue.add({
      userId: 'synthetic-user',
      type: 'no-error-sync-item',
      content: { value: 789 },
      descriptor: {},
      createdOn,
    });
    const extraKeyId = await legacyQueue.add({
      userId: 'synthetic-user',
      type: 'extra-key-sync-item',
      content: { value: 987 },
      descriptor: {},
      createdOn,
      lastError: {
        ...fixedSynchronizationError,
        rawBody: 'private response body',
      },
    } as SyncItem);
    const dynamicId = await legacyDynamicData.add({
      type: 'patient',
      identifier: 'synthetic-patient',
      users: ['synthetic-user'],
    });
    legacyDb.close();

    const scrubbedDb = trackDatabase(new OfflineDb());
    await scrubbedDb.open();

    expect(scrubbedDb.verno).toBe(4);
    expect(await scrubbedDb.syncQueue.count()).toBe(4);
    expect(await scrubbedDb.syncQueue.get(unsafeId)).toEqual({
      id: unsafeId,
      userId: 'synthetic-user',
      type: 'legacy-sync-item',
      content,
      descriptor,
      createdOn,
      lastError: fixedSynchronizationError,
    });
    expect((await scrubbedDb.syncQueue.get(safeId))?.lastError).toEqual(fixedSynchronizationError);
    expect(await scrubbedDb.syncQueue.get(noErrorId)).not.toHaveProperty('lastError');
    expect((await scrubbedDb.syncQueue.get(extraKeyId))?.lastError).toEqual(fixedSynchronizationError);
    expect(JSON.stringify(await scrubbedDb.syncQueue.toArray())).not.toMatch(
      /clinical\.example\.test|private response body/,
    );
    expect(await scrubbedDb.dynamicOfflineData.get(dynamicId)).toEqual({
      id: dynamicId,
      type: 'patient',
      identifier: 'synthetic-patient',
      users: ['synthetic-user'],
    });
  });

  it('remains writable by a rollback client that only declares schema v4', async () => {
    const legacyDb = trackDatabase(new Dexie(databaseName));
    legacyDb.version(4).stores(legacySchema);
    const originalId = await legacyDb.table<SyncItem, number>('syncQueue').add({
      userId: 'synthetic-user',
      type: 'legacy-sync-item',
      content: { value: 123 },
      descriptor: {},
      createdOn: new Date('2026-08-20T12:00:00.000Z'),
      lastError: {
        name: 'private name',
        message: 'private backend response',
      },
    });
    legacyDb.close();

    const currentDb = trackDatabase(new OfflineDb());
    await currentDb.open();
    expect(currentDb.verno).toBe(4);
    expect((await currentDb.syncQueue.get(originalId))?.lastError).toEqual(fixedSynchronizationError);
    currentDb.close();

    const rollbackDb = trackDatabase(new RollbackOfflineDb());
    await rollbackDb.open();
    expect(rollbackDb.verno).toBe(4);
    expect((await rollbackDb.syncQueue.get(originalId))?.lastError).toEqual(fixedSynchronizationError);
    await rollbackDb.syncQueue.update(originalId, { content: { value: 456 } });
    await rollbackDb.syncQueue.update(originalId, {
      lastError: {
        name: 'rollback private name',
        message: 'rollback private backend response',
      },
    });
    const addedId = await rollbackDb.syncQueue.add({
      userId: 'synthetic-user',
      type: 'rollback-sync-item',
      content: { value: 789 },
      descriptor: {},
      createdOn: new Date('2026-08-20T13:00:00.000Z'),
    });

    expect((await rollbackDb.syncQueue.get(originalId))?.content).toEqual({ value: 456 });
    expect(await rollbackDb.syncQueue.get(addedId)).toMatchObject({
      id: addedId,
      userId: 'synthetic-user',
      type: 'rollback-sync-item',
    });
    rollbackDb.close();

    await currentDb.open();
    expect((await currentDb.syncQueue.get(originalId))?.lastError).toEqual(fixedSynchronizationError);
    expect(JSON.stringify(await currentDb.syncQueue.toArray())).not.toContain('rollback private');
  });

  it('finishes the scrub before an auto-open operation can read the queue', async () => {
    const legacyDb = trackDatabase(new Dexie(databaseName));
    legacyDb.version(4).stores(legacySchema);
    const id = await legacyDb.table<SyncItem, number>('syncQueue').add(createUnsafeSyncItem('auto-open'));
    legacyDb.close();

    const currentDb = trackDatabase(new OfflineDb());
    const item = await currentDb.syncQueue.get(id);

    expect(currentDb.verno).toBe(4);
    expect(item?.lastError).toEqual(fixedSynchronizationError);
    expect(JSON.stringify(item)).not.toContain('auto-open private');
  });

  it('fails the open and rolls back every scrubbed row when the transaction fails', async () => {
    const legacyDb = trackDatabase(new Dexie(databaseName));
    legacyDb.version(4).stores(legacySchema);
    const legacyQueue = legacyDb.table<SyncItem, number>('syncQueue');
    await legacyQueue.add(createUnsafeSyncItem('first'));
    await legacyQueue.add(createUnsafeSyncItem('second'));
    legacyDb.close();

    const currentDb = trackDatabase(new OfflineDb());
    let updateCount = 0;
    currentDb.syncQueue.hook('updating', () => {
      updateCount += 1;
      if (updateCount === 2) {
        throw new Error('Synthetic scrub failure');
      }
    });

    await expect(currentDb.open()).rejects.toThrow();
    currentDb.close();

    const inspectionDb = trackDatabase(new RollbackOfflineDb());
    await inspectionDb.open();
    expect((await inspectionDb.syncQueue.toArray()).map((item) => item.lastError)).toEqual([
      {
        name: 'first private name',
        message: 'first private response',
      },
      {
        name: 'second private name',
        message: 'second private response',
      },
    ]);
  });

  it('serializes concurrent opening scrubs and remains idempotent', async () => {
    const legacyDb = trackDatabase(new Dexie(databaseName));
    legacyDb.version(4).stores(legacySchema);
    const legacyQueue = legacyDb.table<SyncItem, number>('syncQueue');
    const firstId = await legacyQueue.add(createUnsafeSyncItem('first'));
    const secondId = await legacyQueue.add(createUnsafeSyncItem('second'));
    legacyDb.close();

    const firstClient = trackDatabase(new OfflineDb());
    const secondClient = trackDatabase(new OfflineDb());
    await Promise.all([firstClient.open(), secondClient.open()]);

    expect(await firstClient.syncQueue.toCollection().primaryKeys()).toEqual([firstId, secondId]);
    expect((await secondClient.syncQueue.toArray()).map((item) => item.lastError)).toEqual([
      fixedSynchronizationError,
      fixedSynchronizationError,
    ]);
    firstClient.close();
    secondClient.close();

    const reopenedClient = trackDatabase(new OfflineDb());
    await reopenedClient.open();
    expect(reopenedClient.verno).toBe(4);
    expect(await reopenedClient.syncQueue.count()).toBe(2);
    expect((await reopenedClient.syncQueue.toArray()).map((item) => item.lastError)).toEqual([
      fixedSynchronizationError,
      fixedSynchronizationError,
    ]);
  });
});

class RollbackOfflineDb extends Dexie {
  syncQueue: Table<SyncItem, number>;

  constructor() {
    super(databaseName);
    this.version(4).stores(legacySchema);
    this.syncQueue = this.table('syncQueue');
  }
}

function trackDatabase<T extends Dexie>(database: T): T {
  openDatabases.push(database);
  return database;
}

function createUnsafeSyncItem(label: string): SyncItem {
  return {
    userId: 'synthetic-user',
    type: `${label}-sync-item`,
    content: { label },
    descriptor: {},
    createdOn: new Date('2026-08-20T12:00:00.000Z'),
    lastError: {
      name: `${label} private name`,
      message: `${label} private response`,
    },
  };
}
