import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { mockOrderStockData } from 'test-utils';
import { type OrderStockData } from '../types/order';

import { useAreBackendModuleInstalled } from './useAreBackendModuleInstalled';
import { useOrderStockInfo } from './useOrderStockInfo';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseAreBackendModuleInstalled = vi.mocked(useAreBackendModuleInstalled);

vi.mock('./useAreBackendModuleInstalled', () => ({
  useAreBackendModuleInstalled: vi.fn(),
}));

describe('useOrderStockInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: true,
      isCheckingModules: false,
      moduleCheckError: undefined,
    });
    mockedOpenmrsFetch.mockResolvedValue({ data: null } as FetchResponse<OrderStockData>);
  });

  it('returns null data when orderItemUuid is not provided', () => {
    const { result } = renderHook(() => useOrderStockInfo(''));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBeFalsy();
  });

  it('fetches and returns stock data when required modules are installed', async () => {
    const mockStockPromise = Promise.resolve({
      data: mockOrderStockData,
    } as FetchResponse<OrderStockData>);

    mockedOpenmrsFetch.mockResolvedValue(mockStockPromise as unknown as FetchResponse<OrderStockData>);

    const { result } = renderHook(() => useOrderStockInfo('test-uuid'));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBeTruthy();

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.data).toEqual(mockOrderStockData);
    expect(result.current.isLoading).toBeFalsy();
  });

  it('does not fetch stock data when required modules are not installed', async () => {
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: false,
      isCheckingModules: false,
      moduleCheckError: undefined,
    });

    const { result } = renderHook(() => useOrderStockInfo('test-uuid-2'));

    expect(result.current.data).toBeNull();
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('handles module check error gracefully', async () => {
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: false,
      isCheckingModules: false,
      moduleCheckError: new Error('Failed to fetch modules'),
    });

    const { result } = renderHook(() => useOrderStockInfo('test-uuid-2'));

    expect(result.current.data).toBeNull();
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });
});
