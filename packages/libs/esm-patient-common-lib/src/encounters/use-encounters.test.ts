import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenmrsEncounter } from '../encounter-list/types';
import useEncounters from './use-encounters';

const mockUseSWR = vi.fn();

vi.mock('swr', () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const emptySWRState = {
  data: undefined,
  error: undefined,
  isLoading: false,
  mutate: vi.fn(),
};

describe('useEncounters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue(emptySWRState);
  });

  it('builds an encoded encounter URL with the expected representation and date filters', () => {
    const patientUuid = '  patient/uuid?with=special&characters  ';
    const encounterTypeUuid = '  encounter type/uuid  ';
    const fromdate = '  2026-07-01T08:30:00-05:00  ';
    const todate = '  2026-07-15T17:45:00-05:00  ';

    renderHook(() => useEncounters(patientUuid, encounterTypeUuid, fromdate, todate));

    const [key, fetcher] = mockUseSWR.mock.calls[0];
    const url = new URL(key, 'https://example.test');

    expect(url.pathname).toBe(`${restBaseUrl}/encounter`);
    expect(url.searchParams.get('patient')).toBe(patientUuid.trim());
    expect(url.searchParams.get('encounterType')).toBe(encounterTypeUuid.trim());
    expect(url.searchParams.get('fromdate')).toBe(fromdate.trim());
    expect(url.searchParams.get('todate')).toBe(todate.trim());
    expect(url.searchParams.get('v')).toBe(
      'custom:(uuid,display,encounterDatetime,obs:(uuid,display,value:(uuid,display)))',
    );
    expect(fetcher).toBe(openmrsFetch);
  });

  it.each([
    { encounterTypeUuid: 'encounter-type-uuid', patientUuid: '' },
    { encounterTypeUuid: '', patientUuid: 'patient-uuid' },
    { encounterTypeUuid: 'encounter-type-uuid', patientUuid: '   ' },
    { encounterTypeUuid: 'encounter-type-uuid', patientUuid: null },
    { encounterTypeUuid: undefined, patientUuid: 'patient-uuid' },
  ])('uses a null SWR key and does not fetch when a required UUID is missing', ({ patientUuid, encounterTypeUuid }) => {
    mockUseSWR.mockImplementation((key, fetcher) => {
      if (key) {
        fetcher(key);
      }
      return emptySWRState;
    });

    renderHook(() => useEncounters(patientUuid, encounterTypeUuid));

    expect(mockUseSWR).toHaveBeenCalledWith(null, openmrsFetch);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('returns encounter results and preserves the SWR state contract', () => {
    const encounters = [{ encounterDatetime: '2026-07-15T10:00:00.000Z', uuid: 'encounter-uuid' } as OpenmrsEncounter];
    const error = new Error('request failed');
    const mutate = vi.fn();
    mockUseSWR.mockReturnValue({
      data: { data: { results: encounters } },
      error,
      isLoading: true,
      mutate,
    });

    const { result } = renderHook(() => useEncounters('patient-uuid', 'encounter-type-uuid'));

    expect(result.current).toEqual({ encounters, error, isLoading: true, mutate });
  });

  it('returns an empty encounter list before data is available', () => {
    const { result } = renderHook(() => useEncounters('patient-uuid', 'encounter-type-uuid'));

    expect(result.current.encounters).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mutate).toBe(emptySWRState.mutate);
  });
});
