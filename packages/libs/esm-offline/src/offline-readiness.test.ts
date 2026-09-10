import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DynamicOfflineData } from './dynamic-offline-data';
import { getDynamicOfflineDataEntriesFor, getDynamicOfflineDataHandlers } from './dynamic-offline-data';
import { captureOfflineProfile, getOfflineProfileStatus } from './offline-profile';
import { getOfflineReadiness } from './offline-readiness';

vi.mock('./dynamic-offline-data', () => ({
  getDynamicOfflineDataEntriesFor: vi.fn(),
  getDynamicOfflineDataHandlers: vi.fn(),
}));
vi.mock('./offline-profile', () => ({ captureOfflineProfile: vi.fn(), getOfflineProfileStatus: vi.fn() }));
const isSynced = vi.fn(async () => true);
const estimate = vi.fn();
function entry(type: 'patient' | 'form') {
  return {
    type,
    identifier: 'synthetic',
    users: ['owner'],
    syncState: {
      syncedBy: 'owner',
      syncedOn: new Date('2020-01-01T00:00:00Z'),
      succeededHandlers: [type],
      erroredHandlers: [],
      errors: [],
    },
  } satisfies DynamicOfflineData;
}
beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', {
    serviceWorker: { controller: {} },
    locks: { request: vi.fn() },
    storage: { estimate, persisted: async () => true },
  });
  estimate.mockResolvedValue({ quota: 100 * 1024 * 1024, usage: 20 });
  vi.mocked(getOfflineProfileStatus).mockResolvedValue('ready');
  vi.mocked(captureOfflineProfile).mockResolvedValue({
    id: 'profile',
    ownerId: 'owner',
    activeUserId: 'owner',
    generation: 1,
    phase: 'active',
    sessionUrl: 'https://synthetic.test/session',
  });
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([entry('patient'), entry('form')]);
  vi.mocked(getDynamicOfflineDataHandlers).mockReturnValue(
    ['patient', 'form'].map((type) => ({ type, id: type, isSynced, sync: vi.fn() })),
  );
  isSynced.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('verifies the actual downloads, reserve and oldest successful update', async () => {
  expect(await getOfflineReadiness()).toMatchObject({
    ready: true,
    patients: 1,
    forms: 1,
    incomplete: 0,
    persistent: true,
    oldestDownload: new Date('2020-01-01T00:00:00Z'),
  });
  expect(isSynced).toHaveBeenCalledTimes(2);
});
it.each([
  {},
  { quota: 0, usage: 0 },
  { quota: NaN, usage: 0 },
  { quota: 100, usage: -1 },
  { quota: 100, usage: 101 },
])('never treats an invalid estimate as available: %j', async (value) => {
  estimate.mockResolvedValue(value);
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, storage: 'unknown' });
});
it('reports insufficient storage and handles denied storage APIs', async () => {
  estimate.mockResolvedValue({ quota: 100, usage: 90 });
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, storage: 'low' });
  estimate.mockRejectedValue(new Error('denied'));
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, storage: 'unknown' });
});
it('does not read another profile or infer readiness from an enabled preference', async () => {
  vi.mocked(getOfflineProfileStatus).mockResolvedValue('unavailable');
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, patients: 0 });
  expect(getDynamicOfflineDataEntriesFor).not.toHaveBeenCalled();
});
it('requires selected patients and forms, completed handlers and actual cached responses', async () => {
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([]);
  expect((await getOfflineReadiness()).ready).toBe(false);
  const patient: DynamicOfflineData = entry('patient');
  patient.syncState = undefined;
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([patient, entry('form')]);
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, incomplete: 1 });
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([entry('patient'), entry('form')]);
  isSynced.mockRejectedValue(new Error('private response'));
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, incomplete: 2 });
});
it('rejects future timestamps, wrong sync owners and missing handlers', async () => {
  const patient = entry('patient');
  patient.syncState.syncedOn = new Date('2100-01-01');
  const form = entry('form');
  form.syncState.syncedBy = 'other';
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([patient, form]);
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, incomplete: 2 });
  vi.mocked(getDynamicOfflineDataHandlers).mockReturnValue([]);
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, incomplete: 2 });
});
it('finishes with an incomplete result when a handler never settles', async () => {
  vi.useFakeTimers();
  isSynced.mockImplementation(() => new Promise(() => {}));
  const result = getOfflineReadiness();
  await vi.advanceTimersByTimeAsync(10001);
  expect(await result).toMatchObject({ ready: false });
});

it('rejects a readiness result if the profile changes while downloads are checked', async () => {
  const profile = await captureOfflineProfile();
  vi.mocked(captureOfflineProfile)
    .mockResolvedValueOnce(profile)
    .mockResolvedValueOnce({ ...profile, generation: 2 });
  expect(await getOfflineReadiness()).toMatchObject({ ready: false, profile: 'unavailable' });
});

it('treats malformed persisted synchronization metadata as unverified', async () => {
  const malformed = { ...entry('patient'), syncState: { syncedOn: new Date(), syncedBy: 'owner' } };
  vi.mocked(getDynamicOfflineDataEntriesFor).mockResolvedValue([malformed as DynamicOfflineData, entry('form')]);
  expect(await getOfflineReadiness()).toMatchObject({ ready: false });
});
