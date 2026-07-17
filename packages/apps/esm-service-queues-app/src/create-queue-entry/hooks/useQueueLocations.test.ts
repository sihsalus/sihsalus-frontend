import { fhirBaseUrl, useFhirFetchAll } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { isVisitLocation, useQueueLocations } from './useQueueLocations';

const mockUseFhirFetchAll = vi.mocked(useFhirFetchAll);

describe('useQueueLocations', () => {
  beforeEach(() => {
    mockUseFhirFetchAll.mockReset();
  });

  it('loads all pages of queue locations and sorts the combined result', () => {
    mockUseFhirFetchAll.mockReturnValue({
      data: [
        { resourceType: 'Location', id: 'second-page-location', name: 'Triaje' },
        { resourceType: 'Location', id: 'first-page-location', name: 'Admisión' },
      ],
      error: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useFhirFetchAll<fhir.Location>>);

    const { result } = renderHook(() => useQueueLocations());

    expect(mockUseFhirFetchAll).toHaveBeenCalledWith(`${fhirBaseUrl}/Location?_summary=data&_tag=queue location`, {
      immutable: true,
    });
    expect(result.current.queueLocations.map((location) => location.id)).toEqual([
      'first-page-location',
      'second-page-location',
    ]);
  });

  it('preserves loading and error state while no complete result is available', () => {
    const error = new Error('Unable to load queue locations');
    mockUseFhirFetchAll.mockReturnValue({
      data: undefined,
      error,
      isLoading: true,
    } as unknown as ReturnType<typeof useFhirFetchAll<fhir.Location>>);

    const { result } = renderHook(() => useQueueLocations());

    expect(result.current.queueLocations).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(error);
  });
});

describe('isVisitLocation', () => {
  it.each([
    { resourceType: 'Location', meta: { tag: [{ code: ' VISIT LOCATION ' }] } },
    { resourceType: 'Location', meta: { tag: [{ name: 'Visit Location' }] } },
  ] as Array<fhir.Location>)('recognizes the Visit Location tag by code or name regardless of case', (location) => {
    expect(isVisitLocation(location)).toBe(true);
  });

  it('does not classify a queue-only location as a visit location', () => {
    const location = {
      resourceType: 'Location',
      meta: { tag: [{ code: 'Queue Location' }] },
    } as fhir.Location;

    expect(isVisitLocation(location)).toBe(false);
  });
});
