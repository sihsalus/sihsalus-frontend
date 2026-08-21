import {
  showSnackbar,
  subscribePrecacheStaticDependencies,
  syncAllDynamicOfflineData,
  syncDynamicOfflineData,
} from '@openmrs/esm-framework';

import {
  getDynamicFormDataEntriesFor,
  putDynamicFormDataEntryFor,
  removeDynamicFormDataEntryFor,
} from './offline-form-helpers';
import { updateOfflineFormAvailability } from './offline-form-membership';
import { setupOfflineFormPrecache } from './offline-form-precache';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  subscribePrecacheStaticDependencies: vi.fn(),
  syncAllDynamicOfflineData: vi.fn(),
  syncDynamicOfflineData: vi.fn(),
}));

vi.mock('./offline-form-helpers', () => ({
  getDynamicFormDataEntriesFor: vi.fn(),
  putDynamicFormDataEntryFor: vi.fn(),
  removeDynamicFormDataEntryFor: vi.fn(),
}));

const mockGetDynamicFormDataEntriesFor = vi.mocked(getDynamicFormDataEntriesFor);
const mockPutDynamicFormDataEntryFor = vi.mocked(putDynamicFormDataEntryFor);
const mockRemoveDynamicFormDataEntryFor = vi.mocked(removeDynamicFormDataEntryFor);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockSubscribePrecacheStaticDependencies = vi.mocked(subscribePrecacheStaticDependencies);
const mockSyncAllDynamicOfflineData = vi.mocked(syncAllDynamicOfflineData);
const mockSyncDynamicOfflineData = vi.mocked(syncDynamicOfflineData);
const userId = 'synthetic-user-uuid';
const formUuid = 'synthetic-form-uuid';

function setNavigatorLocks(lockManager?: LockManager) {
  Object.defineProperty(globalThis.navigator, 'locks', {
    configurable: true,
    value: lockManager,
  });
}

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function mockMembershipState(initiallyRegistered: boolean) {
  let isRegistered = initiallyRegistered;

  mockGetDynamicFormDataEntriesFor.mockImplementation(async () =>
    isRegistered ? ([{ identifier: formUuid, type: 'form', users: [userId] }] as never) : [],
  );
  mockPutDynamicFormDataEntryFor.mockImplementation(async () => {
    isRegistered = true;
  });
  mockRemoveDynamicFormDataEntryFor.mockImplementation(async () => {
    isRegistered = false;
  });

  return {
    get: () => isRegistered,
    set: (value: boolean) => {
      isRegistered = value;
    },
  };
}

function runBackgroundPrecache() {
  setupOfflineFormPrecache();
  const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];

  if (!callback) {
    throw new Error('The background form precache callback was not registered.');
  }

  expect(callback({})).toBeUndefined();
}

describe('offline form precache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorLocks();
    mockPutDynamicFormDataEntryFor.mockResolvedValue(undefined);
    mockRemoveDynamicFormDataEntryFor.mockResolvedValue(undefined);
    mockSyncAllDynamicOfflineData.mockResolvedValue(undefined);
    mockSyncDynamicOfflineData.mockResolvedValue(undefined);
  });

  afterAll(() => {
    delete (globalThis.navigator as Navigator & { locks?: LockManager }).locks;
  });

  it('finishes a snapshotted background refresh before removing membership', async () => {
    const membership = mockMembershipState(true);
    const backgroundRelease = createDeferred();
    const backgroundStarted = createDeferred();
    const backgroundFinished = createDeferred();
    mockSyncAllDynamicOfflineData.mockImplementation(async () => {
      // Model the core batch snapshot followed by syncDynamicOfflineData's implicit membership put.
      const wasRegisteredAtSnapshot = membership.get();
      backgroundStarted.resolve();
      await backgroundRelease.promise;
      if (wasRegisteredAtSnapshot) {
        membership.set(true);
      }
      backgroundFinished.resolve();
    });

    runBackgroundPrecache();
    await backgroundStarted.promise;

    const removal = updateOfflineFormAvailability(userId, formUuid, false);
    await Promise.resolve();
    expect(mockRemoveDynamicFormDataEntryFor).not.toHaveBeenCalled();

    backgroundRelease.resolve();
    await backgroundFinished.promise;
    await expect(removal).resolves.toBeUndefined();

    expect(mockRemoveDynamicFormDataEntryFor).toHaveBeenCalledWith(userId, formUuid);
    expect(membership.get()).toBe(false);
  });

  it('takes the background snapshot after a failed first-add rollback', async () => {
    const membership = mockMembershipState(false);
    const firstSync = createDeferred();
    const backgroundRelease = createDeferred();
    const backgroundStarted = createDeferred();
    const backgroundFinished = createDeferred();
    let backgroundSnapshotWasRegistered: boolean | undefined;
    mockSyncDynamicOfflineData.mockImplementation(() => firstSync.promise);
    mockSyncAllDynamicOfflineData.mockImplementation(async () => {
      // Model the core batch snapshot followed by syncDynamicOfflineData's implicit membership put.
      backgroundSnapshotWasRegistered = membership.get();
      backgroundStarted.resolve();
      await backgroundRelease.promise;
      if (backgroundSnapshotWasRegistered) {
        membership.set(true);
      }
      backgroundFinished.resolve();
    });

    const firstAdd = updateOfflineFormAvailability(userId, formUuid, true);
    await vi.waitFor(() => expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce());
    expect(membership.get()).toBe(true);

    runBackgroundPrecache();
    await Promise.resolve();
    expect(mockSyncAllDynamicOfflineData).not.toHaveBeenCalled();

    firstSync.reject(new Error(`Failed to cache ${formUuid} for ${userId}`));
    await expect(firstAdd).rejects.toThrow('Offline form availability could not be changed.');
    expect(membership.get()).toBe(false);

    await backgroundStarted.promise;
    expect(backgroundSnapshotWasRegistered).toBe(false);
    backgroundRelease.resolve();
    await backgroundFinished.promise;
    expect(membership.get()).toBe(false);
  });

  it('keeps an existing membership after a successful background refresh', async () => {
    const membership = mockMembershipState(true);
    const request = vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation());
    setNavigatorLocks({ request } as unknown as LockManager);

    runBackgroundPrecache();

    await vi.waitFor(() => expect(mockSyncAllDynamicOfflineData).toHaveBeenCalledWith('form'));
    expect(request).toHaveBeenCalledOnce();
    const [lockName] = request.mock.calls[0];
    expect(lockName).toBe('openmrs-offline-form-membership');
    expect(lockName).not.toContain(formUuid);
    expect(lockName).not.toContain(userId);
    expect(membership.get()).toBe(true);
    expect(mockPutDynamicFormDataEntryFor).not.toHaveBeenCalled();
    expect(mockRemoveDynamicFormDataEntryFor).not.toHaveBeenCalled();
  });

  it('consumes a failed background refresh and shows PHI-safe feedback', async () => {
    mockMembershipState(true);
    mockSyncAllDynamicOfflineData.mockRejectedValue(
      new Error('Failed to synchronize form 1d4d5545-9ee7-43a2-9161-6a48cc219111'),
    );

    runBackgroundPrecache();

    await vi.waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Offline forms could not be refreshed',
        subtitle: 'Some previously downloaded forms may be out of date. Please try again when online.',
      });
    });
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('1d4d5545-9ee7-43a2-9161-6a48cc219111');

    await expect(updateOfflineFormAvailability(userId, formUuid, false)).resolves.toBeUndefined();
    expect(mockRemoveDynamicFormDataEntryFor).toHaveBeenCalledWith(userId, formUuid);
  });
});
