import { renderHook } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import useLocation from './useLocation';
import useWardLocation from './useWardLocation';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
}));
vi.mock('./useLocation', () => ({ default: vi.fn() }));

const mockUseParams = vi.mocked(useParams);
const mockUseLocation = useLocation as vi.Mock;

describe('useWardLocation', () => {
  it('does not treat the login facility as a ward when no location is provided', async () => {
    mockUseParams.mockReturnValue({});
    mockUseLocation.mockReturnValue({
      data: null,
      error: null,
      isLoading: null,
      isValidating: null,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location).toBeUndefined();
  });

  it('returns location from useLocation when locationUuidFromUrl is provided', async () => {
    mockUseParams.mockReturnValue({ locationUuid: 'some-location-uuid' });
    mockUseLocation.mockReturnValue({
      data: {
        data: {
          display: 'Test Location',
          name: 'Test Location',
          tags: [{ uuid: 'admission-location-tag', display: 'Admission Location' }],
          uuid: 'test-location-uuid',
        },
      },
      error: null,
      isLoading: false,
      isValidating: null,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());

    expect(result.current.location).toEqual({
      display: 'Test Location',
      name: 'Test Location',
      tags: [{ uuid: 'admission-location-tag', display: 'Admission Location' }],
      uuid: 'test-location-uuid',
    });
    expect(result.current.invalidLocation).toBeFalsy();
  });

  it('handles loading state correctly', async () => {
    mockUseParams.mockReturnValue({ locationUuid: 'uuid' });
    mockUseLocation.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());
    expect(result.current.isLoadingLocation).toBe(true);
  });

  it('handles error state correctly when fetching location fails', async () => {
    const error = new Error('Error fetching location');
    mockUseParams.mockReturnValue({ locationUuid: 'uuid' });
    mockUseLocation.mockReturnValue({
      data: null,
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());
    expect(result.current.errorFetchingLocation).toBe(error);
  });

  it('identifies invalid location correctly', async () => {
    const error = new Error('Error fetching location');
    mockUseParams.mockReturnValue({ locationUuid: 'uuid' });
    mockUseLocation.mockReturnValue({
      data: null,
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());
    expect(result.current.invalidLocation).toBeTruthy();
  });

  it('rejects a location that is not an Admission Location', () => {
    mockUseParams.mockReturnValue({ locationUuid: 'hospital-uuid' });
    mockUseLocation.mockReturnValue({
      data: {
        data: {
          display: 'Hospital Santa Clotilde',
          tags: [{ uuid: 'facility-location-tag', display: 'Facility Location' }],
          uuid: 'hospital-uuid',
        },
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useWardLocation());

    expect(result.current.location).toBeUndefined();
    expect(result.current.invalidLocation).toBe(true);
  });
});
