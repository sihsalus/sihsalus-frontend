import { useConnectivity, useSession, userHasAccess } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { imagingEditPrivilege } from '../constants';
import { useImagingAccess } from './use-imaging-access';

vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/ws/rest/v1',
  useSession: vi.fn(),
  useConnectivity: vi.fn(),
  userHasAccess: vi.fn(),
}));

describe('imaging action availability', () => {
  const user = { uuid: 'synthetic-user', privileges: [], roles: [] };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({ authenticated: true, user } as never);
    vi.mocked(useConnectivity).mockReturnValue(true);
    vi.mocked(userHasAccess).mockReturnValue(true);
  });

  it('uses the same app privilege declared for the write workspaces', () => {
    const { result } = renderHook(useImagingAccess);
    expect(result.current.canWrite).toBe(true);
    expect(userHasAccess).toHaveBeenCalledWith(imagingEditPrivilege, user);
  });

  it.each([
    [false, true, true],
    [true, false, true],
    [true, true, false],
  ])('rejects writes without authentication, connectivity or permission', (authenticated, online, hasAccess) => {
    vi.mocked(useSession).mockReturnValue({ authenticated, user } as never);
    vi.mocked(useConnectivity).mockReturnValue(online);
    vi.mocked(userHasAccess).mockReturnValue(hasAccess);
    const { result } = renderHook(useImagingAccess);
    expect(result.current.canWrite).toBe(false);
  });
});
