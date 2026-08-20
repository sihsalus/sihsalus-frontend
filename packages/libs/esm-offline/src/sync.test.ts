import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { getLoggedInUser } from '@openmrs/esm-api';
import { OfflineDb } from './offline-db';
import type { QueueItemDescriptor } from './sync';
import {
  beginEditSynchronizationItem,
  deleteSynchronizationItem,
  getFullSynchronizationItems,
  getFullSynchronizationItemsFor,
  getOfflineSynchronizationStore,
  getSynchronizationItem,
  getSynchronizationItems,
  getSynchronizationItemsFor,
  queueSynchronizationItem,
  queueSynchronizationItemFor,
  runSynchronization,
  setupOfflineSync,
} from './sync';

interface MockSyncItem {
  value: number;
}

const systemTime = new Date();
const mockUserId = '00000000-0000-0000-0000-000000000000';
const otherMockUserId = '11111111-1111-1111-1111-111111111111';
const mockSyncItemType = 'mock-sync-item';
const offlineQueueOperationUnavailableMessage = 'Offline queue operation is unavailable.';
const defaultMockSyncItem: MockSyncItem = {
  value: 123,
};
const defaultMockSyncItemDescriptor: QueueItemDescriptor = {
  dependencies: [],
  id: '123',
  displayName: 'Mock Sync Item',
  patientUuid: '00000000-0000-0000-0000-000000000001',
};

let currentUserId = mockUserId;
const sessionSubscribers = new Set<() => void>();
const mockSessionStore = {
  getState: vi.fn(() => ({
    loaded: true as const,
    session: {
      authenticated: true,
      sessionId: 'test-session',
      user: { uuid: currentUserId },
    },
  })),
  subscribe: vi.fn((subscriber: () => void) => {
    sessionSubscribers.add(subscriber);
    return () => sessionSubscribers.delete(subscriber);
  }),
};

vi.mock('@openmrs/esm-api', () => ({
  getLoggedInUser: vi.fn(async () => ({ uuid: currentUserId })),
  getSessionStore: vi.fn(() => mockSessionStore),
}));

afterEach(async () => {
  // We want each test case to start fresh with a clean sync queue.
  await new OfflineDb().syncQueue.clear();
  setCurrentUser(mockUserId);
  getOfflineSynchronizationStore().setState({ synchronization: undefined });
});

function setCurrentUser(userId: string) {
  currentUserId = userId;
  sessionSubscribers.forEach((subscriber) => {
    subscriber();
  });
}

async function seedSynchronizationItemFor<T>(
  userId: string,
  type: string,
  content: T,
  descriptor: QueueItemDescriptor = {},
) {
  return await new OfflineDb().syncQueue.add({
    userId,
    type,
    content,
    descriptor,
    createdOn: new Date(),
  });
}

describe('Sync Queue', () => {
  beforeAll(() => {
    // We want to control the timers to ensure that we can test the `createdOn` attribute
    // of the sync item (which is created using `new Date()`).
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('enqueues sync item with expected attributes', async () => {
    const id = await queueSynchronizationItemFor(
      mockUserId,
      mockSyncItemType,
      defaultMockSyncItem,
      defaultMockSyncItemDescriptor,
    );
    const queuedItems = await getFullSynchronizationItemsFor<MockSyncItem>(mockUserId, mockSyncItemType);

    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0].id).toBe(id);
    expect(queuedItems[0].type).toBe(mockSyncItemType);
    expect(queuedItems[0].userId).toBe(mockUserId);
    expect(queuedItems[0].createdOn).toStrictEqual(systemTime);
    expect(queuedItems[0].content).toStrictEqual(defaultMockSyncItem);
    expect(queuedItems[0].descriptor).toStrictEqual(defaultMockSyncItemDescriptor);
  });

  it('allows querying for items of all types at once', async () => {
    await queueSynchronizationItem('type-a', defaultMockSyncItem);
    await queueSynchronizationItem('type-b', defaultMockSyncItem);
    const queuedItems = await getFullSynchronizationItems();
    expect(queuedItems).toHaveLength(2);
  });

  it('atomically replaces a current-user item with the same descriptor ID', async () => {
    const descriptor = { id: 'replaceable-item' };
    const originalId = await queueSynchronizationItem(mockSyncItemType, { value: 1 }, descriptor);

    const replacementId = await queueSynchronizationItem(mockSyncItemType, { value: 2 }, descriptor);

    expect(replacementId).not.toBe(originalId);
    expect(await getSynchronizationItem(originalId)).toBeUndefined();
    expect(await getSynchronizationItems<MockSyncItem>(mockSyncItemType)).toEqual([{ value: 2 }]);
  });
});

