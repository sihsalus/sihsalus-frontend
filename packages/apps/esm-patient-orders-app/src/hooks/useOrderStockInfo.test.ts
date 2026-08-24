import { type FetchResponse, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { type ConfigObject } from '../config-schema';

import { useAreBackendModuleInstalled } from './useAreBackendModuleInstalled';
import { useOrderStockInfo } from './useOrderStockInfo';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseAreBackendModuleInstalled = vi.mocked(useAreBackendModuleInstalled);

vi.mock('./useAreBackendModuleInstalled', () => ({
  useAreBackendModuleInstalled: vi.fn(),
}));

describe('useOrderStockInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      stockAvailability: {
        enabled: true,
        dispensingLocationUuid: 'pharmacy-location-uuid',
      },
    } as ConfigObject);
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: true,
      isCheckingModules: false,
      moduleCheckError: undefined,
    });
  });

  it('does not fetch when the indicator is not configured', () => {
    mockUseConfig.mockReturnValue({
      stockAvailability: { enabled: false, dispensingLocationUuid: null },
    } as ConfigObject);

    const { result } = renderHook(() => useOrderStockInfo('drug-uuid'));

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('queries the configured dispensing location and returns in-stock', async () => {
    mockedOpenmrsFetch.mockResolvedValue({
      data: { results: [{ quantity: 0 }, { quantity: 12 }] },
    } as FetchResponse<{ results: Array<{ quantity: number }> }>);

    const { result } = renderHook(() => useOrderStockInfo('drug-uuid'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe('in-stock');
    expect(mockedOpenmrsFetch).toHaveBeenCalledOnce();
    const requestedUrl = new URL(mockedOpenmrsFetch.mock.calls[0][0], 'https://example.test');
    expect(requestedUrl.pathname).toBe('/ws/rest/v1/stockmanagement/stockiteminventory');
    expect(requestedUrl.searchParams.get('drugUuid')).toBe('drug-uuid');
    expect(requestedUrl.searchParams.get('dispenseLocationUuid')).toBe('pharmacy-location-uuid');
    expect(requestedUrl.searchParams.get('dispenseAtLocation')).toBe('1');
    expect(requestedUrl.searchParams.get('emptyBatch')).toBe('1');
    expect(requestedUrl.searchParams.get('excludeExpired')).toBe('true');
  });

  it('returns out-of-stock only when a tracked inventory row has no positive quantity', async () => {
    mockedOpenmrsFetch.mockResolvedValue({
      data: { results: [{ quantity: 0 }] },
    } as FetchResponse<{ results: Array<{ quantity: number }> }>);

    const { result } = renderHook(() => useOrderStockInfo('zero-balance-drug-uuid'));

    await waitFor(() => expect(result.current.status).toBe('out-of-stock'));
  });

  it('returns untracked when Stock Management has no inventory row for the drug', async () => {
    mockedOpenmrsFetch.mockResolvedValue({
      data: { results: [] },
    } as FetchResponse<{ results: Array<{ quantity: number }> }>);

    const { result } = renderHook(() => useOrderStockInfo('untracked-drug-uuid'));

    await waitFor(() => expect(result.current.status).toBe('untracked'));
  });

  it('returns untracked instead of a false zero when an inventory quantity is malformed', async () => {
    mockedOpenmrsFetch.mockResolvedValue({
      data: { results: [{ quantity: 'not-a-number' }] },
    } as FetchResponse<{ results: Array<{ quantity: unknown }> }>);

    const { result } = renderHook(() => useOrderStockInfo('malformed-balance-drug-uuid'));

    await waitFor(() => expect(result.current.status).toBe('untracked'));
  });

  it('does not query when Stock Management is unavailable', () => {
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: false,
      isCheckingModules: false,
      moduleCheckError: new Error('Module check failed'),
    });

    const { result } = renderHook(() => useOrderStockInfo('drug-uuid'));

    expect(result.current.status).toBeNull();
    expect(result.current.error).toEqual(new Error('Module check failed'));
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });
});
