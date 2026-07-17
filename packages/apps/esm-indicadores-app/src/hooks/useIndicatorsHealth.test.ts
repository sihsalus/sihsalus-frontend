import { logError, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { activateMockMode, reportBackendUnavailable, resetMockMode } from '../api/mock-mode';
import { type Config } from '../config-schema';
import { useIndicatorsHealth } from './useIndicatorsHealth';

vi.mock('@openmrs/esm-framework', () => ({
  logError: vi.fn(),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('../api/mock-mode', () => ({
  activateMockMode: vi.fn(),
  reportBackendUnavailable: vi.fn(),
  resetMockMode: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);

const defaultConfig: Config = {
  indicatorsApiPath: '/ws/module/indicators/api',
  reportesSqlApiPath: '/services/reportes-sql',
  enableDemoData: false,
};

describe('useIndicatorsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(defaultConfig);
  });

  it('marks the backend healthy after a successful check', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { status: 'ok' }, status: 200 } as never);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(resetMockMode).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch.mock.calls[0][0]).toBe('/services/reportes-sql/health');
  });

  it('fails closed by default instead of activating examples', async () => {
    const error = new Error('Network Error');
    mockOpenmrsFetch.mockRejectedValue(error);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(reportBackendUnavailable).toHaveBeenCalledWith('Network Error'));
    expect(activateMockMode).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(error, 'Indicadores: health check de reportes-sql');
  });

  it('activates examples only when demo data is explicitly enabled', async () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, enableDemoData: true });
    mockOpenmrsFetch.mockRejectedValue(new Error('Network Error'));
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(activateMockMode).toHaveBeenCalledWith('Network Error'));
    expect(reportBackendUnavailable).not.toHaveBeenCalled();
  });

  it('stores a stable fallback for non-Error failures', async () => {
    mockOpenmrsFetch.mockRejectedValue({ status: 502, internal: 'upstream reportes-sql' });
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() =>
      expect(reportBackendUnavailable).toHaveBeenCalledWith('No se pudo conectar con el API de indicadores.'),
    );
  });

  it('uses a custom reportes-sql base path', async () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, reportesSqlApiPath: '/custom/reportes-sql' });
    mockOpenmrsFetch.mockResolvedValue({ data: { status: 'ok' } } as never);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    expect(mockOpenmrsFetch.mock.calls[0][0]).toBe('/custom/reportes-sql/health');
  });

  it('does not update state after unmount', async () => {
    let rejectPromise: (reason: unknown) => void = () => {};
    const deferred = new Promise((_resolve, reject) => {
      rejectPromise = reject;
    });
    mockOpenmrsFetch.mockReturnValue(deferred as never);
    const { unmount } = renderHook(() => useIndicatorsHealth());
    unmount();

    await act(async () => rejectPromise(new Error('Late error')));

    expect(activateMockMode).not.toHaveBeenCalled();
    expect(reportBackendUnavailable).not.toHaveBeenCalled();
    expect(resetMockMode).not.toHaveBeenCalled();
  });
});
