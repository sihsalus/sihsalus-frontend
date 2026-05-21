import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { mockOrderPriceData } from 'test-utils';

import { type OrderPriceData } from '../types/order';

import { useAreBackendModuleInstalled } from './useAreBackendModuleInstalled';
import { useOrderPrice } from './useOrderPrice';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseAreBackendModuleInstalled = vi.mocked(useAreBackendModuleInstalled);

vi.mock('./useAreBackendModuleInstalled', () => ({
  useAreBackendModuleInstalled: vi.fn(),
}));

describe('useOrderPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: true,
      isCheckingModules: false,
      moduleCheckError: undefined,
    });
    mockedOpenmrsFetch.mockResolvedValue({ data: null } as FetchResponse<OrderPriceData>);
  });

  it('returns null data when orderItemUuid is not provided', () => {
    const { result } = renderHook(() => useOrderPrice(''));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBeFalsy();
  });

  it('fetches and returns price data when required modules are installed', async () => {
    const mockPricePromise = Promise.resolve({
      data: mockOrderPriceData,
    } as FetchResponse<OrderPriceData>);

    mockedOpenmrsFetch.mockResolvedValue(mockPricePromise as unknown as FetchResponse<OrderPriceData>);

    const { result } = renderHook(() => useOrderPrice('test-uuid'));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBeTruthy();

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.data).toEqual(mockOrderPriceData);
    expect(result.current.isLoading).toBeFalsy();
  });

  it('does not fetch price data when required modules are not installed', async () => {
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: false,
      isCheckingModules: false,
      moduleCheckError: undefined,
    });

    const { result } = renderHook(() => useOrderPrice('test-uuid-2'));

    expect(result.current.data).toBeNull();
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('handles module check error gracefully', async () => {
    mockUseAreBackendModuleInstalled.mockReturnValue({
      areModulesInstalled: false,
      isCheckingModules: false,
      moduleCheckError: new Error('Failed to fetch modules'),
    });

    const { result } = renderHook(() => useOrderPrice('test-uuid-2'));

    expect(result.current.data).toBeNull();
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });
});
