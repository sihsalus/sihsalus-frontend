import { useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';

import { useProviders } from './useProviders';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  restBaseUrl: '/ws/rest/v1',
  useOpenmrsFetchAll: vi.fn(),
}));

const mockUseOpenmrsFetchAll = vi.mocked(useOpenmrsFetchAll);

describe('useProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads every provider page before exposing the complete provider list', () => {
    const providers = Array.from({ length: 101 }, (_, index) => ({
      uuid: `provider-${index + 1}`,
      display: `Personal de salud ${index + 1}`,
      attributes:
        index === 100
          ? [
              {
                uuid: 'attribute-uuid',
                attributeType: { uuid: 'category-attribute-type-uuid' },
                value: 'dental-category-uuid',
              },
            ]
          : [],
    }));
    mockUseOpenmrsFetchAll.mockReturnValue({
      data: providers,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never);

    const { result } = renderHook(() => useProviders());

    expect(mockUseOpenmrsFetchAll).toHaveBeenCalledWith(
      '/ws/rest/v1/provider?v=custom:(uuid,display,person:(uuid,display),attributes:(uuid,value,attributeType:(uuid),voided))&limit=100&totalCount=true',
    );
    expect(result.current.providers).toEqual(providers);
    expect(result.current.providers).toContainEqual(expect.objectContaining({ uuid: 'provider-101' }));
  });

  it('returns an empty list until every page has loaded', () => {
    mockUseOpenmrsFetchAll.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
    } as never);

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
