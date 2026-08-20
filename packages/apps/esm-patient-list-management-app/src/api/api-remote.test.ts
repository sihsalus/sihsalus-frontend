import {
  getDynamicOfflineDataEntries,
  putDynamicOfflineData,
  removeDynamicOfflineData,
  syncDynamicOfflineData,
} from '@openmrs/esm-framework';

import { findFakePatientListsWithoutPatient } from './api-remote';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getDynamicOfflineDataEntries: vi.fn(),
  putDynamicOfflineData: vi.fn(),
  removeDynamicOfflineData: vi.fn(),
  syncDynamicOfflineData: vi.fn(),
}));

const mockGetDynamicOfflineDataEntries = vi.mocked(getDynamicOfflineDataEntries);
const mockPutDynamicOfflineData = vi.mocked(putDynamicOfflineData);
const mockRemoveDynamicOfflineData = vi.mocked(removeDynamicOfflineData);
const mockSyncDynamicOfflineData = vi.mocked(syncDynamicOfflineData);
const patientUuid = 'synthetic-patient-uuid';
const translate = ((_key: string, fallback: string) => fallback) as never;
const offlinePatientEntry = {
  identifier: patientUuid,
  type: 'patient',
  users: ['synthetic-user-uuid'],
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

  mockGetDynamicOfflineDataEntries.mockImplementation(async () => (isRegistered ? [offlinePatientEntry] : []) as never);
  mockPutDynamicOfflineData.mockImplementation(async () => {
    isRegistered = true;
  });
  mockRemoveDynamicOfflineData.mockImplementation(async () => {
    isRegistered = false;
  });

  return () => isRegistered;
}

describe('offline patient list', () => {
  beforeEach(() => {
    mockGetDynamicOfflineDataEntries.mockReset();
    mockPutDynamicOfflineData.mockReset();
    mockRemoveDynamicOfflineData.mockReset();
    mockSyncDynamicOfflineData.mockReset();
    setNavigatorLocks();
    mockPutDynamicOfflineData.mockResolvedValue(undefined);
    mockRemoveDynamicOfflineData.mockResolvedValue(undefined);
  });

  afterAll(() => {
    delete (globalThis.navigator as Navigator & { locks?: LockManager }).locks;
  });

  it('removes only a newly-created membership when the first download fails', async () => {
    mockGetDynamicOfflineDataEntries.mockResolvedValue([]);
    mockSyncDynamicOfflineData.mockRejectedValue(new Error('Sanitized offline synchronization failure'));

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);

    await expect(offlineList.addPatient()).rejects.toThrow('Sanitized offline synchronization failure');
    expect(mockPutDynamicOfflineData).toHaveBeenCalledOnce();
    expect(mockPutDynamicOfflineData).toHaveBeenCalledWith('patient', patientUuid);
    expect(mockRemoveDynamicOfflineData).toHaveBeenCalledOnce();
    expect(mockRemoveDynamicOfflineData).toHaveBeenCalledWith('patient', patientUuid);
  });

  it('preserves a membership that already exists when a refresh fails', async () => {
    mockGetDynamicOfflineDataEntries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identifier: patientUuid, type: 'patient', users: ['user-uuid'] }]);
    mockSyncDynamicOfflineData.mockRejectedValue(new Error('Sanitized offline synchronization failure'));

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);

    await expect(offlineList.addPatient()).rejects.toThrow('Sanitized offline synchronization failure');
    expect(mockPutDynamicOfflineData).not.toHaveBeenCalled();
    expect(mockRemoveDynamicOfflineData).not.toHaveBeenCalled();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledWith('patient', patientUuid);
  });

  it('preserves the original sync failure when first-download rollback fails', async () => {
    const syncError = new Error('Sanitized offline synchronization failure');
    const rollbackError = new Error(`Sensitive rollback detail for ${patientUuid}`);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetDynamicOfflineDataEntries.mockResolvedValue([]);
    mockSyncDynamicOfflineData.mockRejectedValue(syncError);
    mockRemoveDynamicOfflineData.mockRejectedValue(rollbackError);

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);

    await expect(offlineList.addPatient()).rejects.toBe(syncError);
    expect(mockRemoveDynamicOfflineData).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      'Failed to roll back an incomplete offline patient registration.',
    );
    expect(consoleError).not.toHaveBeenCalledWith(rollbackError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(patientUuid);

    consoleError.mockRestore();
  });

  it('serializes concurrent first adds so a later success retains the membership after an earlier failure', async () => {
    const firstSync = createDeferred();
    const syncError = new Error('Sanitized offline synchronization failure');
    const isRegistered = mockMembershipState();
    mockSyncDynamicOfflineData.mockImplementationOnce(() => firstSync.promise).mockResolvedValueOnce(undefined);

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);
    const firstAdd = offlineList.addPatient();
    await vi.waitFor(() => expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce());

    const secondAdd = offlineList.addPatient();
    await Promise.resolve();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce();

    firstSync.reject(syncError);

    await expect(firstAdd).rejects.toBe(syncError);
    await expect(secondAdd).resolves.toBeUndefined();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledTimes(2);
    expect(mockPutDynamicOfflineData).toHaveBeenCalledTimes(2);
    expect(mockRemoveDynamicOfflineData).toHaveBeenCalledOnce();
    expect(isRegistered()).toBe(true);
  });

  it('preserves a successful membership when a queued refresh fails', async () => {
    const firstSync = createDeferred();
    const refreshError = new Error('Sanitized offline synchronization failure');
    const isRegistered = mockMembershipState();
    mockSyncDynamicOfflineData.mockImplementationOnce(() => firstSync.promise).mockRejectedValueOnce(refreshError);

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);
    const firstAdd = offlineList.addPatient();
    await vi.waitFor(() => expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce());

    const secondAdd = offlineList.addPatient();
    firstSync.resolve();

    await expect(firstAdd).resolves.toBeUndefined();
    await expect(secondAdd).rejects.toBe(refreshError);
    expect(mockPutDynamicOfflineData).toHaveBeenCalledOnce();
    expect(mockRemoveDynamicOfflineData).not.toHaveBeenCalled();
    expect(isRegistered()).toBe(true);
  });

  it('uses one identifier-free Web Lock for the full membership update', async () => {
    const request = vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation());
    setNavigatorLocks({ request } as unknown as LockManager);
    mockGetDynamicOfflineDataEntries.mockResolvedValue([]);
    mockSyncDynamicOfflineData.mockResolvedValue(undefined);

    const [offlineList] = await findFakePatientListsWithoutPatient(patientUuid, translate);
    await offlineList.addPatient();

    expect(request).toHaveBeenCalledOnce();
    const [lockName] = request.mock.calls[0];
    expect(lockName).toBe('openmrs-offline-patient-membership');
    expect(lockName).not.toContain(patientUuid);
    expect(lockName).not.toContain(offlinePatientEntry.users[0]);
  });
});
