import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  getDynamicOfflineDataEntries,
  getDynamicOfflineDataEntriesFor,
  putDynamicOfflineData,
  putDynamicOfflineDataFor,
  removeDynamicOfflineData,
  removeDynamicOfflineDataFor,
  setupDynamicOfflineDataHandler,
  syncDynamicOfflineData,
} from './dynamic-offline-data';
import { OfflineDb } from './offline-db';

const mockUserId = '00000000-0000-0000-0000-000000000000';

vi.mock('@openmrs/esm-api', () => ({
  getLoggedInUser: vi.fn(async () => ({ uuid: mockUserId })),
}));

let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  // Hide dexie warnings about missing indexes.
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  consoleWarn.mockRestore();
});

afterEach(async () => {
  // We want each test case to start fresh with a clean sync queue.
  await new OfflineDb().dynamicOfflineData.clear();
});

describe('putDynamicOfflineData', () => {
  it('creates new entry if none exists yet', async () => {
    await putDynamicOfflineData('test', '123');

    const entries = await getDynamicOfflineDataEntries('test');
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('test');
    expect(entries[0].identifier).toBe('123');
    expect(entries[0].users).toStrictEqual([mockUserId]);
  });

  it('does not create new entry if type+identifier combination already exists', async () => {
    await putDynamicOfflineData('test', '123');
    await putDynamicOfflineData('test', '123');

    const entries = await getDynamicOfflineDataEntries('test');
    expect(entries).toHaveLength(1);
  });

  it('combines users if entry is already registered for other user', async () => {
    await putDynamicOfflineDataFor('user-id-1', 'test', '123');
    await putDynamicOfflineDataFor('user-id-2', 'test', '123');

    const entries = await getDynamicOfflineDataEntriesFor('user-id-1', 'test');
    expect(entries).toHaveLength(1);
    expect(entries[0].users).toStrictEqual(['user-id-1', 'user-id-2']);
  });
});

describe('removeDynamicOfflineData', () => {
  it('removes entry of single user', async () => {
    await putDynamicOfflineData('test', '123');
    await removeDynamicOfflineData('test', '123');
    const entries = await getDynamicOfflineDataEntries('test');
    expect(entries).toHaveLength(0);
  });

  it('removes calling user of entry with multiple users', async () => {
    await putDynamicOfflineDataFor('user-id-1', 'test', '123');
    await putDynamicOfflineDataFor('user-id-2', 'test', '123');
    await removeDynamicOfflineDataFor('user-id-1', 'test', '123');

    const entries = await getDynamicOfflineDataEntriesFor('user-id-2', 'test');
    expect(entries).toHaveLength(1);
    expect(entries[0].users).toStrictEqual(['user-id-2']);
  });
});

describe('syncDynamicOfflineData', () => {
  it('waits for asynchronous handlers before recording a successful sync', async () => {
    const handlerType = 'test-await-handler';
    let finishHandler = () => {};
    let notifyHandlerStarted = () => {};
    const handlerStarted = new Promise<void>((resolve) => {
      notifyHandlerStarted = resolve;
    });

    setupDynamicOfflineDataHandler({
      id: 'test-await-handler:delayed',
      type: handlerType,
      isSynced: vi.fn(async () => false),
      sync: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishHandler = resolve;
            notifyHandlerStarted();
          }),
      ),
    });

    const syncPromise = syncDynamicOfflineData(handlerType, 'patient-123');
    await handlerStarted;

    const entriesWhilePending = await getDynamicOfflineDataEntries(handlerType);
    expect(entriesWhilePending[0].syncState).toBeUndefined();

    finishHandler();
    await syncPromise;

    const entriesAfterSync = await getDynamicOfflineDataEntries(handlerType);
    expect(entriesAfterSync[0].syncState).toMatchObject({
      succeededHandlers: ['test-await-handler:delayed'],
      erroredHandlers: [],
      errors: [],
    });
  });

  it('persists partial handler failures, rejects the attempt, and succeeds on retry', async () => {
    const handlerType = 'test-retry-handler';
    const stableSync = vi.fn(async () => {});
    const retryableSync = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('temporary cache failure'))
      .mockResolvedValue(undefined);

    setupDynamicOfflineDataHandler({
      id: 'test-retry-handler:stable',
      type: handlerType,
      isSynced: vi.fn(async () => true),
      sync: stableSync,
    });
    setupDynamicOfflineDataHandler({
      id: 'test-retry-handler:unstable',
      type: handlerType,
      isSynced: vi.fn(async () => false),
      sync: retryableSync,
    });

    await expect(syncDynamicOfflineData(handlerType, 'patient-456')).rejects.toMatchObject({
      name: 'AggregateError',
      message: '1 of 2 offline data handlers failed to synchronize.',
    });

    const entriesAfterFailure = await getDynamicOfflineDataEntries(handlerType);
    expect(entriesAfterFailure[0].syncState).toMatchObject({
      succeededHandlers: ['test-retry-handler:stable'],
      erroredHandlers: ['test-retry-handler:unstable'],
      errors: [
        {
          handlerId: 'test-retry-handler:unstable',
          message: 'temporary cache failure',
        },
      ],
    });

    await expect(syncDynamicOfflineData(handlerType, 'patient-456')).resolves.toBeUndefined();

    const entriesAfterRetry = await getDynamicOfflineDataEntries(handlerType);
    expect(entriesAfterRetry[0].syncState).toMatchObject({
      succeededHandlers: ['test-retry-handler:stable', 'test-retry-handler:unstable'],
      erroredHandlers: [],
      errors: [],
    });
    expect(stableSync).toHaveBeenCalledTimes(2);
    expect(retryableSync).toHaveBeenCalledTimes(2);
  });
});
