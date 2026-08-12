import { isVersionSatisfied, openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';

import { clearCache } from './openmrs-backend-dependencies';
import { useBackendDependencies } from './useBackendDependencies';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  isVersionSatisfied: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockIsVersionSatisfied = vi.mocked(isVersionSatisfied);

describe('useBackendDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
    window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^2.0.0' } }]];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows a manual retry and clears the preserved error after success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenmrsFetch
      .mockRejectedValueOnce(Object.assign(new Error('Server responded with 401'), { response: { status: 401 } }))
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
    mockIsVersionSatisfied.mockReturnValue(true);

    const { result } = renderHook(() => useBackendDependencies());

    await waitFor(() => expect(result.current.errorStatus).toBe(401));
    expect(result.current.error).toContain('Server responded with 401');
    expect(result.current.modules).toEqual([]);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retry();
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.errorStatus).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.modules[0].dependencies[0].type).toBe('okay');
  });

  it('does not duplicate the backend request when mounted in StrictMode', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
        links: [],
      },
    } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
    mockIsVersionSatisfied.mockReturnValue(true);
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

    const { result } = renderHook(() => useBackendDependencies(), { wrapper });

    await waitFor(() => expect(result.current.modules[0]?.dependencies[0]?.type).toBe('okay'));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(result.current.isRetrying).toBe(false);
  });
});
