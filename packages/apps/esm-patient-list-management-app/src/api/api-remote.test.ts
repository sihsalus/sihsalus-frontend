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

describe('offline patient list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPutDynamicOfflineData.mockResolvedValue(undefined);
    mockRemoveDynamicOfflineData.mockResolvedValue(undefined);
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
});