describe('Logged-in user specific functions', () => {
  it('enqueue and return sync items of currently logged-in user', async () => {
    const loggedInUserId = (await getLoggedInUser()).uuid;
    await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    const queuedItems = await getFullSynchronizationItems(mockSyncItemType);

    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0].userId).toBe(loggedInUserId);
  });

  it("does not enqueue or replace another user's item", async () => {
    const descriptor = { id: 'foreign-item' };
    const otherUserItemId = await seedSynchronizationItemFor(
      otherMockUserId,
      mockSyncItemType,
      defaultMockSyncItem,
      descriptor,
    );

    await expect(
      queueSynchronizationItemFor(otherMockUserId, mockSyncItemType, { value: 999 }, descriptor),
    ).rejects.toThrow(offlineQueueOperationUnavailableMessage);

    setCurrentUser(otherMockUserId);
    expect(await getSynchronizationItem<MockSyncItem>(otherUserItemId)).toMatchObject({
      content: defaultMockSyncItem,
      userId: otherMockUserId,
    });
  });

  it('replaces session lookup failures with the fixed queue error', async () => {
    const sensitiveDetails =
      'GET https://clinical.example.test/openmrs/ws/rest/v1/session exposed a private response body';
    vi.mocked(getLoggedInUser).mockRejectedValueOnce(new Error(sensitiveDetails));

    const error = await getFullSynchronizationItems().catch((reason: unknown) => reason);

    expect(error).toEqual(
      expect.objectContaining({
        message: offlineQueueOperationUnavailableMessage,
      }),
    );
    expect(String(error)).not.toContain(sensitiveDetails);
  });
});

describe('getSynchronizationItems', () => {
  it('returns `content` of corresponding `getFullSynchronizationItems` call', async () => {
    await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    const items = await getSynchronizationItems(mockSyncItemType);
    const fullItems = await getFullSynchronizationItems(mockSyncItemType);
    expect(items).toHaveLength(1);
    expect(fullItems).toHaveLength(1);
    expect(items[0]).toStrictEqual(fullItems[0].content);
  });
});

describe('getSynchronizationItemsFor', () => {
  it('returns `content` of corresponding `getFullSynchronizationItemsFor` call', async () => {
    await queueSynchronizationItemFor(mockUserId, mockSyncItemType, defaultMockSyncItem);
    const items = await getSynchronizationItemsFor(mockUserId, mockSyncItemType);
    const fullItems = await getFullSynchronizationItemsFor(mockUserId, mockSyncItemType);

    expect(items).toHaveLength(1);
    expect(fullItems).toHaveLength(1);
    expect(items[0]).toStrictEqual(fullItems[0].content);
  });
});

describe('getSynchronizationItem', () => {
  it('returns the specific sync item with given ID', async () => {
    const id = await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    const items = await getFullSynchronizationItems(mockSyncItemType);
    const item = await getSynchronizationItem(id);
    expect(item).toStrictEqual(items[0]);
  });

  it('returns undefined when no item with given ID exists', async () => {
    const item = await getSynchronizationItem(404);
    expect(item).toBeUndefined();
  });

  it("does not return another user's item even when its numeric ID is known", async () => {
    const otherUserItemId = await seedSynchronizationItemFor(otherMockUserId, mockSyncItemType, defaultMockSyncItem);

    const item = await getSynchronizationItem(otherUserItemId);

    expect(item).toBeUndefined();
    await expect(getFullSynchronizationItemsFor(otherMockUserId)).rejects.toThrow(
      offlineQueueOperationUnavailableMessage,
    );
    await expect(getSynchronizationItemsFor(otherMockUserId)).rejects.toThrow(offlineQueueOperationUnavailableMessage);

    setCurrentUser(otherMockUserId);
    expect(await getSynchronizationItem(otherUserItemId)).toMatchObject({
      id: otherUserItemId,
      userId: otherMockUserId,
    });
  });

  it('replaces legacy persisted error details with a fixed safe error', async () => {
    const id = await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    await new OfflineDb().syncQueue.update(id, {
      lastError: {
        name: 'Patient 00000000-0000-0000-0000-000000000001',
        message: 'POST https://clinical.example.test/openmrs/ws/rest/v1/patient returned a private body',
      },
    });

    const item = await getSynchronizationItem(id);

    expect(item?.lastError).toEqual({
      name: 'OfflineSynchronizationError',
      message: 'Offline synchronization failed.',
    });
  });
});

