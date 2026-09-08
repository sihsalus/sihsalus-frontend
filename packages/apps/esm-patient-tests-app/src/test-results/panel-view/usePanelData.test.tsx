import { usePatient } from '@openmrs/esm-framework';
import { cleanup, renderHook } from '@testing-library/react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

import usePanelData from './usePanelData';

vi.mock('swr');
vi.mock('swr/infinite');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('full Results viewer consuming shared observation ranges', () => {
  it.each([
    [{ low: { value: 0 }, high: { value: 10 } }, '0 – 10'],
    [{ high: { value: 10 } }, '≤ 10'],
  ])('uses an untyped observation range: %j', (range, display) => {
    vi.mocked(usePatient).mockReturnValue({ patientUuid: 'synthetic-patient' } as ReturnType<typeof usePatient>);
    const observation = {
      resourceType: 'Observation',
      id: 'synthetic-observation',
      status: 'final',
      code: { coding: [{ code: 'synthetic-concept', display: 'Synthetic test' }] },
      effectiveDateTime: '2026-09-08T10:00:00Z',
      valueQuantity: { value: 50, unit: 'U/L' },
      referenceRange: [range],
    };
    const concept = {
      uuid: 'synthetic-concept',
      display: 'Synthetic test',
      conceptClass: { display: 'Test' },
      datatype: { display: 'Numeric' },
      units: 'U/L',
      lowNormal: 0,
      hiNormal: 100,
    };
    vi.mocked(useSWRInfinite).mockImplementation((getKey) => {
      const url = getKey(0, null);
      const data = url.includes('/Observation') ? { entry: [{ resource: observation }], link: [] } : concept;
      return { data: [{ data }], size: 1, setSize: vi.fn(), isLoading: false } as ReturnType<typeof useSWRInfinite>;
    });
    vi.mocked(useSWR).mockReturnValue({ data: { data: { results: [] } } } as ReturnType<typeof useSWR>);
    const { result } = renderHook(() => usePanelData());
    expect(result.current.panels).toHaveLength(1);
    expect(result.current.panels[0].meta.range).toBe(display);
    expect(result.current.panels[0].interpretation).toBe('HIGH');
  });
});
