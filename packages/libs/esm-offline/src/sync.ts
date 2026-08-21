/** @module @category Offline */

import { getLoggedInUser, getSessionStore } from '@openmrs/esm-api';
import { createGlobalStore } from '@openmrs/esm-state';
import { OfflineDb } from './offline-db';
import { offlineSynchronizationError } from './synchronization-error';

/**
 * Defines an item queued up in the offline synchronization queue.
 * A `SyncItem` contains both meta information about the item in the sync queue, as well as the
 * actual data to be synchronized (i.e. the item's `content`).
 */
export interface SyncItem<T = any> {
  id?: number;
  userId: string;
  type: string;
  content: T;
  createdOn: Date;
  descriptor: QueueItemDescriptor;
  lastError?: {
    name?: string;
    message?: string;
  };
}

/**
 * Contains information about the sync item which has been provided externally by the caller
 * who added the item to the queue.
 * This information is all optional, but, when provided while enqueuing the item, can be used in other
 * locations to better represent the sync item, e.g. in the UI.
 */
export interface QueueItemDescriptor {
  id?: string;
  dependencies?: Array<{
    id: string;
    type: string;
  }>;
  patientUuid?: string;
  displayName?: string;
}

export interface QueueSynchronizationItemOptions<T> {
  /**
   * Atomically reconciles proposed content with the existing same-descriptor row before replacement.
   * Throwing aborts the replacement and preserves the existing row.
   */
  reconcileContent?: (existingContent: T | undefined, proposedContent: T) => T;
}

/**
 * A function which, when invoked, performs the actual client-server synchronization of the given
 * `item` (which is the actual data to be synchronized).
 * The function receives additional `options` which provide additional data that can be used
 * for synchronizing.
 */
export type ProcessSyncItem<T> = (item: T, options: SyncProcessOptions<T>) => Promise<any>;

/**
 * Additional data which can be used for synchronizing data in a {@link ProcessSyncItem} function.
 */
export interface SyncProcessOptions<T> {
  abort: AbortController;
  userId: string;
  index: number;
  items: Array<T>;
  dependencies: Array<any>;
  /**
   * Atomically replaces this item's content while the same authenticated synchronization still owns it.
   * The updater receives the latest persisted content so concurrent checkpoints cannot overwrite one another.
   * This capability is scoped to the item being processed and fails after cancellation or an owner change.
   */
  updateContent?: (update: (currentContent: T) => T) => Promise<T>;
}

/**
 * Defines additional options which can optionally be provided when setting up a synchronization callback
 * for a specific synchronization item type.
 * These are not required, but, when set, allow further
 */
interface SetupOfflineSyncOptions<T> {
  /**
   * Invoked when the user requests to edit a sync item.
   * The typical behavior for such a callback is to launch a UI which allows editing the content
   * encapsulated by the sync item.
   * @param syncItem The sync item to be edited.
   */
  onBeginEditSyncItem?(syncItem: SyncItem<T>): void;
}

/**
 * Represents a synchronization handler which has been globally registered by the
 * {@link setupOfflineSync} function.
 * These handlers are used for synchronizing queued data.
 */
interface SyncHandler {
  readonly type: string;
  readonly dependsOn: ReadonlyArray<string>;
  readonly process: ProcessSyncItem<unknown>;
  readonly options: Readonly<SetupOfflineSyncOptions<any>>;
}

/**
 * Represents the data inside the global offline synchronization store.
 * Provides information about a currently ongoing synchronization.
 */
export interface OfflineSynchronizationStore {
  synchronization?: {
    totalCount: number;
    pendingCount: number;
    abortController: AbortController;
  };
}

interface SyncResultBag {
  [type: string]: Record<string, any>;
}

const db = new OfflineDb();
const handlers: Record<string, SyncHandler> = {};
const offlineQueueOperationUnavailableMessage = 'Offline queue operation is unavailable.';
let synchronizationInProgress = false;

const syncStore = createGlobalStore<OfflineSynchronizationStore>('offline-synchronization', {});

export function getOfflineSynchronizationStore() {
  return syncStore;
}

