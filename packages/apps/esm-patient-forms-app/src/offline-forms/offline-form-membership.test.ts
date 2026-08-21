import { syncDynamicOfflineData } from '@openmrs/esm-framework';

import {
  getDynamicFormDataEntriesFor,
  putDynamicFormDataEntryFor,
  removeDynamicFormDataEntryFor,
} from './offline-form-helpers';
import { updateOfflineFormAvailability } from './offline-form-membership';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
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
const mockSyncDynamicOfflineData = vi.mocked(syncDynamicOfflineData);
const userId = 'synthetic-user-uuid';
const formUuid = 'synthetic-form-uuid';
const fixedErrorMessage = 'Offline form availability could not be changed.';
const offlineFormEntry = {
  identifier: formUuid,
  type: 'form',
  users: [userId],
};

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

function mockMembershipState(initiallyRegistered = false) {
  let isRegistered = initiallyRegistered;

  mockGetDynamicFormDataEntriesFor.mockImplementation(async () => (isRegistered ? [offlineFormEntry] : []) as never);
  mockPutDynamicFormDataEntryFor.mockImplementation(async () => {
    isRegistered = true;
  });
  mockRemoveDynamicFormDataEntryFor.mockImplementation(async () => {
    isRegistered = false;
  });

  return () => isRegistered;
}

describe('offline form membership', () => {
  beforeEach(() => {
    mockGetDynamicFormDataEntriesFor.mockReset();
    mockPutDynamicFormDataEntryFor.mockReset();
    mockRemoveDynamicFormDataEntryFor.mockReset();
    mockSyncDynamicOfflineData.mockReset();
    setNavigatorLocks();
    mockPutDynamicFormDataEntryFor.mockResolvedValue(undefined);
    mockRemoveDynamicFormDataEntryFor.mockResolvedValue(undefined);
  });

  afterAll(() => {
    delete (globalThis.navigator as Navigator & { locks?: LockManager }).locks;
  });

  it('serializes concurrent first adds so a later success retains membership after an earlier failure', async () => {
    const firstSync = createDeferred();
    const sensitiveSyncError = new Error(`Failed to cache ${formUuid} for ${userId}`);
    const isRegistered = mockMembershipState();
    mockSyncDynamicOfflineData.mockImplementationOnce(() => firstSync.promise).mockResolvedValueOnce(undefined);

    const firstAdd = updateOfflineFormAvailability(userId, formUuid, true);
    const firstOutcome = firstAdd.then(
      () => ({ status: 'fulfilled' as const, error: undefined }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await vi.waitFor(() => expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce());

    const secondAdd = updateOfflineFormAvailability(userId, formUuid, true);
    await Promise.resolve();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce();

    firstSync.reject(sensitiveSyncError);

    const firstResult = await firstOutcome;
    expect(firstResult).toEqual({
      status: 'rejected',
      error: new Error(fixedErrorMessage),
    });
    expect(String(firstResult.error)).not.toContain(formUuid);
    await expect(secondAdd).resolves.toBeUndefined();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledTimes(2);
    expect(mockPutDynamicFormDataEntryFor).toHaveBeenCalledTimes(2);
    expect(mockRemoveDynamicFormDataEntryFor).toHaveBeenCalledOnce();
    expect(isRegistered()).toBe(true);
  });

  it('preserves existing membership when a refresh fails', async () => {
    const isRegistered = mockMembershipState(true);
    mockSyncDynamicOfflineData.mockRejectedValue(new Error(`Failed to refresh ${formUuid} for ${userId}`));

    await expect(updateOfflineFormAvailability(userId, formUuid, true)).rejects.toThrow(fixedErrorMessage);
    expect(mockPutDynamicFormDataEntryFor).not.toHaveBeenCalled();
    expect(mockRemoveDynamicFormDataEntryFor).not.toHaveBeenCalled();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledWith('form', formUuid);
    expect(isRegistered()).toBe(true);
  });

  it('preserves the fixed error when first-add rollback fails without exposing identifiers', async () => {
    const sensitiveSyncError = new Error(`Cache failure for ${formUuid} and ${userId}`);
    const sensitiveRollbackError = new Error(`Database failure for ${formUuid} and ${userId}`);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetDynamicFormDataEntriesFor.mockResolvedValue([]);
    mockSyncDynamicOfflineData.mockRejectedValue(sensitiveSyncError);
    mockRemoveDynamicFormDataEntryFor.mockRejectedValue(sensitiveRollbackError);

    const outcome = await updateOfflineFormAvailability(userId, formUuid, true).then(
      () => ({ status: 'fulfilled' as const, error: undefined }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );

    expect(outcome).toEqual({
      status: 'rejected',
      error: new Error(fixedErrorMessage),
    });
    expect(JSON.stringify(outcome)).not.toContain(formUuid);
    expect(JSON.stringify(outcome)).not.toContain(userId);
    expect(mockRemoveDynamicFormDataEntryFor).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      'Failed to roll back an incomplete offline form registration.',
    );
    expect(consoleError).not.toHaveBeenCalledWith(sensitiveRollbackError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(formUuid);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(userId);

    consoleError.mockRestore();
  });

  it('releases the same-page queue after a failed operation', async () => {
    mockGetDynamicFormDataEntriesFor
      .mockRejectedValueOnce(new Error(`Database failure for ${formUuid} and ${userId}`))
      .mockResolvedValueOnce([]);
    mockSyncDynamicOfflineData.mockResolvedValue(undefined);

    await expect(updateOfflineFormAvailability(userId, formUuid, true)).rejects.toThrow(fixedErrorMessage);
    await expect(updateOfflineFormAvailability(userId, formUuid, true)).resolves.toBeUndefined();

    expect(mockGetDynamicFormDataEntriesFor).toHaveBeenCalledTimes(2);
    expect(mockPutDynamicFormDataEntryFor).toHaveBeenCalledOnce();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce();
  });

  it('uses one identifier-free Web Lock for the full membership update', async () => {
    const request = vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation());
    setNavigatorLocks({ request } as unknown as LockManager);
    mockGetDynamicFormDataEntriesFor.mockResolvedValue([]);
    mockSyncDynamicOfflineData.mockResolvedValue(undefined);

    await updateOfflineFormAvailability(userId, formUuid, true);

    expect(request).toHaveBeenCalledOnce();
    const [lockName] = request.mock.calls[0];
    expect(lockName).toBe('openmrs-offline-form-membership');
    expect(lockName).not.toContain(formUuid);
    expect(lockName).not.toContain(userId);
    expect(mockGetDynamicFormDataEntriesFor).toHaveBeenCalledBefore(mockPutDynamicFormDataEntryFor);
    expect(mockPutDynamicFormDataEntryFor).toHaveBeenCalledBefore(mockSyncDynamicOfflineData);
  });
});
