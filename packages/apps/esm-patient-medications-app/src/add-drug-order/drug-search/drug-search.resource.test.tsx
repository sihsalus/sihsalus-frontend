import { logError, openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { mockDrugSearchResultApiData } from 'test-utils';
import { useConceptSets, useConceptTree, useDrugSearch, useDrugsByConcepts } from './drug-search.resource';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;
const mockLogError = vi.mocked(logError);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

describe('useConceptSets', () => {
  test('returns an empty array when no UUIDs are provided', () => {
    const { result } = renderHook(() => useConceptSets([]), { wrapper });

    expect(result.current.conceptSets).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  test('returns concept sets on successful fetch', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        'uuid-1': { uuid: 'uuid-1', display: 'Analgesics' },
        'uuid-2': { uuid: 'uuid-2', display: 'Antibiotics' },
      },
    });

    const { result } = renderHook(() => useConceptSets(['uuid-1', 'uuid-2']), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.conceptSets).toEqual([
      { uuid: 'uuid-1', display: 'Analgesics' },
      { uuid: 'uuid-2', display: 'Antibiotics' },
    ]);
    expect(result.current.error).toBeUndefined();
  });

  test('returns an error on failed fetch', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useConceptSets(['uuid-1']), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.conceptSets).toEqual([]);
  });
});

describe('useDrugSearch', () => {
  test('combines direct drug matches with formulations found through OCL concept names and aliases', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: { results: [mockDrugSearchResultApiData[0]] },
      })
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'concept-alias-uuid', display: 'Acetylsalicylic acid' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [mockDrugSearchResultApiData[0], mockDrugSearchResultApiData[1]],
        },
      });

    const { result } = renderHook(() => useDrugSearch('aspirin'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.drugs).toHaveLength(2);
    expect(result.current.partialErrors).toEqual([]);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/concept?q=aspirin&class=Drug'));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/drug?concepts=concept-alias-uuid'));
  });

  test('encodes the search term sent to both REST resources', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } }).mockResolvedValueOnce({ data: { results: [] } });

    const { result } = renderHook(() => useDrugSearch('ácido ursodesoxicólico'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('q=%C3%A1cido%20ursodesoxic%C3%B3lico'));
    expect(result.current.drugs).toEqual([]);
  });

  test('keeps direct drug results when the optional concept-alias search is unavailable', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: { results: [mockDrugSearchResultApiData[0]] },
      })
      .mockRejectedValueOnce(new Error('Concept search unavailable'));

    const { result } = renderHook(() => useDrugSearch('aspirin'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeUndefined();
    expect(result.current.drugs).toEqual([mockDrugSearchResultApiData[0]]);
    expect(result.current.partialErrors).toEqual([expect.objectContaining({ message: 'Concept search unavailable' })]);
  });

  test('reports an error instead of a false empty catalog when alias lookup is unavailable', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockRejectedValueOnce(new Error('Concept search unavailable'));

    const { result } = renderHook(() => useDrugSearch('ursodiol'), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.drugs).toBeUndefined();
    expect(result.current.error).toEqual(expect.objectContaining({ message: 'Concept search unavailable' }));
  });
});

describe('useConceptTree', () => {
  test('returns null tree when no UUID is provided', () => {
    const { result } = renderHook(() => useConceptTree(null), { wrapper });

    expect(result.current.tree).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  test('returns tree data on successful fetch', async () => {
    const mockTree = {
      uuid: 'set-uuid',
      display: 'Analgesics',
      isSet: true,
      setMembers: [
        { uuid: 'child-1', display: 'Aspirin', isSet: false },
        { uuid: 'child-2', display: 'Ibuprofen', isSet: false },
      ],
    };

    mockOpenmrsFetch.mockResolvedValueOnce({ data: mockTree });

    const { result } = renderHook(() => useConceptTree('set-uuid'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tree).toEqual(mockTree);
    expect(result.current.error).toBeUndefined();
  });

  test('returns an error on failed fetch', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useConceptTree('bad-uuid'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.tree).toBeUndefined();
  });
});

describe('useDrugsByConcepts', () => {
  test('returns empty results when no concepts are provided', () => {
    const { result } = renderHook(() => useDrugsByConcepts([]), { wrapper });

    expect(result.current.drugs).toEqual([]);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('returns drugs on successful fetch', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: mockDrugSearchResultApiData },
    });

    const { result } = renderHook(() => useDrugsByConcepts(['concept-uuid-1']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.drugs).toHaveLength(3);
    expect(result.current.drugs[0].display).toBe('Aspirin 81mg');
    expect(result.current.errors).toEqual([]);
  });

  test('deduplicates drugs with the same UUID', async () => {
    const duplicatedDrug = mockDrugSearchResultApiData[0];

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [duplicatedDrug, duplicatedDrug, mockDrugSearchResultApiData[1]],
      },
    });

    const { result } = renderHook(() => useDrugsByConcepts(['concept-uuid-1']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.drugs).toHaveLength(2);
  });

  test('collects errors from failed batches while returning successful results', async () => {
    // Generate 21 concept UUIDs to trigger two batches (max 20 per batch)
    const concepts = Array.from({ length: 21 }, (_, i) => `concept-${i}`);

    // First batch succeeds, second batch fails
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [mockDrugSearchResultApiData[0]] },
    });
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('Batch failed'));

    const { result } = renderHook(() => useDrugsByConcepts(concepts), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.drugs).toHaveLength(1);
    expect(result.current.drugs[0].display).toBe('Aspirin 81mg');
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].message).toBe('Batch failed');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Batch failed' }),
      'Fetch medications linked to matching concepts',
    );
  });

  test('paginates when results fill the page size', async () => {
    // Create 50 fake drugs to fill the first page
    const fullPage = Array.from({ length: 50 }, (_, i) => ({
      ...mockDrugSearchResultApiData[0],
      uuid: `drug-page1-${i}`,
      display: `Drug ${i}`,
    }));

    const secondPage = [
      {
        ...mockDrugSearchResultApiData[1],
        uuid: 'drug-page2-0',
        display: 'Drug 50',
      },
    ];

    // First call returns full page (triggers pagination), second returns partial page (stops)
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: fullPage } });
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: secondPage } });

    const { result } = renderHook(() => useDrugsByConcepts(['concept-uuid-1']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.drugs).toHaveLength(51);
    expect(result.current.errors).toEqual([]);
  });
});
