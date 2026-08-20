import { getSynchronizationItems, queueSynchronizationItem, useVisit, type Visit } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';

import { offlineVisitToVisit, useAutoCreatedOfflineVisit, useVisitOrOfflineVisit } from './visit';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useVisit: vi.fn(),
  useSession: vi.fn(() => ({ sessionLocation: { uuid: 'location-uuid' } })),
  getSynchronizationItems: vi.fn(async () => []),
  queueSynchronizationItem: vi.fn(async () => 1),
}));

const mockGetSynchronizationItems = vi.mocked(getSynchronizationItems);
const mockQueueSynchronizationItem = vi.mocked(queueSynchronizationItem);
const mockUseVisit = vi.mocked(useVisit);

function visitReturnValue(overrides: Partial<ReturnType<typeof useVisit>>): ReturnType<typeof useVisit> {
  return {
    activeVisit: null,
    currentVisit: null,
    currentVisitIsRetrospective: false,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...overrides,
  };
}

describe('useVisitOrOfflineVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression test: in framework 9.x, useVisit().currentVisit is only populated from
  // the visit context store, so it stays null for regular active visits unless the
  // store was explicitly pointed at the patient. Consumers of this hook must still
  // detect the active visit (e.g., to save vitals or place orders).
  it('falls back to the active visit when no visit context is set', () => {
    const activeVisit = { uuid: 'active-visit-uuid', stopDatetime: null } as Visit;
    mockUseVisit.mockReturnValue(visitReturnValue({ activeVisit }));

    const { result } = renderHook(() => useVisitOrOfflineVisit('patient-uuid'));

    expect(result.current.currentVisit).toBe(activeVisit);
    expect(result.current.activeVisit).toBe(activeVisit);
  });

  it('prefers the visit context over the active visit when both exist', () => {
    const activeVisit = { uuid: 'active-visit-uuid', stopDatetime: null } as Visit;
    const retrospectiveVisit = { uuid: 'retrospective-visit-uuid' } as Visit;
    mockUseVisit.mockReturnValue(
      visitReturnValue({ activeVisit, currentVisit: retrospectiveVisit, currentVisitIsRetrospective: true }),
    );

    const { result } = renderHook(() => useVisitOrOfflineVisit('patient-uuid'));

    expect(result.current.currentVisit).toBe(retrospectiveVisit);
  });

  it('returns no current visit when there is neither an active visit nor a visit context', () => {
    mockUseVisit.mockReturnValue(visitReturnValue({}));

    const { result } = renderHook(() => useVisitOrOfflineVisit('patient-uuid'));

    expect(result.current.currentVisit).toBeNull();
  });
});

describe('offlineVisitToVisit', () => {
  it('preserves the selected operational location', () => {
    const visit = offlineVisitToVisit({
      uuid: 'offline-visit-uuid',
      patient: 'patient-uuid',
      visitType: 'visit-type-uuid',
      location: 'upss-location-uuid',
      startDatetime: new Date('2026-07-16T10:00:00-05:00'),
    });

    expect(visit.location?.uuid).toBe('upss-location-uuid');
  });
});

describe('useAutoCreatedOfflineVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSynchronizationItems.mockResolvedValue([]);
    mockQueueSynchronizationItem.mockResolvedValue(1);
  });

  it('does not refresh or retry when the automatic enqueue rejects', async () => {
    const sensitiveQueueError =
      'IndexedDB failure for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    let rejectEnqueue = (_error: Error) => {};
    const pendingEnqueue = new Promise<number>((_resolve, reject) => {
      rejectEnqueue = reject;
    });
    let postEnqueueReadCount = 0;
    mockGetSynchronizationItems.mockImplementation(() => {
      if (mockQueueSynchronizationItem.mock.calls.length > 0) {
        postEnqueueReadCount += 1;
      }

      return Promise.resolve([]);
    });
    mockQueueSynchronizationItem.mockReturnValueOnce(pendingEnqueue);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderHook(() =>
      useAutoCreatedOfflineVisit(
        'synthetic-patient-uuid',
        'synthetic-visit-type-uuid',
        'synthetic-location-uuid',
      ),
    );

    await waitFor(() => expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectEnqueue(new Error(sensitiveQueueError));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postEnqueueReadCount).toBe(0);
    expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(1);
  });

  it('settles a rejected refresh after a successful automatic enqueue without retrying', async () => {
    const sensitiveRefreshError =
      'Refresh failure for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    let refreshReadCount = 0;
    mockGetSynchronizationItems.mockImplementation(() => {
      if (mockQueueSynchronizationItem.mock.calls.length === 0) {
        return Promise.resolve([]);
      }

      refreshReadCount += 1;
      return Promise.reject(new Error(sensitiveRefreshError));
    });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderHook(() =>
      useAutoCreatedOfflineVisit(
        'synthetic-patient-uuid',
        'synthetic-visit-type-uuid',
        'synthetic-location-uuid',
      ),
    );

    await waitFor(() => expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshReadCount).toBe(1));
    // Vitest fails this regression if the sensitive rejection escapes. The
    // stable counts also prove that the failed refresh does not start a loop.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(1);
    expect(refreshReadCount).toBe(1);
  });
});
