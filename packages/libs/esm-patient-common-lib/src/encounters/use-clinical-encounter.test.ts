import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenmrsEncounter } from '../encounter-list/types';
import { clinicalEncounterRepresentation, useClinicalEncounter } from './use-clinical-encounter';

const mockUseSWR = vi.fn();

vi.mock('swr', () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
}));

const emptySWRState = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
};

describe('useClinicalEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue(emptySWRState);
  });

  it('builds an encoded encounter URL with the expected representation and concept UUIDs', () => {
    const encounterTypeUuid = '  encounter/type?uuid  ';
    const formUuid = '  form uuid&version=1  ';
    const patientUuid = '  patient/uuid?active=true  ';
    const conceptUuids = ['  concept/one  ', '  concept&two  '];

    renderHook(() => useClinicalEncounter(encounterTypeUuid, formUuid, patientUuid, conceptUuids));

    const [key, fetcher] = mockUseSWR.mock.calls[0];
    const url = new URL(key, 'https://example.test');

    expect(url.pathname).toBe('/ws/rest/v1/encounter');
    expect(url.searchParams.get('encounterType')).toBe(encounterTypeUuid.trim());
    expect(url.searchParams.get('formUuid')).toBe(formUuid.trim());
    expect(url.searchParams.get('patient')).toBe(patientUuid.trim());
    expect(url.searchParams.get('conceptUuid')).toBe(conceptUuids.map((uuid) => uuid.trim()).join(','));
    expect(url.searchParams.get('v')).toBe(clinicalEncounterRepresentation);
    expect(fetcher).toBe(openmrsFetch);
  });

  it.each([
    { conceptUuids: ['concept-uuid'], encounterTypeUuid: '', formUuid: 'form-uuid', patientUuid: 'patient-uuid' },
    { conceptUuids: ['concept-uuid'], encounterTypeUuid: 'type-uuid', formUuid: '', patientUuid: 'patient-uuid' },
    { conceptUuids: ['concept-uuid'], encounterTypeUuid: 'type-uuid', formUuid: 'form-uuid', patientUuid: '' },
    { conceptUuids: [], encounterTypeUuid: 'type-uuid', formUuid: 'form-uuid', patientUuid: 'patient-uuid' },
    { conceptUuids: null, encounterTypeUuid: 'type-uuid', formUuid: 'form-uuid', patientUuid: 'patient-uuid' },
    {
      conceptUuids: ['concept-uuid'],
      encounterTypeUuid: 'type-uuid',
      formUuid: undefined,
      patientUuid: 'patient-uuid',
    },
    {
      conceptUuids: ['concept-uuid', '   '],
      encounterTypeUuid: 'type-uuid',
      formUuid: 'form-uuid',
      patientUuid: 'patient-uuid',
    },
  ])('uses a null SWR key and does not fetch when a required UUID is missing', ({
    encounterTypeUuid,
    formUuid,
    patientUuid,
    conceptUuids,
  }) => {
    mockUseSWR.mockImplementation((key, fetcher) => {
      if (key) {
        fetcher(key);
      }
      return emptySWRState;
    });

    renderHook(() => useClinicalEncounter(encounterTypeUuid, formUuid, patientUuid, conceptUuids));

    expect(mockUseSWR).toHaveBeenCalledWith(null, openmrsFetch);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('sorts encounter results newest-first and preserves the SWR state contract', () => {
    const olderEncounter = {
      encounterDatetime: '2026-07-14T10:00:00.000Z',
      uuid: 'older-encounter',
    } as OpenmrsEncounter;
    const newerEncounter = {
      encounterDatetime: '2026-07-15T10:00:00.000Z',
      uuid: 'newer-encounter',
    } as OpenmrsEncounter;
    const error = new Error('request failed');
    const mutate = vi.fn();
    mockUseSWR.mockReturnValue({
      data: { data: { results: [olderEncounter, newerEncounter] } },
      error,
      isLoading: true,
      isValidating: true,
      mutate,
    });

    const { result } = renderHook(() =>
      useClinicalEncounter('encounter-type-uuid', 'form-uuid', 'patient-uuid', ['concept-uuid']),
    );

    expect(result.current).toEqual({
      encounters: [newerEncounter, olderEncounter],
      error,
      isLoading: true,
      isValidating: true,
      mutate,
    });
  });

  it('returns an empty encounter list before data is available', () => {
    const { result } = renderHook(() =>
      useClinicalEncounter('encounter-type-uuid', 'form-uuid', 'patient-uuid', ['concept-uuid']),
    );

    expect(result.current.encounters).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.mutate).toBe(emptySWRState.mutate);
  });
});
