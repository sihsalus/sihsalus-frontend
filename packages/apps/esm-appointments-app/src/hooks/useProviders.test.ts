import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';

import { useProviders } from './useProviders';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  __esModule: true,
  default: vi.fn(),
}));

const mockUseSWR = vi.mocked(useSWR);

describe('useProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests provider category attributes and exposes the provider list', () => {
    const providers = [
      {
        uuid: 'provider-uuid',
        display: 'Cirujano dentista - Rosa Flores',
        attributes: [
          {
            uuid: 'attribute-uuid',
            attributeType: { uuid: 'category-attribute-type-uuid' },
            value: 'dental-category-uuid',
          },
        ],
      },
    ];
    mockUseSWR.mockReturnValue({
      data: { data: { results: providers } },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useProviders());

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/ws/rest/v1/provider?v=custom:(uuid,display,person:(uuid,display),attributes:(uuid,value,attributeType:(uuid),voided))',
      openmrsFetch,
    );
    expect(result.current.providers).toEqual(providers);
  });

  it('returns an empty list while no response is available', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