/**
 * Runs a full synchronization of all queued synchronization items owned by the authenticated user.
 * Visible counts and progress are limited to the same owner.
 */
export async function runSynchronization() {
  if (synchronizationInProgress) {
    throw createOfflineQueueOperationError();
  }

  synchronizationInProgress = true;

  const promises: Record<string, Promise<void>> = {};
  const handlerQueue = Object.entries(handlers);
  const maxIter = handlerQueue.length;
  const results: SyncResultBag = {};
  const abortController = new AbortController();
  let unsubscribeFromSession: (() => void) | undefined;
  let sessionOwnershipLost = false;
  let synchronizationIncomplete = false;
  let userId: string | undefined;
  const ownsSession = () => userId !== undefined && !sessionOwnershipLost && isAuthenticatedSessionForUser(userId);
  const markSynchronizationIncomplete = () => {
    synchronizationIncomplete = true;
  };
  const handleAbort = () => markSynchronizationIncomplete();
  abortController.signal.addEventListener('abort', handleAbort, { once: true });
  const notifySyncProgress = () => {
    if (!ownsSession()) {
      abortController.abort();
      syncStore.setState({ synchronization: undefined });
      return;
    }

    const synchronization = syncStore.getState().synchronization;
    if (!synchronization) {
      return;
    }

    syncStore.setState({
      synchronization: {
        ...synchronization,
        pendingCount: Math.max(0, synchronization.pendingCount - 1),
      },
    });
  };

  try {
    userId = await getUserId();
    const sessionStore = getSessionStore();
    const handleSessionChange = () => {
      if (!userId || isAuthenticatedSessionForUser(userId)) {
        return;
      }

      sessionOwnershipLost = true;
      markSynchronizationIncomplete();
      abortController.abort();
      syncStore.setState({ synchronization: undefined });
    };

    unsubscribeFromSession = sessionStore.subscribe(handleSessionChange);
    handleSessionChange();

    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    const totalCount = await db.syncQueue.where('userId').equals(userId).count();
    assertSessionOwnedBy(userId);

    syncStore.setState({
      synchronization: {
        totalCount,
        pendingCount: totalCount,
        abortController,
      },
    });

    // we try until the queue is depleted, but no more than queue.length tries.
    for (let iter = 0; iter < maxIter && handlerQueue.length > 0; iter++) {
      for (let i = handlerQueue.length; i--; ) {
        const [name, handler] = handlerQueue[i];
        const deps = handler.dependsOn.map((dep) => promises[dep]);

        if (deps.every(Boolean)) {
          results[name] = {};
          await Promise.all(deps);

          promises[name] = processHandler(
            handler,
            results,
            abortController,
            notifySyncProgress,
            userId,
            ownsSession,
            markSynchronizationIncomplete,
          );
          handlerQueue.splice(i, 1);
        }
      }
    }

    const handlerResults = await Promise.allSettled(Object.values(promises));
    if (handlerResults.some((result) => result.status === 'rejected')) {
      markSynchronizationIncomplete();
    }

    if (ownsSession()) {
      const remainingCount = await db.syncQueue.where('userId').equals(userId).count();
      assertSessionOwnedBy(userId);
      if (remainingCount > 0) {
        markSynchronizationIncomplete();
      }
    }

    if (synchronizationIncomplete || sessionOwnershipLost || abortController.signal.aborted) {
      throw createOfflineQueueOperationError();
    }
  } catch {
    throw createOfflineQueueOperationError();
  } finally {
    abortController.signal.removeEventListener('abort', handleAbort);
    unsubscribeFromSession?.();
    synchronizationInProgress = false;
    syncStore.setState({ synchronization: undefined });
  }
}

