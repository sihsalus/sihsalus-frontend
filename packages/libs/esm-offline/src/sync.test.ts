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
});

describe('Logged-in user specific functions', () => {
  it('enqueue and return sync items of currently logged-in user', async () => {
    const loggedInUserId = (await getLoggedInUser()).uuid;
    await queueSynchronizationItem(mockSyncItemType, defaultMockSyncItem);
    const queuedItems = await getFullSynchronizationItems(mockSyncItemType);

    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0].userId).toBe(loggedInUserId);
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
    const otherUserItemId = await queueSynchronizationItemFor(otherMockUserId, mockSyncItemType, defaultMockSyncItem);

    const item = await getSynchronizationItem(otherUserItemId);

    expect(item).toBeUndefined();
    await expect(getFullSynchronizationItemsFor(otherMockUserId)).rejects.toThrow(
      offlineQueueOperationUnavailableMessage,
    );
    await expect(getSynchronizationItemsFor(otherMockUserId)).rejects.toThrow(
      offlineQueueOperationUnavailableMessage,
    );

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
    const otherUserItemId = await queueSynchronizationItemFor(otherMockUserId, mockSyncItemType, defaultMockSyncItem);

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
    const otherUserItemId = await queueSynchronizationItemFor(otherMockUserId, type, defaultMockSyncItem);

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
});

describe('runSynchronization', () => {
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
    await queueSynchronizationItemFor(otherMockUserId, type, { value: 2 });
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
    const process = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishProcessing = resolve;
        }),
    );
    setupOfflineSync(type, [], process);
    const originalItemId = await queueSynchronizationItem(type, defaultMockSyncItem);

    const synchronization = runSynchronization();
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
    expect(getOfflineSynchronizationStore().getState().synchronization?.totalCount).toBe(1);

    setCurrentUser(otherMockUserId);
    expect(getOfflineSynchronizationStore().getState().synchronization).toBeUndefined();

    finishProcessing?.();
    await synchronization;

    setCurrentUser(mockUserId);
    expect(await getSynchronizationItem(originalItemId)).toMatchObject({
      id: originalItemId,
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

    await runSynchronization();

    const persistedItem = await new OfflineDb().syncQueue.get(id);
    expect(persistedItem?.lastError).toEqual({
      name: 'OfflineSynchronizationError',
      message: 'Offline synchronization failed.',
    });
    expect(JSON.stringify(persistedItem?.lastError)).not.toContain(sensitiveDetails);
  });
});
