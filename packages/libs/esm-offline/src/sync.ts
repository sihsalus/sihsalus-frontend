/** @module @category Offline */

import { getLoggedInUser, getSessionStore } from '@openmrs/esm-api';
import { createGlobalStore } from '@openmrs/esm-state';
import Dexie from 'dexie';
import { OfflineDb } from './offline-db';

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
const offlineSynchronizationError = Object.freeze({
  name: 'OfflineSynchronizationError',
  message: 'Offline synchronization failed.',
});
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
    return;
  }

  synchronizationInProgress = true;

  const promises: Record<string, Promise<void>> = {};
  const handlerQueue = Object.entries(handlers);
  const maxIter = handlerQueue.length;
  const results: SyncResultBag = {};
  const abortController = new AbortController();
  let unsubscribeFromSession: (() => void) | undefined;
  let sessionOwnershipLost = false;
  let userId: string | undefined;
  const ownsSession = () => userId !== undefined && !sessionOwnershipLost && isAuthenticatedSessionForUser(userId);
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

          promises[name] = processHandler(handler, results, abortController, notifySyncProgress, userId, ownsSession);
          handlerQueue.splice(i, 1);
        }
      }
    }

    await Promise.allSettled(Object.values(promises));
  } catch {
    throw createOfflineQueueOperationError();
  } finally {
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
) {
  const items: Array<[number, unknown, QueueItemDescriptor]> = [];
  const contents: Array<unknown> = [];

  if (!ownsSession()) {
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

  for (let i = 0; i < items.length; i++) {
    const [key, item, { id, dependencies = [] }] = items[i];

    try {
      if (!ownsSession()) {
        throw createOfflineQueueOperationError();
      }

      const result = await process(item, {
        abort: abortController,
        index: i,
        items: contents,
        userId,
        dependencies: dependencies.map(({ id, type }) => (dependsOn.includes(type) ? results[type][id] : undefined)),
      });

      if (!ownsSession()) {
        throw createOfflineQueueOperationError();
      }

      if (id !== undefined) {
        results[type][id] = result;
      }

      await deleteOwnedSynchronizationItem(userId, key, ownsSession);
    } catch {
      if (ownsSession()) {
        await persistSanitizedSynchronizationError(userId, key, ownsSession);
      }
    } finally {
      notifySyncProgress();
    }
  }
}

async function getUserId() {
  const user = await getLoggedInUser();
  const userId = user?.uuid;

  if (!userId) {
    throw createOfflineQueueOperationError();
  }

  assertSessionOwnedBy(userId);
  return userId;
}

function createOfflineQueueOperationError() {
  return new Error(offlineQueueOperationUnavailableMessage);
}

function isAuthenticatedSessionForUser(userId: string) {
  const sessionState = getSessionStore().getState();
  return sessionState.loaded && sessionState.session.authenticated && sessionState.session.user?.uuid === userId;
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
 */
export async function queueSynchronizationItemFor<T>(
  userId: string,
  type: string,
  content: T,
  descriptor?: QueueItemDescriptor,
) {
  const targetId = descriptor && descriptor.id;

  if (targetId !== undefined) {
    // in case of replacement (i.e., used same ID) we just remove the existing item
    await db.syncQueue
      .where('userId')
      .equals(userId)
      .and((item) => item.type === type && item?.descriptor.id === targetId)
      .delete()
      .catch(Dexie.errnames.DatabaseClosed);
  }

  const id = await db.syncQueue
    .add({
      type,
      content,
      userId,
      descriptor: descriptor || {},
      createdOn: new Date(),
    })
    .catch(Dexie.errnames.DatabaseClosed, () => -1);

  return id;
}

/**
 * Enqueues a new item in the sync queue and associates the item with the currently signed in user.
 * @param type The identifying type of the synchronization item.
 * @param content The actual data to be synchronized.
 * @param descriptor An optional descriptor providing additional metadata about the sync item.
 */
export async function queueSynchronizationItem<T>(type: string, content: T, descriptor?: QueueItemDescriptor) {
  const userId = await getUserId();
  return await queueSynchronizationItemFor(userId, type, content, descriptor);
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

  const items = await (type ? collection.and((item) => item.type === type) : collection)
    .toArray()
    .catch(Dexie.errnames.DatabaseClosed, () => []);

  assertSessionOwnedBy(authenticatedUserId);
  return items.map((item) => sanitizeSynchronizationItem(item as SyncItem<T>));
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
  const item = await getOwnedSynchronizationItemCollection(userId, id)
    .first()
    .catch(Dexie.errnames.DatabaseClosed, () => undefined);

  assertSessionOwnedBy(userId);
  return item ? sanitizeSynchronizationItem(item as SyncItem<T>) : undefined;
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
  const item = await getOwnedSynchronizationItemCollection(userId, id)
    .first()
    .catch(Dexie.errnames.DatabaseClosed, () => undefined);

  if (!item) {
    throw createOfflineQueueOperationError();
  }

  const editCallback = handlers[item.type]?.options.onBeginEditSyncItem;
  if (!editCallback) {
    throw createOfflineQueueOperationError();
  }

  assertSessionOwnedBy(userId);
  editCallback(sanitizeSynchronizationItem(item));
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