describe('deleteSynchronizationItem', () => {
  it('deletes sync item with given ID', async () => {
    const id = await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    await deleteSynchronizationItem(id);
    const items = await getSynchronizationItems(mockSyncItemType);
    expect(items).toHaveLength(0);
  });

  it('fails generically when no item with given ID exists', async () => {
    await expect(deleteSynchronizationItem(404)).rejects.toThrow(offlineQueueOperationUnavailableMessage);
  });

  it("does not delete another user's item even when its numeric ID is known", async () => {
    const otherUserItemId = await seedSynchronizationItemFor(otherMockUserId, mockSyncItemType, defaultMockSyncItem);

    await expect(deleteSynchronizationItem(otherUserItemId)).rejects.toThrow(offlineQueueOperationUnavailableMessage);

    setCurrentUser(otherMockUserId);
    expect(await getSynchronizationItem(otherUserItemId)).toBeDefined();
  });
});

describe('beginEditSynchronizationItem', () => {
  it("does not start editing another user's item and leaves that item unchanged", async () => {
    const type = 'user-isolated-edit-item';
    const onBeginEditSyncItem = vi.fn();
    setupOfflineSync(
      type,
      [],
      vi.fn(async () => undefined),
      { onBeginEditSyncItem },
    );
    const otherUserItemId = await seedSynchronizationItemFor(otherMockUserId, type, defaultMockSyncItem);

    await expect(beginEditSynchronizationItem(otherUserItemId)).rejects.toThrow(
      offlineQueueOperationUnavailableMessage,
    );
    expect(onBeginEditSyncItem).not.toHaveBeenCalled();

    setCurrentUser(otherMockUserId);
    await beginEditSynchronizationItem(otherUserItemId);
    expect(onBeginEditSyncItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: otherUserItemId, userId: otherMockUserId }),
    );
    expect(await getSynchronizationItem(otherUserItemId)).toBeDefined();
  });

  it('uses the same generic error for a missing item and an unsupported handler', async () => {
    const id = await queueSynchronizationItem('unsupported-edit-item', defaultMockSyncItem);

    await expect(beginEditSynchronizationItem(404)).rejects.toThrow(offlineQueueOperationUnavailableMessage);
    await expect(beginEditSynchronizationItem(id)).rejects.toThrow(offlineQueueOperationUnavailableMessage);
  });

  it('replaces a throwing edit callback with the fixed queue error', async () => {
    const type = 'throwing-edit-item';
    const sensitiveDetails = 'Patient 00000000-0000-0000-0000-000000000001 could not be opened';
    setupOfflineSync(
      type,
      [],
      vi.fn(async () => undefined),
      {
        onBeginEditSyncItem: () => {
          throw new Error(sensitiveDetails);
        },
      },
    );
    const id = await queueSynchronizationItem(type, defaultMockSyncItem);

    const error = await beginEditSynchronizationItem(id).catch((reason: unknown) => reason);

    expect(error).toEqual(
      expect.objectContaining({
        message: offlineQueueOperationUnavailableMessage,
      }),
    );
    expect(String(error)).not.toContain(sensitiveDetails);
  });
});

