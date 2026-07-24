import { openmrsFetch, userHasAccess, useSession } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import { mockSession } from 'test-utils';
import useSWRInfinite from 'swr/infinite';

import {
  getActiveVisitPatientUuids,
  isForbiddenUserPropertiesError,
  useInfinitePatientSearch,
  useRecentlyViewedPatients,
  useRestPatients,
} from './patient-search.resource';

vi.mock('swr/infinite', () => ({
  default: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);
const mockUseSWRInfinite = vi.mocked(useSWRInfinite);

describe('patient search resource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          {
            display: 'Edit Users',
            links: [],
            name: 'Edit Users',
            uuid: 'edit-users-privilege',
          },
        ],
        userProperties: {
          ...mockSession.data.user.userProperties,
          patientsVisited: 'patient-a,patient-b',
        },
      },
    });
    mockUserHasAccess.mockReturnValue(true);
    mockUseSWRInfinite.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 1,
    } as unknown as ReturnType<typeof useSWRInfinite>);
  });

  it('reads recently viewed patients from the current session without fetching the user resource', () => {
    const { result } = renderHook(() => useRecentlyViewedPatients(true));

    expect(result.current.recentlyViewedPatientUuids).toEqual(['patient-a', 'patient-b']);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingPatients).toBe(false);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not update recently viewed patients when the feature is disabled', async () => {
    const { result } = renderHook(() => useRecentlyViewedPatients(false));

    await result.current.updateRecentlyViewedPatients('patient-c');

    expect(result.current.recentlyViewedPatientUuids).toEqual([]);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('updates recently viewed patients in memory and persists them when the feature is enabled', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useRecentlyViewedPatients(true));

    await act(async () => {
      await result.current.updateRecentlyViewedPatients('patient-c');
    });

    expect(result.current.recentlyViewedPatientUuids).toEqual(['patient-c', 'patient-a', 'patient-b']);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ws/rest/v1/user/'),
      expect.objectContaining({
        method: 'POST',
        body: {
          userProperties: expect.objectContaining({
            patientsVisited: 'patient-c,patient-a,patient-b',
          }),
        },
      }),
    );
  });

  it('updates recently viewed patients in memory without persisting when user properties cannot be edited', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [],
        roles: [],
        userProperties: {
          ...mockSession.data.user.userProperties,
          patientsVisited: 'patient-a,patient-b',
        },
      },
    });
    mockUserHasAccess.mockReturnValue(false);
    const { result } = renderHook(() => useRecentlyViewedPatients(true));

    await act(async () => {
      await result.current.updateRecentlyViewedPatients('patient-c');
    });

    expect(result.current.recentlyViewedPatientUuids).toEqual(['patient-c', 'patient-a', 'patient-b']);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('detects forbidden user property errors from REST responses and OpenMRS error messages', () => {
    expect(isForbiddenUserPropertiesError({ response: { status: 403 } })).toBe(true);
    expect(
      isForbiddenUserPropertiesError(new Error('Server responded with 403 () for url /openmrs/ws/rest/v1/user/u')),
    ).toBe(true);
    expect(isForbiddenUserPropertiesError({ response: { status: 500 } })).toBe(false);
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
        data: { results: [{ uuid: 'visit-100', patient: { uuid: 'patient-c' } }] },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(getActiveVisitPatientUuids()).resolves.toEqual(['patient-a', 'patient-b', 'patient-c']);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('includeInactive=false');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('startIndex=0');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('startIndex=100');
  });

  it('skips missing recently viewed patients without hiding available patients', async () => {
    mockUseSWRInfinite.mockReturnValue({
      data: [{ data: { uuid: 'patient-a' } }, null],
      error: undefined,
      isLoading: false,
      isValidating: false,
      setSize: vi.fn(),
      size: 2,
    } as unknown as ReturnType<typeof useSWRInfinite>);

    const { result } = renderHook(() => useRestPatients(['patient-a', 'missing-patient']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (url: string) => Promise<unknown>;

    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(fetcher('/openmrs/ws/rest/v1/patient/missing-patient')).resolves.toBeNull();
    expect(result.current.data).toEqual([{ uuid: 'patient-a' }]);
    expect(result.current.fetchError).toBeUndefined();
  });

  it('does not suppress server errors while loading recently viewed patients', async () => {
    renderHook(() => useRestPatients(['patient-a']));
    const fetcher = mockUseSWRInfinite.mock.calls.at(-1)?.[1] as (url: string) => Promise<unknown>;
    const serverError = { response: { status: 500 } };

    mockOpenmrsFetch.mockRejectedValueOnce(serverError);

    await expect(fetcher('/openmrs/ws/rest/v1/patient/patient-a')).rejects.toBe(serverError);
  });
});
