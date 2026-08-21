import { getDynamicOfflineDataEntries, syncDynamicOfflineData } from '@openmrs/esm-framework';

import { syncSelectedOfflinePatients } from './offline-patient-sync';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getDynamicOfflineDataEntries: vi.fn(),
  syncDynamicOfflineData: vi.fn(),
}));

const mockGetDynamicOfflineDataEntries = vi.mocked(getDynamicOfflineDataEntries);
const mockSyncDynamicOfflineData = vi.mocked(syncDynamicOfflineData);

describe('syncSelectedOfflinePatients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDynamicOfflineDataEntries.mockResolvedValue([
      { identifier: 'patient-1', type: 'patient', users: ['user-uuid'] },
      { identifier: 'patient-2', type: 'patient', users: ['user-uuid'] },
    ]);
  });

  it('looks up patient entries and reports selected pending registrations instead of silently skipping them', async () => {
    mockSyncDynamicOfflineData.mockResolvedValue(undefined);

    await expect(syncSelectedOfflinePatients(['patient-1', 'newly-registered-patient'])).resolves.toEqual({
      failedCount: 0,
      skippedCount: 1,
    });

    expect(mockGetDynamicOfflineDataEntries).toHaveBeenCalledWith('patient');
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledOnce();
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledWith('patient', 'patient-1');
  });

  it('reports a failed patient without aborting the rest of the batch and clears the failure on retry', async () => {
    mockSyncDynamicOfflineData.mockImplementation(async (_type, patientUuid) => {
      if (patientUuid === 'patient-2') {
        throw new AggregateError([new Error('cache unavailable')], 'Patient cache failed');
      }
    });

    await expect(syncSelectedOfflinePatients(['patient-1', 'patient-2'])).resolves.toEqual({
      failedCount: 1,
      skippedCount: 0,
    });
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledTimes(2);

    mockSyncDynamicOfflineData.mockResolvedValue(undefined);

    await expect(syncSelectedOfflinePatients(['patient-1', 'patient-2'])).resolves.toEqual({
      failedCount: 0,
      skippedCount: 0,
    });
    expect(mockSyncDynamicOfflineData).toHaveBeenCalledTimes(4);
  });
});
