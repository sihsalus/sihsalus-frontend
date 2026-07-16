import { useVisit, type Visit } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';

import { offlineVisitToVisit, useVisitOrOfflineVisit } from './visit';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useVisit: vi.fn(),
  useSession: vi.fn(() => ({ sessionLocation: { uuid: 'location-uuid' } })),
  getSynchronizationItems: vi.fn(async () => []),
}));

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
