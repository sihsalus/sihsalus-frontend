import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useConditionConceptSet, useConditionsSearchFromConceptSet } from './condition-concept-set.resource';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1' }));

const fetchMock = vi.mocked(openmrsFetch);
const response = (data: unknown) => ({ data }) as FetchResponse<unknown>;
const catalog = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'synthetic-set',
  set: true,
  retired: false,
  setMembers: [],
  ...overrides,
});
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
    {children}
  </SWRConfig>
);

beforeEach(() => {
  fetchMock.mockReset();
});

describe('shared condition concept sets', () => {
  it('distinguishes pending metadata from an empty configured set', async () => {
    let finish!: (value: FetchResponse<unknown>) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useConditionConceptSet('synthetic-set'), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.conceptSet).toBeNull();

    await act(async () => {
      finish(response(catalog()));
    });

    await waitFor(() => expect(result.current.conceptSet?.setMembers).toEqual([]));
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('supports alternate name shapes and deduplicates selected concepts by UUID', async () => {
    fetchMock.mockResolvedValue(
      response(
        catalog({
          setMembers: [
            { uuid: 'synthetic-a', display: 'Synthetic main label', retired: false, name: { name: 'Alias uno' } },
            { uuid: 'synthetic-a', retired: false, name: { display: 'Alias dos' } },
            { uuid: 'synthetic-b', retired: false, name: { name: 'Synthetic fallback label' } },
          ],
        }),
      ),
    );
    const { result, rerender } = renderHook(({ term }) => useConditionsSearchFromConceptSet(term, 'synthetic-set'), {
      initialProps: { term: ' SYNTHETIC ' },
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.searchResults).toEqual([
        { uuid: 'synthetic-a', display: 'Synthetic main label' },
        { uuid: 'synthetic-b', display: 'Synthetic fallback label' },
      ]),
    );

    rerender({ term: 'alias dos' });
    expect(result.current.searchResults).toEqual([{ uuid: 'synthetic-a', display: 'Synthetic main label' }]);
  });

  it('preserves nameless and retired UUIDs for history without offering them for new entries', async () => {
    fetchMock.mockResolvedValue(
      response(
        catalog({
          setMembers: [
            { uuid: 'synthetic-unnamed', retired: false },
            { uuid: 'synthetic-retired', display: 'Synthetic retired label', retired: true },
            { uuid: 'synthetic-unverified', display: 'Synthetic retirement unknown' },
            { uuid: 'synthetic-invalid-name', retired: false, name: { display: 123 } },
            { uuid: 'synthetic-valid', display: 'Synthetic valid label', name: null, retired: false },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useConditionsSearchFromConceptSet('synthetic', 'synthetic-set'), { wrapper });

    await waitFor(() => expect(result.current.conceptSet?.setMembers).toHaveLength(5));
    expect(result.current.searchResults).toEqual([{ uuid: 'synthetic-valid', display: 'Synthetic valid label' }]);
    expect(result.current.error).toBeUndefined();
  });

  it('keeps a retired set readable and reports that it cannot supply new selections', async () => {
    fetchMock.mockResolvedValue(
      response(
        catalog({
          retired: true,
          setMembers: [{ uuid: 'synthetic-member', display: 'Synthetic label', retired: false }],
        }),
      ),
    );
    const { result } = renderHook(() => useConditionsSearchFromConceptSet('synthetic', 'synthetic-set'), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.conceptSet?.setMembers[0]?.uuid).toBe('synthetic-member');
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it.each([
    null,
    catalog({ uuid: 'synthetic-different-set' }),
    catalog({ set: false }),
    catalog({ retired: 'false' }),
    catalog({ setMembers: undefined }),
    catalog({ setMembers: {} }),
    catalog({ setMembers: [null] }),
    catalog({ setMembers: [{ display: 'Synthetic missing UUID' }] }),
    catalog({ setMembers: [{ uuid: 'synthetic-member', retired: 'false' }] }),
  ])('reports malformed or mismatched metadata without exposing partial suggestions %#', async (value) => {
    fetchMock.mockResolvedValue(response(value));
    const { result } = renderHook(() => useConditionsSearchFromConceptSet('synthetic', 'synthetic-set'), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.conceptSet).toBeNull();
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', '../synthetic-set'])('does not request an absent or invalid concept-set identifier %s', (uuid) => {
    const { result } = renderHook(() => useConditionConceptSet(uuid), { wrapper });
    expect(result.current.error).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces denied metadata access without treating the catalog as empty', async () => {
    const denied = Object.assign(new Error('Synthetic denied request'), { status: 403 });
    fetchMock.mockRejectedValue(denied);
    const { result } = renderHook(() => useConditionConceptSet('synthetic-set'), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(denied));
    expect(result.current.conceptSet).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { rejectOnAuthFailure: true });
  });

  it('does not replace a new configured set with a late response for the old set', async () => {
    let finishOld!: (value: FetchResponse<unknown>) => void;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce(response(catalog({ uuid: 'synthetic-new-set' })));
    const { result, rerender } = renderHook(({ uuid }) => useConditionConceptSet(uuid), {
      initialProps: { uuid: 'synthetic-set' },
      wrapper,
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ uuid: 'synthetic-new-set' });
    await waitFor(() => expect(result.current.conceptSet?.uuid).toBe('synthetic-new-set'));
    await act(async () => {
      finishOld(response(catalog()));
    });
    expect(result.current.conceptSet?.uuid).toBe('synthetic-new-set');
  });
});
