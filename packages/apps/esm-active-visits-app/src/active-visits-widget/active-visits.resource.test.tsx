import { useConfig, type Visit } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';

import { useFacilityActiveVisits } from '../active-visits.resource';
import { useActiveVisits } from './active-visits.resource';

const mockUseConfig = vi.mocked(useConfig);
const mockUseFacilityActiveVisits = vi.mocked(useFacilityActiveVisits);

vi.mock('../active-visits.resource', () => ({
  useFacilityActiveVisits: vi.fn(),
}));

describe('useActiveVisits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    mockUseFacilityActiveVisits.mockReturnValue({
      visits: [visitWithoutEncounters],
      error: undefined,
      isLoading: false,
      isValidating: false,
      totalResults: 1,
    });

    const { result } = renderHook(() => useActiveVisits());

    expect(result.current.activeVisits).toHaveLength(1);
    expect(result.current.activeVisits[0]).toMatchObject({
      observations: {},
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
    });
  });
});
