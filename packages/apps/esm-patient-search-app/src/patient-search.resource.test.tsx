import { openmrsFetch, userHasAccess, useSession } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import { mockSession } from 'test-utils';

import { isForbiddenUserPropertiesError, useRecentlyViewedPatients } from './patient-search.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);

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
});
