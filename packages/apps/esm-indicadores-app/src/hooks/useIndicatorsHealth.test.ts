import { logError, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { settleBackendOperation, startBackendOperation } from '../api/mock-mode';
import { type ConfigObject } from '../config-schema';
import { useIndicatorsHealth } from './useIndicatorsHealth';

vi.mock('@openmrs/esm-framework', () => ({
  logError: vi.fn(),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('../api/mock-mode', () => ({
  settleBackendOperation: vi.fn(),
  startBackendOperation: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);
const mockStart = vi.mocked(startBackendOperation);
const mockSettle = vi.mocked(settleBackendOperation);

const defaultConfig: ConfigObject = {
  indicatorsApiPath: '/ws/module/indicators/api',
  reportesSqlApiPath: '/services/reportes-sql',
  enableDemoData: false,
};

describe('useIndicatorsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(defaultConfig);
  });

  it('joins the batch verdict and reports success after a healthy check', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { status: 'ok' }, status: 200 } as never);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    // Health check joins the batch via startBackendOperation and reports ok via settle.
    await vi.waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
    expect(mockSettle).toHaveBeenCalledWith(true);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toBe('/services/reportes-sql/health');
  });

  it('contributes a failed verdict (unavailable) without directly activating demo mode', async () => {
    const error = new Error('Network Error');
    mockOpenmrsFetch.mockRejectedValue(error);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(mockSettle).toHaveBeenCalledWith(false, 'Network Error'));
    // The health check never flips demo mode directly — the data-read settles
    // own that decision. Here it just contributes "unhealthy".
    expect(mockSettle).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(logError).toHaveBeenCalledWith(error, 'Indicadores: health check de reportes-sql');
  });

  it('contributes the same failed verdict even when demo data is enabled', async () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, enableDemoData: true });
    mockOpenmrsFetch.mockRejectedValue(new Error('Network Error'));
    renderHook(() => useIndicatorsHealth());

    // enableDemoData affects whether reads fall back to demo payloads; the
    // health check itself only contributes "unhealthy" to the batch verdict.
    await vi.waitFor(() => expect(mockSettle).toHaveBeenCalledWith(false, 'Network Error'));
    expect(mockSettle).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
  });

  it('stores a stable fallback for non-Error failures', async () => {
    mockOpenmrsFetch.mockRejectedValue({ status: 502, internal: 'upstream reportes-sql' });
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() =>
      expect(mockSettle).toHaveBeenCalledWith(false, 'No se pudo conectar con el API de indicadores.'),
    );
  });

  it('uses a custom reportes-sql base path', async () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, reportesSqlApiPath: '/custom/reportes-sql' });
    mockOpenmrsFetch.mockResolvedValue({ data: { status: 'ok' } } as never);
    renderHook(() => useIndicatorsHealth());

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    expect(mockOpenmrsFetch.mock.calls[0][0]).toBe('/custom/reportes-sql/health');
  });

  it('still releases its batch slot on unmount before the check resolves', async () => {
    let rejectPromise: (reason: unknown) => void = () => {};
    const deferred = new Promise((_resolve, reject) => {
      rejectPromise = reject;
    });
    mockOpenmrsFetch.mockReturnValue(deferred as never);
    const { unmount } = renderHook(() => useIndicatorsHealth());
    unmount();

    await act(async () => rejectPromise(new Error('Late error')));

    // On unmount the hook settled its slot as a neutral "ok" so the batch
    // verdict only reflects the data reads.
    expect(mockSettle).toHaveBeenCalledWith(true);
    expect(mockSettle).not.toHaveBeenCalledWith(false, expect.anything(), expect.anything());
  });
});