describe('runSynchronization', () => {
  it('rejects a concurrent attempt instead of reporting false completion', async () => {
    const type = 'concurrent-sync-item';
    let finishProcessing: (() => void) | undefined;
    setupOfflineSync(
      type,
      [],
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishProcessing = resolve;
          }),
      ),
    );
    await queueSynchronizationItem(type, defaultMockSyncItem);

    const synchronization = runSynchronization();
    await vi.waitFor(() => expect(finishProcessing).toBeTypeOf('function'));

    await expect(runSynchronization()).rejects.toThrow(offlineQueueOperationUnavailableMessage);

    finishProcessing?.();
    await expect(synchronization).resolves.toBeUndefined();
  });

  it('rejects when a new current-user item remains after the handler snapshot', async () => {
    const type = 'queue-growth-sync-item';
    let finishProcessing: (() => void) | undefined;
    setupOfflineSync(
      type,
      [],
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishProcessing = resolve;
          }),
      ),
    );
    await queueSynchronizationItem(type, { value: 1 });

    const synchronization = runSynchronization();
    const handledSynchronization = synchronization.catch((error: unknown) => error);
    await vi.waitFor(() => expect(finishProcessing).toBeTypeOf('function'));
    await queueSynchronizationItem(type, { value: 2 });

    finishProcessing?.();
    await expect(handledSynchronization).resolves.toEqual(
      expect.objectContaining({
        message: offlineQueueOperationUnavailableMessage,
      }),
    );
    expect(await getSynchronizationItems<MockSyncItem>(type)).toEqual([{ value: 2 }]);
  });

  it('preserves current-user items when explicit cancellation occurs', async () => {
    const type = 'canceled-sync-item';
    let finishProcessing: (() => void) | undefined;
    const process = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishProcessing = resolve;
        }),
    );
    setupOfflineSync(type, [], process);
    const firstItemId = await queueSynchronizationItem(type, { value: 1 });
    const secondItemId = await queueSynchronizationItem(type, { value: 2 });

    const synchronization = runSynchronization();
    const handledSynchronization = synchronization.catch((error: unknown) => error);
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));

    getOfflineSynchronizationStore().getState().synchronization?.abortController.abort();
    finishProcessing?.();

    await expect(handledSynchronization).resolves.toEqual(
      expect.objectContaining({
        message: offlineQueueOperationUnavailableMessage,
      }),
    );
    expect(process).toHaveBeenCalledTimes(1);
    expect((await getSynchronizationItem(firstItemId))?.lastError).toBeUndefined();
    expect((await getSynchronizationItem(secondItemId))?.lastError).toBeUndefined();
  });

  it("processes and counts only the authenticated user's items", async () => {
    const type = 'user-isolated-sync-item';
    let finishProcessing: (() => void) | undefined;
    const process = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishProcessing = resolve;
        }),
    );
    setupOfflineSync(type, [], process);
    await queueSynchronizationItemFor(mockUserId, type, { value: 1 });
    await seedSynchronizationItemFor(otherMockUserId, type, { value: 2 });
    setCurrentUser(otherMockUserId);

    const synchronization = runSynchronization();
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));

    expect(process).toHaveBeenCalledWith(
      { value: 2 },
      expect.objectContaining({
        userId: otherMockUserId,
        index: 0,
        items: [{ value: 2 }],
      }),
    );
    expect(getOfflineSynchronizationStore().getState().synchronization).toMatchObject({
      totalCount: 1,
      pendingCount: 1,
    });

    finishProcessing?.();
    await synchronization;

    expect(await getFullSynchronizationItems(type)).toHaveLength(0);
    setCurrentUser(mockUserId);
    expect(await getFullSynchronizationItems(type)).toHaveLength(1);
  });

  it('aborts visible progress and preserves the original queue when the authenticated user changes', async () => {
    const type = 'session-change-sync-item';
    let finishProcessing: (() => void) | undefined;
    let observedAbortController: AbortController | undefined;
    const process = vi.fn(
      (_item: MockSyncItem, options: { abort: AbortController }) =>
        new Promise<void>((resolve) => {
          observedAbortController = options.abort;
          finishProcessing = resolve;
        }),
    );
    setupOfflineSync(type, [], process);
    const originalItemId = await queueSynchronizationItem(type, defaultMockSyncItem);
    const secondOriginalItemId = await queueSynchronizationItem(type, {
      value: 456,
    });

    const synchronization = runSynchronization();
    const handledSynchronization = synchronization.catch((error: unknown) => error);
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
    expect(getOfflineSynchronizationStore().getState().synchronization?.totalCount).toBe(2);

    setCurrentUser(otherMockUserId);
    expect(getOfflineSynchronizationStore().getState().synchronization).toBeUndefined();
    expect(observedAbortController?.signal.aborted).toBe(true);

    finishProcessing?.();
    await expect(handledSynchronization).resolves.toEqual(
      expect.objectContaining({
        message: offlineQueueOperationUnavailableMessage,
      }),
    );
    expect(process).toHaveBeenCalledTimes(1);

    setCurrentUser(mockUserId);
    expect(await getSynchronizationItem(originalItemId)).toMatchObject({
      id: originalItemId,
      userId: mockUserId,
    });
    expect(await getSynchronizationItem(secondOriginalItemId)).toMatchObject({
      id: secondOriginalItemId,
      userId: mockUserId,
    });
  });

  it('persists only a fixed error when a handler exposes sensitive technical details', async () => {
    const type = 'sanitized-sync-error-item';
    const sensitiveDetails =
      'POST https://clinical.example.test/openmrs/ws/rest/v1/patient/00000000-0000-0000-0000-000000000001 body: Patient Name';
    setupOfflineSync(
      type,
      [],
      vi.fn(async () => Promise.reject(new Error(sensitiveDetails))),
    );
    const id = await queueSynchronizationItem(type, defaultMockSyncItem);

    await expect(runSynchronization()).rejects.toThrow(offlineQueueOperationUnavailableMessage);

    const persistedItem = await new OfflineDb().syncQueue.get(id);
    expect(persistedItem?.lastError).toEqual({
      name: 'OfflineSynchronizationError',
      message: 'Offline synchronization failed.',
    });
    expect(JSON.stringify(persistedItem?.lastError)).not.toContain(sensitiveDetails);
  });
});
