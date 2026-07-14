import { useConfig, useSession, type Visit } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { mockSession } from 'test-utils';
import useSWRInfinite from 'swr/infinite';

import { useActiveVisits } from './active-visits.resource';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUseSWRInfinite = vi.mocked(useSWRInfinite);

vi.mock('swr/infinite', () => ({
  default: vi.fn(),
}));

describe('useActiveVisits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseConfig.mockReturnValue({
      activeVisits: {
        attributes: [],
        identifiers: [],
      },
    });
  });

  it('maps visits when OpenMRS omits the encounters collection', () => {
    const visitWithoutEncounters = {
      uuid: 'visit-uuid',
      patient: {
        uuid: 'patient-uuid',
        identifiers: [],
        person: {
          age: 30,
          attributes: [],
          display: 'Test Patient',
          gender: 'F',
        },
      },
      visitType: {
        display: 'Outpatient',
      },
      location: {
        uuid: 'location-uuid',
      },
      startDatetime: '2026-07-13T08:00:00.000-0500',
    } as unknown as Visit;

    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: {
            results: [visitWithoutEncounters],
            links: [],
            totalCount: 1,
          },
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 1,
    } as never);

    const { result } = renderHook(() => useActiveVisits());

    expect(result.current.activeVisits).toHaveLength(1);
    expect(result.current.activeVisits[0]).toMatchObject({
      observations: {},
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
    });
  });
});
