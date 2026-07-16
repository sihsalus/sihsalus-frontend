import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { type PharmacyConfig } from '../../config-schema';
import { useDispenseStock } from './stock.resource';

vi.mock('swr');

const mockUseConfig = vi.mocked(useConfig<PharmacyConfig>);
const mockUseSWR = vi.mocked(useSWR);

describe('useDispenseStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false } as ReturnType<typeof useSWR>);
  });

  it('loads inventory from the configured operational pharmacy location', () => {
    mockUseConfig.mockReturnValue({ dispensingLocationUuid: 'pharmacy-location-uuid' } as PharmacyConfig);

    renderHook(() => useDispenseStock('drug-uuid'));

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('dispenseLocationUuid=pharmacy-location-uuid'),
      openmrsFetch,
    );
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('emptyBatchLocationUuid=pharmacy-location-uuid'),
      openmrsFetch,
    );
  });

  it('does not query inventory when the operational pharmacy location is missing', () => {
    mockUseConfig.mockReturnValue({ dispensingLocationUuid: '' } as PharmacyConfig);

    renderHook(() => useDispenseStock('drug-uuid'));

    expect(mockUseSWR).toHaveBeenCalledWith(null, openmrsFetch);
  });
});
