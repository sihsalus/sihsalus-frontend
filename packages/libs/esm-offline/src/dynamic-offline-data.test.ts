import { getLoggedInUser } from '@openmrs/esm-api';
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
  syncAllDynamicOfflineData,
  syncDynamicOfflineData,
} from './dynamic-offline-data';
import { OfflineDb } from './offline-db';

const mockUserId = '00000000-0000-0000-0000-000000000000';

vi.mock('@openmrs/esm-api', () => ({
  getLoggedInUser: vi.fn(async () => ({ uuid: mockUserId })),
}));

const mockGetLoggedInUser = vi.mocked(getLoggedInUser);

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
    const sensitiveHandlerError = new Error('GET /patient/private-patient-uuid?name=Synthetic%20Patient failed');
    const retryableSync = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(sensitiveHandlerError)
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

    let syncError: unknown;
    try {
      await syncDynamicOfflineData(handlerType, 'patient-456');
    } catch (error: unknown) {
      syncError = error;
    }

    expect(syncError).toMatchObject({
      name: 'AggregateError',
      message: '1 of 2 offline data handlers failed to synchronize.',
    });
    expect(syncError).toBeInstanceOf(AggregateError);
    if (!(syncError instanceof AggregateError)) {
      throw new Error('Expected an AggregateError from the failed synchronization.');
    }
    expect(syncError.errors).toHaveLength(1);
    expect(syncError.errors[0]).toMatchObject({
      message: 'Offline data handler "test-retry-handler:unstable" failed to synchronize.',
    });
    expect(syncError.errors).not.toContain(sensitiveHandlerError);
    expect(syncError.errors.map((error) => String(error)).join(' ')).not.toMatch(
      /private-patient-uuid|Synthetic%20Patient/,
    );

    const entriesAfterFailure = await getDynamicOfflineDataEntries(handlerType);
    expect(entriesAfterFailure[0].syncState).toMatchObject({
      succeededHandlers: ['test-retry-handler:stable'],
      erroredHandlers: ['test-retry-handler:unstable'],
      errors: [
        {
          handlerId: 'test-retry-handler:unstable',
          message: 'This offline data could not be synchronized.',
        },
      ],
    });
    expect(JSON.stringify(entriesAfterFailure[0].syncState)).not.toMatch(/private-patient-uuid|Synthetic%20Patient/);

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

describe('syncAllDynamicOfflineData', () => {
  it('waits for every entry before rejecting once with a fixed non-sensitive error', async () => {
    const handlerType = 'test-all-settled-batch';
    const failedIdentifier = 'private-entry-uuid';
    const delayedIdentifier = 'delayed-entry-uuid';
    let finishDelayedEntry = () => {};
    let notifyDelayedEntryStarted = () => {};
    const delayedEntryStarted = new Promise<void>((resolve) => {
      notifyDelayedEntryStarted = resolve;
    });

    setupDynamicOfflineDataHandler({
      id: 'test-all-settled-batch:handler',
      type: handlerType,
      isSynced: vi.fn(async () => false),
      sync: vi.fn(async (identifier) => {
        if (identifier === failedIdentifier) {
          throw new Error('GET /patient/private-entry-uuid?name=Synthetic%20Patient failed');
        }

        if (identifier === delayedIdentifier) {
          notifyDelayedEntryStarted();
          await new Promise<void>((resolve) => {
            finishDelayedEntry = resolve;
          });
        }
      }),
    });
    await putDynamicOfflineData(handlerType, failedIdentifier);
    await putDynamicOfflineData(handlerType, delayedIdentifier);

    let batchSettled = false;
    const batchResult = syncAllDynamicOfflineData(handlerType)
      .then(
        () => ({ status: 'fulfilled' as const, error: undefined }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      )
      .finally(() => {
        batchSettled = true;
      });

    await delayedEntryStarted;
    await vi.waitFor(async () => {
      const entries = await getDynamicOfflineDataEntries(handlerType);
      expect(entries.find((entry) => entry.identifier === failedIdentifier)?.syncState).toBeDefined();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const settledBeforeDelayedEntry = batchSettled;

    finishDelayedEntry();
    const result = await batchResult;

    expect(settledBeforeDelayedEntry).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(AggregateError);
    expect(result.error).toMatchObject({ message: 'Offline data synchronization failed.' });
    expect(String(result.error)).not.toMatch(/private-entry-uuid|Synthetic%20Patient/);
    expect(Object.hasOwn(result.error as object, 'cause')).toBe(false);

    const entries = await getDynamicOfflineDataEntries(handlerType);
    expect(entries.find((entry) => entry.identifier === failedIdentifier)?.syncState).toMatchObject({
      succeededHandlers: [],
      erroredHandlers: ['test-all-settled-batch:handler'],
    });
    expect(entries.find((entry) => entry.identifier === delayedIdentifier)?.syncState).toMatchObject({
      succeededHandlers: ['test-all-settled-batch:handler'],
      erroredHandlers: [],
    });
  });

  it('sanitizes failures that occur before entry synchronization starts', async () => {
    mockGetLoggedInUser.mockRejectedValueOnce(
      new Error('Session lookup exposed private-patient-uuid and Synthetic Patient'),
    );

    const syncAttempt = syncAllDynamicOfflineData('test-batch-lookup-failure');
    await expect(syncAttempt).rejects.toThrow('Offline data synchronization failed.');
    await expect(syncAttempt).rejects.not.toThrow(/private-patient-uuid|Synthetic Patient/);
  });
});