async function processHandler(
  { type, dependsOn, process }: SyncHandler,
  results: SyncResultBag,
  abortController: AbortController,
  notifySyncProgress: () => void,
  userId: string,
  ownsSession: () => boolean,
  markSynchronizationIncomplete: () => void,
) {
  const items: Array<[number, unknown, QueueItemDescriptor]> = [];
  const contents: Array<unknown> = [];
  const ownsActiveSynchronization = () => !abortController.signal.aborted && ownsSession();

  try {
    if (!ownsActiveSynchronization()) {
      throw createOfflineQueueOperationError();
    }

    await db.syncQueue
      .where('userId')
      .equals(userId)
      .and((item) => item.type === type)
      .each((item, cursor) => {
        items.push([cursor.primaryKey, item.content, item.descriptor]);
        contents.push(item.content);
      });
  } catch {
    markSynchronizationIncomplete();
    return;
  }

  for (let i = 0; i < items.length; i++) {
    if (!ownsActiveSynchronization()) {
      markSynchronizationIncomplete();
      break;
    }

    const [key, item, { id, dependencies = [] }] = items[i];

    try {
      if (!ownsActiveSynchronization()) {
        throw createOfflineQueueOperationError();
      }

      const result = await process(item, {
        abort: abortController,
        index: i,
        items: contents,
        userId,
        dependencies: dependencies.map(({ id, type }) => (dependsOn.includes(type) ? results[type][id] : undefined)),
        async updateContent(update) {
          try {
            const updatedContent = await updateOwnedSynchronizationItemContent(
              userId,
              key,
              update,
              ownsActiveSynchronization,
            );
            items[i][1] = updatedContent;
            contents[i] = updatedContent;
            return updatedContent;
          } catch {
            throw createOfflineQueueOperationError();
          }
        },
      });

      if (!ownsActiveSynchronization()) {
        throw createOfflineQueueOperationError();
      }

      if (id !== undefined) {
        results[type][id] = result;
      }

      await deleteOwnedSynchronizationItem(userId, key, ownsActiveSynchronization);
    } catch {
      markSynchronizationIncomplete();
      if (ownsActiveSynchronization()) {
        try {
          await persistSanitizedSynchronizationError(userId, key, ownsActiveSynchronization);
        } catch {
          markSynchronizationIncomplete();
        }
      }
    } finally {
      notifySyncProgress();
    }
  }
}

async function getUserId() {
  try {
    const user = await getLoggedInUser();
    const userId = user?.uuid;

    if (!userId) {
      throw createOfflineQueueOperationError();
    }

    assertSessionOwnedBy(userId);
    return userId;
  } catch {
    throw createOfflineQueueOperationError();
  }
}

function createOfflineQueueOperationError() {
  return new Error(offlineQueueOperationUnavailableMessage);
}

function isAuthenticatedSessionForUser(userId: string) {
  try {
    const sessionState = getSessionStore().getState();
    return sessionState.loaded && sessionState.session.authenticated && sessionState.session.user?.uuid === userId;
  } catch {
    return false;
  }
}

function assertSessionOwnedBy(userId: string) {
  if (!isAuthenticatedSessionForUser(userId)) {
    throw createOfflineQueueOperationError();
  }
}

function getOwnedSynchronizationItemCollection(userId: string, id: number) {
  return db.syncQueue
    .where('userId')
    .equals(userId)
    .and((item) => item.id === id);
}

function sanitizeSynchronizationItem<T>(item: SyncItem<T>): SyncItem<T> {
  return item.lastError
    ? {
        ...item,
        lastError: offlineSynchronizationError,
      }
    : item;
}

async function deleteOwnedSynchronizationItem(userId: string, id: number, ownsSession: () => boolean) {
  await db.transaction('rw', db.syncQueue, async () => {
    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    const deletedCount = await getOwnedSynchronizationItemCollection(userId, id).delete();
    if (!ownsSession() || deletedCount !== 1) {
      throw createOfflineQueueOperationError();
    }
  });
}

async function updateOwnedSynchronizationItemContent<T>(
  userId: string,
  id: number,
  update: (currentContent: T) => T,
  ownsSession: () => boolean,
): Promise<T> {
  return await db.transaction('rw', db.syncQueue, async () => {
    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    const collection = getOwnedSynchronizationItemCollection(userId, id);
    const currentItem = (await collection.first()) as SyncItem<T> | undefined;
    if (!currentItem || !ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    const updatedContent = update(currentItem.content);
    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    const updatedCount = await collection.modify({ content: updatedContent });
    if (!ownsSession() || updatedCount !== 1) {
      throw createOfflineQueueOperationError();
    }

    return updatedContent;
  });
}

async function persistSanitizedSynchronizationError(userId: string, id: number, ownsSession: () => boolean) {
  await db.transaction('rw', db.syncQueue, async () => {
    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }

    await getOwnedSynchronizationItemCollection(userId, id).modify({
      lastError: offlineSynchronizationError,
    });

    if (!ownsSession()) {
      throw createOfflineQueueOperationError();
    }
  });
}

