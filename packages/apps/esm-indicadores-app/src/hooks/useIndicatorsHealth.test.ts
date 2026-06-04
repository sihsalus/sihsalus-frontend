import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { activateMockMode, resetMockMode } from '../api/mock-mode';
import { type Config } from '../config-schema';
import { useIndicatorsHealth } from './useIndicatorsHealth';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('../api/mock-mode', () => ({
  activateMockMode: vi.fn(),
  resetMockMode: vi.fn(),
  useMockMode: vi.fn(),
  getMockModeState: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);

const defaultConfig: Config = {
  indicatorsApiPath: '/ws/module/indicators/api',
  reportesSqlApiPath: '/services/reportes-sql',
};

const CUSTOM_REPORTES_SQL_PATH = '/custom/reportes-sql';

describe('useIndicatorsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls resetMockMode when health check succeeds', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { status: 'ok' },
      status: 200,
    } as never);

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(resetMockMode).toHaveBeenCalledTimes(1);
    });
  });

  it('calls activateMockMode when health check fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('Network Error'));

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(activateMockMode).toHaveBeenCalledTimes(1);
      expect(activateMockMode).toHaveBeenCalledWith('Network Error');
    });
  });

  it('calls activateMockMode with default message when error is not an Error or string', async () => {
    // A plain object (not Error, not string) triggers the default message
    mockOpenmrsFetch.mockRejectedValueOnce({ code: 500 });

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(activateMockMode).toHaveBeenCalledTimes(1);
      expect(activateMockMode).toHaveBeenCalledWith('No se pudo conectar con el API de indicadores.');
    });
  });

  it('calls health endpoint using reportesSqlApiPath from config', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { status: 'ok' },
      status: 200,
    } as never);

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    });

    const calledUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/services/reportes-sql/health');
  });

  it('uses custom reportesSqlApiPath from config when provided', async () => {
    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      reportesSqlApiPath: CUSTOM_REPORTES_SQL_PATH,
    });
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { status: 'ok' },
      status: 200,
    } as never);

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    });

    const calledUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`${CUSTOM_REPORTES_SQL_PATH}/health`);
  });

  it('does NOT use indicatorsApiPath for health check', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { status: 'ok' },
      status: 200,
    } as never);

    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => {
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    });

    const calledUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('/ws/module/indicators/api');
  });

  it('does not call activateMockMode after component unmount during request', async () => {
    // Use a deferred promise to control timing
    let rejectPromise: (reason: unknown) => void = () => {};
    const deferred = new Promise((_resolve, reject) => {
      rejectPromise = reject;
    });
    mockOpenmrsFetch.mockReturnValueOnce(deferred as never);

    const { unmount } = renderHook(() => useIndicatorsHealth());

    // Unmount before the promise resolves
    unmount();

    // Now reject
    await act(async () => {
      rejectPromise(new Error('Late error'));
    });

    // Neither mock should be called since component unmounted
    expect(activateMockMode).not.toHaveBeenCalled();
    expect(resetMockMode).not.toHaveBeenCalled();
  });
});
