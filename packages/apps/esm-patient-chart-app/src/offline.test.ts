import { saveVisit, setupOfflineSync, type SyncProcessOptions } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  type OfflineVisit,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
  visitSyncType,
} from '@openmrs/esm-patient-common-lib';

import { setupOfflineVisitsSync } from './offline';

const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockSaveVisit = vi.mocked(saveVisit);
const mockSetupOfflineSync = vi.mocked(setupOfflineSync);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  messageOmrsServiceWorker: vi.fn(),
  saveVisit: vi.fn(),
  setupOfflineSync: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

const offlineVisit: OfflineVisit = {
  uuid: 'offline-visit-uuid',
  patient: 'patient-uuid',
  location: 'location-uuid',
  visitType: 'offline-visit-type-uuid',
  startDatetime: new Date('2026-08-12T10:00:00.000-05:00'),
};

function getRegisteredVisitSyncHandler() {
  setupOfflineVisitsSync();
  expect(mockSetupOfflineSync).toHaveBeenCalledWith(visitSyncType, ['patient-registration'], expect.any(Function));
  return mockSetupOfflineSync.mock.calls[0][2] as (
    visit: OfflineVisit,
    options: SyncProcessOptions<OfflineVisit>,
  ) => Promise<unknown>;
}

function getSyncOptions(visit: OfflineVisit): SyncProcessOptions<OfflineVisit> {
  return {
    abort: new AbortController(),
    dependencies: [],
    index: 0,
    items: [visit],
    userId: 'user-uuid',
  };
}

describe('setupOfflineVisitsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockSaveVisit.mockResolvedValue({
      data: { uuid: 'server-visit-uuid' },
      ok: true,
    } as Awaited<ReturnType<typeof saveVisit>>);
  });

  it('fresh-checks a living patient immediately before synchronizing the visit', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const options = getSyncOptions(offlineVisit);

    await handler(offlineVisit, options);

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith(offlineVisit.patient);
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveVisit.mock.invocationCallOrder[0],
    );
    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        ...offlineVisit,
        stopDatetime: expect.any(Date),
      }),
      options.abort,
    );
  });

  it('keeps the item pending and performs no write when the patient is deceased', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const error = Object.assign(new Error('deceased patient'), { code: DECEASED_PATIENT_OPERATION_BLOCKED });
    mockAssertFreshPatientIsAlive.mockRejectedValue(error);

    await expect(handler(offlineVisit, getSyncOptions(offlineVisit))).rejects.toBe(error);

    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('keeps the item pending and performs no write when the authoritative lookup is unavailable', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const error = new TypeError('network unavailable');
    mockAssertFreshPatientIsAlive.mockRejectedValue(error);

    await expect(handler(offlineVisit, getSyncOptions(offlineVisit))).rejects.toBe(error);

    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('keeps the item pending and performs no write for an incomplete patient representation', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const error = Object.assign(new Error('vital status unavailable'), { code: PATIENT_VITAL_STATUS_UNAVAILABLE });
    mockAssertFreshPatientIsAlive.mockRejectedValue(error);

    await expect(handler(offlineVisit, getSyncOptions(offlineVisit))).rejects.toBe(error);

    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('does not trust the living snapshot that originally allowed the offline visit to be queued', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const visitQueuedFromLivingSnapshot = { ...offlineVisit };
    const error = Object.assign(new Error('patient died after the offline snapshot was cached'), {
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
    mockAssertFreshPatientIsAlive.mockRejectedValue(error);

    await expect(handler(visitQueuedFromLivingSnapshot, getSyncOptions(visitQueuedFromLivingSnapshot))).rejects.toBe(
      error,
    );

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith(visitQueuedFromLivingSnapshot.patient);
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('rechecks a preserved item on retry instead of reusing the prior failed result', async () => {
    const handler = getRegisteredVisitSyncHandler();
    const unavailableError = Object.assign(new Error('vital status unavailable'), {
      code: PATIENT_VITAL_STATUS_UNAVAILABLE,
    });
    mockAssertFreshPatientIsAlive
      .mockRejectedValueOnce(unavailableError)
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false });

    await expect(handler(offlineVisit, getSyncOptions(offlineVisit))).rejects.toBe(unavailableError);
    expect(mockSaveVisit).not.toHaveBeenCalled();

    await handler(offlineVisit, getSyncOptions(offlineVisit));

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
    expect(mockSaveVisit).toHaveBeenCalledOnce();
  });
});
