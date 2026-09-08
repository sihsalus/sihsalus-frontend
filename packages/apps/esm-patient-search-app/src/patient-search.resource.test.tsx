import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWRInfinite from 'swr/infinite';

import { getActiveVisitPatientUuids, useInfinitePatientSearch, useRestPatients } from './patient-search.resource';
import { isRecentPatientRequestCurrent } from './recently-viewed-patients.store';

vi.mock('swr/infinite', () => ({
  default: vi.fn(),
}));

vi.mock('./recently-viewed-patients.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./recently-viewed-patients.store')>();
  return { ...actual, isRecentPatientRequestCurrent: vi.fn() };
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSWRInfinite = vi.mocked(useSWRInfinite);

describe('patient search resource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRecentPatientRequestCurrent).mockReturnValue(true);
    mockUseSWRInfinite.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 1,
    } as unknown as ReturnType<typeof useSWRInfinite>);
  });

  it('trims the patient query at the REST resource boundary', () => {
    renderHook(() => useInfinitePatientSearch('  80526377  ', true));

    const getUrl = mockUseSWRInfinite.mock.calls.at(-1)?.[0] as (page: number, previousPageData: null) => string;
    const url = new URL(getUrl(0, null), 'http://localhost');

    expect(url.searchParams.get('q')).toBe('80526377');
  });

  it('does not fetch a whitespace-only query', () => {
    renderHook(() => useInfinitePatientSearch('   ', true));

    expect(mockUseSWRInfinite.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('does not fetch a patient query shorter than three characters', () => {
    renderHook(() => useInfinitePatientSearch('Jo', true));

    expect(mockUseSWRInfinite.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('discards null and malformed patient results returned by the server', () => {
    const validPatient = {
      uuid: 'patient-a',
      identifiers: [],
      person: {
        personName: {
          display: 'Patient A',
        },
      },
    };
    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: {
            results: [validPatient, null, { ...validPatient, uuid: null }, { uuid: 'patient-without-person' }],
            links: [],
            totalCount: 4,
          },
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 1,
    } as unknown as ReturnType<typeof useSWRInfinite>);

    const { result } = renderHook(() => useInfinitePatientSearch('Patient', true));

    expect(result.current.data).toEqual([validPatient]);
  });

  it('collects unique patients from every active visit page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      uuid: `visit-${index}`,
      patient: { uuid: index % 2 === 0 ? 'patient-a' : 'patient-b' },
    }));
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'visit-100', patient: { uuid: 'patient-c' } }],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(getActiveVisitPatientUuids()).resolves.toEqual(['patient-a', 'patient-b', 'patient-c']);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('includeInactive=false');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('startIndex=0');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('startIndex=100');
  });

  it('skips missing recently viewed patients without hiding available patients', async () => {
    const patient = {
      uuid: 'patient-a',
      identifiers: [],
      person: { personName: { display: 'Synthetic patient A' } },
    };
    mockUseSWRInfinite.mockReturnValue({
      data: [{ data: patient }, null],
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 2,
    } as unknown as ReturnType<typeof useSWRInfinite>);

    const { result } = renderHook(() => useRestPatients(['patient-a', 'missing-patient']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (key: [number, string, string]) => Promise<unknown>;

    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(
      fetcher([0, 'patient-a,missing-patient', '/openmrs/ws/rest/v1/patient/missing-patient']),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([patient]);
    expect(result.current.fetchError).toBeUndefined();
  });

  it('skips recently viewed patients that are no longer accessible to the current user', async () => {
    renderHook(() => useRestPatients(['patient-outside-current-upss']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (key: [number, string, string]) => Promise<unknown>;

    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 403 } });

    await expect(
      fetcher([0, 'patient-outside-current-upss', '/openmrs/ws/rest/v1/patient/patient-outside-current-upss']),
    ).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not start a recent-patient read for a stale generation', async () => {
    renderHook(() => useRestPatients(['patient-a']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (key: [number, string, string]) => Promise<unknown>;
    vi.mocked(isRecentPatientRequestCurrent).mockReturnValue(false);

    await expect(fetcher([0, 'patient-a', '/openmrs/ws/rest/v1/patient/patient-a'])).resolves.toBeNull();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it.each(['response', 'error'])('discards a late %s from an old recent-patient generation', async (outcome) => {
    renderHook(() => useRestPatients(['patient-a']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (key: [number, string, string]) => Promise<unknown>;
    mockOpenmrsFetch.mockImplementationOnce(async () => {
      vi.mocked(isRecentPatientRequestCurrent).mockReturnValue(false);
      if (outcome === 'error') throw { response: { status: 500 } };
      return { data: { uuid: 'patient-a' } } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await expect(fetcher([0, 'patient-a', '/openmrs/ws/rest/v1/patient/patient-a'])).resolves.toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not suppress server errors while loading recently viewed patients', async () => {
    renderHook(() => useRestPatients(['patient-a']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (key: [number, string, string]) => Promise<unknown>;
    const serverError = { response: { status: 500 } };

    mockOpenmrsFetch.mockRejectedValueOnce(serverError);

    await expect(fetcher([0, 'patient-a', '/openmrs/ws/rest/v1/patient/patient-a'])).rejects.toBe(serverError);
  });
});