/**
 * Enqueues a new item in the sync queue for a specific user.
 * @param userId The user with whom the sync item should be associated with.
 * @param type The identifying type of the synchronization item.
 * @param content The actual data to be synchronized.
 * @param descriptor An optional descriptor providing additional metadata about the sync item.
 * @param options Optional atomic replacement reconciliation.
 */
export async function queueSynchronizationItemFor<T>(
  userId: string,
  type: string,
  content: T,
  descriptor?: QueueItemDescriptor,
  options: QueueSynchronizationItemOptions<T> = {},
) {
  const authenticatedUserId = await getUserId();
  if (userId !== authenticatedUserId) {
    throw createOfflineQueueOperationError();
  }

  const targetId = descriptor && descriptor.id;

  try {
    return await db.transaction('rw', db.syncQueue, async () => {
      assertSessionOwnedBy(authenticatedUserId);

      let contentToQueue = content;

      if (targetId !== undefined) {
        const existingItems = (await db.syncQueue
          .where('userId')
          .equals(authenticatedUserId)
          .and((item) => item.type === type && item.descriptor?.id === targetId)
          .toArray()) as Array<SyncItem<T>>;
        if (options.reconcileContent && existingItems.length > 1) {
          throw createOfflineQueueOperationError();
        }
        contentToQueue = options.reconcileContent?.(existingItems[0]?.content, content) ?? content;

        // In case of replacement (i.e., the same descriptor ID), remove the existing
        // item in the same transaction so a failed add cannot discard pending data.
        await db.syncQueue
          .where('userId')
          .equals(authenticatedUserId)
          .and((item) => item.type === type && item.descriptor?.id === targetId)
          .delete();
      }

      const id = await db.syncQueue.add({
        type,
        content: contentToQueue,
        userId: authenticatedUserId,
        descriptor: descriptor || {},
        createdOn: new Date(),
      });

      assertSessionOwnedBy(authenticatedUserId);
      return id;
    });
  } catch {
    throw createOfflineQueueOperationError();
  }
}

/**
 * Enqueues a new item in the sync queue and associates the item with the currently signed in user.
 * @param type The identifying type of the synchronization item.
 * @param content The actual data to be synchronized.
 * @param descriptor An optional descriptor providing additional metadata about the sync item.
 * @param options Optional atomic replacement reconciliation.
 */
export async function queueSynchronizationItem<T>(
  type: string,
  content: T,
  descriptor?: QueueItemDescriptor,
  options?: QueueSynchronizationItemOptions<T>,
) {
  const userId = await getUserId();
  return await queueSynchronizationItemFor(userId, type, content, descriptor, options);
}

/**
 * Returns the content of all currently queued up sync items of the authenticated user.
 * @param userId The authenticated user's ID. Requests for any other user fail closed.
 * @param type The identifying type of the synchronization items to be returned..
 */
export async function getSynchronizationItemsFor<T>(userId: string, type?: string) {
  const fullItems = await getFullSynchronizationItemsFor<T>(userId, type);
  return fullItems.map((item) => item.content);
}

/**
 * Returns all currently queued up sync items of the authenticated user.
 * @param userId The authenticated user's ID. Requests for any other user fail closed.
 * @param type The identifying type of the synchronization items to be returned..
 */
export async function getFullSynchronizationItemsFor<T>(userId: string, type?: string): Promise<Array<SyncItem<T>>> {
  const authenticatedUserId = await getUserId();
  if (userId !== authenticatedUserId) {
    throw createOfflineQueueOperationError();
  }

  const collection = db.syncQueue.where('userId').equals(userId);

  let items: Array<SyncItem<T>>;
  try {
    items = (await (type ? collection.and((item) => item.type === type) : collection).toArray()) as Array<SyncItem<T>>;
  } catch {
    throw createOfflineQueueOperationError();
  }

  assertSessionOwnedBy(authenticatedUserId);
  return items.map((item) => sanitizeSynchronizationItem(item));
}

