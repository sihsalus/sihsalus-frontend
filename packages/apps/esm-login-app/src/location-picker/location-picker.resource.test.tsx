import {
  type LoggedInUser,
  type Session,
  setUserProperties,
  showSnackbar,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';

import { useValidateLocationUuid } from '../login.resource';
import { useDefaultLocation } from './location-picker.resource';

vi.mock('../login.resource', () => ({
  useValidateLocationUuid: vi.fn(),
}));

const mockSetUserProperties = vi.mocked(setUserProperties);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseValidateLocationUuid = vi.mocked(useValidateLocationUuid);

describe('useDefaultLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseValidateLocationUuid.mockReturnValue({
      defaultLocation: null,
      error: undefined,
      isLoading: false,
      isLocationValid: false,
    });
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [],
        userProperties: {},
        uuid: 'user-uuid',
      } as LoggedInUser,
    } as Session);
  });

  it('does not call the global user endpoint when the current role cannot edit user properties', async () => {
    mockUserHasAccess.mockReturnValue(false);
    const { result } = renderHook(() => useDefaultLocation(false));

    expect(result.current.canSavePreference).toBe(false);

    await act(async () => {
      await result.current.updateDefaultLocation('location-uuid', true);
    });

    expect(mockSetUserProperties).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('persists an authorized location preference', async () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'Edit Users');
    mockSetUserProperties.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDefaultLocation(false));

    expect(result.current.canSavePreference).toBe(true);

    await act(async () => {
      await result.current.updateDefaultLocation('location-uuid', true);
    });

    expect(mockSetUserProperties).toHaveBeenCalledWith('user-uuid', {
      defaultLocation: 'location-uuid',
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        title: 'Location saved',
      }),
    );
  });

  it('contains preference write failures without rejecting the login flow', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUserHasAccess.mockReturnValue(true);
    mockSetUserProperties.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useDefaultLocation(false));

    await expect(
      act(async () => {
        await result.current.updateDefaultLocation('location-uuid', true);
      }),
    ).resolves.toBeUndefined();

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Could not save the preferred location',
      }),
    );
    expect(consoleError).toHaveBeenCalledWith('Failed to update the preferred login location', expect.any(Error));
    consoleError.mockRestore();
  });
});