/**
 * Returns the content of all currently queued up sync items of the currently signed in user.
 * @param type The identifying type of the synchronization items to be returned.
 */
export async function getSynchronizationItems<T>(type?: string) {
  const userId = await getUserId();
  return await getSynchronizationItemsFor<T>(userId, type);
}

/**
 * Returns all currently queued up sync items of the currently signed in user.
 * @param type The identifying type of the synchronization items to be returned.
 */
export async function getFullSynchronizationItems<T>(type?: string) {
  const userId = await getUserId();
  return await getFullSynchronizationItemsFor<T>(userId, type);
}

/**
 * Returns an authenticated user's queued sync item with the given ID, or `undefined` if no accessible item exists.
 * @param id The ID of the requested sync item.
 */
export async function getSynchronizationItem<T = any>(id: number): Promise<SyncItem<T> | undefined> {
  const userId = await getUserId();
  let item: SyncItem<T> | undefined;
  try {
    item = (await getOwnedSynchronizationItemCollection(userId, id).first()) as SyncItem<T> | undefined;
  } catch {
    throw createOfflineQueueOperationError();
  }

  assertSessionOwnedBy(userId);
  return item ? sanitizeSynchronizationItem(item) : undefined;
}

/**
 * Returns whether editing synchronization items of the given type is supported by the currently
 * registered synchronization handlers.
 * @param type The identifying type of the synchronization item which should be edited.
 */
export function canBeginEditSynchronizationItemsOfType(type: string) {
  // Editing an item can be requested as long as callback for this flow exists on the associated handler.
  return !!handlers[type]?.options.onBeginEditSyncItem;
}

/**
 * Triggers an edit flow for the given synchronization item.
 * If this is not possible, throws an error.
 * @param id The ID of the synchronization item to be edited.
 */
export async function beginEditSynchronizationItem(id: number) {
  const userId = await getUserId();
  let item: SyncItem | undefined;
  try {
    item = await getOwnedSynchronizationItemCollection(userId, id).first();
  } catch {
    throw createOfflineQueueOperationError();
  }

  if (!item) {
    throw createOfflineQueueOperationError();
  }

  const editCallback = handlers[item.type]?.options.onBeginEditSyncItem;
  if (!editCallback) {
    throw createOfflineQueueOperationError();
  }

  assertSessionOwnedBy(userId);
  try {
    editCallback(sanitizeSynchronizationItem(item));
  } catch {
    throw createOfflineQueueOperationError();
  }
}

/**
 * Deletes an authenticated user's queued sync item with the given ID.
 * @param id The ID of the synchronization item to be deleted.
 */
export async function deleteSynchronizationItem(id: number) {
  const userId = await getUserId();

  try {
    await deleteOwnedSynchronizationItem(userId, id, () => isAuthenticatedSessionForUser(userId));
  } catch {
    throw createOfflineQueueOperationError();
  }
}

/**
 * Registers a new synchronization handler which is able to synchronize data of a specific type.
 * @param type The identifying type of the synchronization items which can be handled by this handler.
 * @param dependsOn An array of other sync item types which must be synchronized before this handler
 *   can synchronize its own data. Items of these types are effectively dependencies of the data
 *   synchronized by this handler.
 * @param process A function which, when invoked, performs the actual client-server synchronization of the given
 *   `item` (which is the actual data to be synchronized).
 * @param options Additional options which can optionally be provided when setting up a synchronization callback
 *   for a specific synchronization item type.
 */
export function setupOfflineSync<T>(
  type: string,
  dependsOn: Array<string>,
  process: ProcessSyncItem<T>,
  options: SetupOfflineSyncOptions<T> = {},
) {
  handlers[type] = {
    type,
    dependsOn,
    process: process as ProcessSyncItem<unknown>,
    options,
  };
}
