import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import {
  type ConditionSearchResponse,
  createCondition,
  createConditionsPageFetcher,
  deleteCondition,
  isUnconfirmedConditionWriteError,
  syncConditionCache,
  updateCondition,
  usePatientConditions,
} from './conditions.resource';
import type { OpenmrsCondition } from './conditions.types';

vi.mock('@openmrs/esm-framework', () => {
  // Exercise the complete-history reader and real SWR cache; only replace the network boundary.
  return {
    restBaseUrl: '/ws/rest/v1',
    omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-strategy',
    makeUrl: (url: string) => (url.startsWith('http') ? url : `/openmrs${url}`),
    openmrsFetch: vi.fn(),
  };
});

const fetchMock = vi.mocked(openmrsFetch);
const resource = (uuid = 'condition-a', patient = 'patient-a'): OpenmrsCondition => ({
  uuid,
  patient: { uuid: patient },
  clinicalStatus: 'ACTIVE',
  condition: { coded: { uuid: 'concept-a', display: 'Synthetic antecedent' } },
  voided: false,
});
const response = (data: unknown) => ({ data }) as FetchResponse<ConditionSearchResponse>;
const page = (resources: OpenmrsCondition[], next?: string, totalCount?: number) => ({
  results: resources,
  totalCount,
  ...(next ? { links: [{ rel: 'next', uri: next }] } : {}),
});
function wrapper({ children }: PropsWithChildren) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('complete condition history through SWR and the REST pagination protocol', () => {
  it('requests active and inactive history and retains every REST clinical status', async () => {
    const statuses = ['ACTIVE', 'RECURRENCE', 'RELAPSE', 'INACTIVE', 'REMISSION', 'RESOLVED', 'UNKNOWN'];
    fetchMock.mockResolvedValue(
      response(page(statuses.map((clinicalStatus, index) => ({ ...resource(`condition-${index}`), clinicalStatus })))),
    );
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.conditions).toHaveLength(statuses.length));
    const request = new URL(String(fetchMock.mock.calls[0][0]));
    expect(request.pathname).toBe('/openmrs/ws/rest/v1/condition');
    expect(Object.fromEntries(request.searchParams)).toEqual({
      patientUuid: 'patient-a',
      includeInactive: 'true',
      v: 'full',
      limit: '100',
      totalCount: 'true',
    });
    expect(result.current.conditions?.map(({ clinicalStatus }) => clinicalStatus.toUpperCase())).toEqual(statuses);
  });

  it('rejects totals that change between pages even if the final length matches the first total', async () => {
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?startIndex=1', 2)))
      .mockResolvedValueOnce(response(page([resource('condition-b')], undefined, 3)));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.conditions).toBeNull();
  });
  it('loads more than 100 records, relative/proxy pagination and a missing total, without exposing partial history', async () => {
    let finishLastPage!: (value: FetchResponse<ConditionSearchResponse>) => void;
    const finalPage = new Promise<FetchResponse<ConditionSearchResponse>>((resolve) => {
      finishLastPage = resolve;
    });
    fetchMock
      .mockResolvedValueOnce(
        response(
          page(
            Array.from({ length: 100 }, (_, i) => resource(`condition-${i}`)),
            'https://backend.test/openmrs/ws/rest/v1/condition?page=2',
          ),
        ),
      )
      .mockResolvedValueOnce(
        response(
          page(
            Array.from({ length: 100 }, (_, i) => resource(`condition-${i + 100}`)),
            '?page=3',
          ),
        ),
      )
      .mockImplementationOnce(() => finalPage);
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(result.current.conditions).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(window.location.host);
    await act(async () => {
      finishLastPage(response(page(Array.from({ length: 5 }, (_, i) => resource(`condition-${i + 200}`)))));
    });
    await waitFor(() => expect(result.current.conditions).toHaveLength(205));
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('distinguishes an empty result set from loading and failure', async () => {
    fetchMock.mockResolvedValue(response({ results: [], totalCount: 0 }));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.conditions).toEqual([]));
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not request records or remain loading without a patient', () => {
    const { result } = renderHook(() => usePatientConditions(''), { wrapper });
    expect(result.current.conditions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides incomplete history when a later page fails', async () => {
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?page=2', 2)))
      .mockRejectedValueOnce(new Error('Synthetic network failure'));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.conditions).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    {},
    { results: [{}] },
    { results: 'malformed' },
    { results: [], totalCount: -1 },
    { results: [], links: [null] },
    page([resource('condition-b', 'patient-b')]),
    page([resource()], undefined, 2),
    page([{ ...resource(), condition: { coded: 42 } } as unknown as OpenmrsCondition]),
    page([{ ...resource(), additionalDetail: {} } as unknown as OpenmrsCondition]),
    page([{ ...resource(), voided: true }]),
    page([{ ...resource(), onsetDate: 'invalid date' }]),
    page([{ ...resource(), clinicalStatus: 42 } as unknown as OpenmrsCondition]),
  ])('reports malformed, foreign-patient or truncated responses as errors %#', async (bundle) => {
    fetchMock.mockResolvedValue(response(bundle));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.conditions).toBeNull();
  });

  it('detects a server pagination cycle without repeated requests or an endless loading state', async () => {
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?page=2')))
      .mockResolvedValueOnce(response(page([resource('condition-b')], '?page=3')))
      .mockResolvedValueOnce(response(page([resource('condition-c')], '?page=2')));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.conditions).toBeNull();
  });

  it('rejects pages that repeat the same records behind endlessly changing continuation URLs', async () => {
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?startIndex=100')))
      .mockResolvedValueOnce(response(page([resource()], '?startIndex=200')));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.conditions).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('rejects a continuation after the declared total has already been exceeded', async () => {
    fetchMock.mockResolvedValueOnce(response(page([resource(), resource('condition-b')], '?startIndex=100', 1)));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.conditions).toBeNull();
  });

  it.each([
    'https://backend.test/admin',
    'javascript:alert(1)',
    'https://user:password@backend.test/openmrs/ws/rest/v1/condition',
    'https://backend.test/openmrs/ws/rest/v1/patient',
    '?patientUuid=patient-b',
  ])('rejects invalid continuation links before following them: %s', async (next) => {
    fetchMock.mockResolvedValue(response(page([resource()], next)));
    await expect(
      createConditionsPageFetcher('patient-a')('/ws/rest/v1/condition?patientUuid=patient-a'),
    ).rejects.toThrow(/pagination link/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores an old patient response after the selected patient changes', async () => {
    let finishOld!: (value: FetchResponse<ConditionSearchResponse>) => void;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce(response(page([resource('condition-b', 'patient-b')])));
    const { result, rerender } = renderHook(({ patient }) => usePatientConditions(patient), {
      initialProps: { patient: 'patient-a' },
      wrapper,
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ patient: 'patient-b' });
    await waitFor(() => expect(result.current.conditions?.[0]?.id).toBe('condition-b'));
    await act(async () => {
      finishOld(response(page([resource()])));
    });
    expect(result.current.conditions?.map((condition) => condition.id)).toEqual(['condition-b']);
  });

  it('refreshes all pages after an update with a replacement UUID and a shorter result set', async () => {
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?page=2', 2)))
      .mockResolvedValueOnce(response(page([resource('condition-b')], undefined, 2)));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.conditions).toHaveLength(2));
    fetchMock.mockResolvedValue(response(page([resource('replacement')], undefined, 1)));
    await act(async () => {
      await syncConditionCache(result.current.mutate);
    });
    await waitFor(() => expect(result.current.conditions?.map((condition) => condition.id)).toEqual(['replacement']));
  });

  it('waits for a newly introduced page when a confirmed create crosses the page-size boundary', async () => {
    const existing = Array.from({ length: 100 }, (_, i) => resource(`condition-${i}`));
    fetchMock.mockResolvedValueOnce(response(page(existing, undefined, 100)));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.conditions).toHaveLength(100));
    let finishAddedPage!: (value: FetchResponse<ConditionSearchResponse>) => void;
    fetchMock.mockResolvedValueOnce(response(page(existing, '?page=2', 101))).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishAddedPage = resolve;
        }),
    );
    let refreshCompleted = false;
    let refresh!: Promise<void>;
    act(() => {
      refresh = syncConditionCache(result.current.mutate).then(() => {
        refreshCompleted = true;
      });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(refreshCompleted).toBe(false);
    await act(async () => {
      finishAddedPage(response(page([resource('condition-100')], undefined, 101)));
      await refresh;
    });
    expect(refreshCompleted).toBe(true);
    expect(result.current.conditions).toHaveLength(101);
  });

  it('rejects the whole refresh when a newly introduced page fails after a confirmed create', async () => {
    fetchMock.mockResolvedValueOnce(response(page([resource()], undefined, 1)));
    const { result } = renderHook(() => usePatientConditions('patient-a'), { wrapper });
    await waitFor(() => expect(result.current.conditions).toHaveLength(1));
    fetchMock
      .mockResolvedValueOnce(response(page([resource()], '?page=2', 2)))
      .mockRejectedValueOnce(new Error('New page unavailable'));
    await act(async () => {
      await expect(syncConditionCache(result.current.mutate)).rejects.toThrow('New page unavailable');
    });
    // Failed refresh does not replace the last complete snapshot with partial results.
    expect(result.current.conditions?.map((condition) => condition.id)).toEqual(['condition-a']);
  });
});

describe('condition write boundary', () => {
  const fields = {
    patientId: 'patient-a',
    providerUuid: 'provider-a',
    conceptId: 'concept-a',
    display: 'Synthetic antecedent',
    clinicalStatus: 'inactive',
  };

  describe.each(['create', 'update', 'delete'] as const)('%s acknowledgement', (operation) => {
    it.each([
      [new TypeError('Synthetic lost response'), true],
      [new DOMException('Synthetic timeout', 'TimeoutError'), true],
      [{ response: { status: 500 } }, true],
      [{ status: 503 }, true],
      [{ statusCode: 408 }, true],
      [{ response: { status: 400 } }, false],
      [{ response: { status: 401 } }, false],
      [{ status: 403 }, false],
      [{ response: { status: 409 } }, false],
      [{ response: { status: 429 } }, false],
    ])('classifies a rejected write without promising that it did not persist %#', async (failure, uncertain) => {
      if (operation !== 'create') fetchMock.mockResolvedValueOnce(response(resource()));
      fetchMock.mockRejectedValueOnce(failure);
      const request =
        operation === 'create'
          ? createCondition(fields)
          : operation === 'update'
            ? updateCondition('condition-a', { ...fields, originalCondition: resource() })
            : deleteCondition('condition-a', 'patient-a', 'Synthetic removal reason');
      if (uncertain) {
        await expect(request).rejects.toMatchObject({
          code: 'CONDITION_WRITE_UNCONFIRMED',
          message: 'The condition write could not be confirmed.',
        });
      } else {
        await expect(request).rejects.toBe(failure);
      }
      expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({
        method: operation === 'delete' ? 'DELETE' : 'POST',
        rejectOnAuthFailure: true,
      });
    });
  });

  describe.each(['update', 'delete'] as const)('%s preflight', (operation) => {
    it.each([
      new TypeError('Synthetic GET offline'),
      { response: { status: 500 } },
    ])('does not classify a failed preflight GET as an uncertain write %#', async (failure) => {
      fetchMock.mockRejectedValueOnce(failure);
      const request =
        operation === 'update'
          ? updateCondition('condition-a', { ...fields, originalCondition: resource() })
          : deleteCondition('condition-a', 'patient-a', 'Synthetic removal reason');
      await expect(request).rejects.toBe(failure);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
    });
  });

  it('recognizes only the fixed uncertainty code without inspecting technical message contents', () => {
    expect(isUnconfirmedConditionWriteError({ code: 'CONDITION_WRITE_UNCONFIRMED' })).toBe(true);
    expect(isUnconfirmedConditionWriteError(new Error('CONDITION_WRITE_UNCONFIRMED'))).toBe(false);
    expect(isUnconfirmedConditionWriteError({ code: 'CONDITION_CHANGED' })).toBe(false);
    expect(isUnconfirmedConditionWriteError(null)).toBe(false);
  });
  it('rejects invalid identity and path inputs before making requests', async () => {
    const fields = {
      patientId: 'patient-a',
      providerUuid: 'provider-a',
      clinicalStatus: 'active',
      conceptId: 'concept-a',
      display: 'Synthetic antecedent',
    };
    await expect(updateCondition('condition-a', fields)).rejects.toThrow();
    await expect(createCondition({ ...fields, patientId: '../patient-b' })).rejects.toThrow();
    await expect(deleteCondition('../condition-b', 'patient-a', 'Synthetic removal reason')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates refresh errors distinctly from the successful write', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('Refresh failed'));
    await expect(syncConditionCache(mutate)).rejects.toThrow('Refresh failed');
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a stale edit before a REST correction instead of overwriting a newer clinical record', async () => {
    const original = resource();
    fetchMock.mockResolvedValueOnce(response({ ...original, additionalDetail: 'Another editor changed this record' }));
    await expect(
      updateCondition(original.uuid, {
        patientId: 'patient-a',
        providerUuid: 'provider-a',
        conceptId: 'concept-a',
        display: 'Synthetic antecedent',
        clinicalStatus: 'inactive',
        originalCondition: original,
      }),
    ).rejects.toMatchObject({ code: 'CONDITION_CHANGED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'x-omrs-offline-strategy': 'network-only-or-cache-only' },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/condition\/condition-a\?v=full&_=/);
  });

  it('updates only after a fresh read confirms the source and patient', async () => {
    const original = resource();
    fetchMock.mockResolvedValueOnce(response(original)).mockResolvedValueOnce(response(original));
    await updateCondition(original.uuid, {
      patientId: 'patient-a',
      providerUuid: 'provider-a',
      conceptId: 'concept-a',
      display: 'Synthetic antecedent',
      clinicalStatus: 'inactive',
      originalCondition: original,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: { clinicalStatus: 'INACTIVE' },
    });
  });

  it('does not mistake translated labels or context links for another clinical revision', async () => {
    const original = resource();
    fetchMock
      .mockResolvedValueOnce(
        response({
          ...original,
          patient: { ...original.patient, display: 'Synthetic translated patient label' },
          condition: { coded: { uuid: 'concept-a', display: 'Synthetic translated concept' } },
          links: [{ rel: 'self', uri: 'https://backend.test/condition/condition-a' }],
        }),
      )
      .mockResolvedValueOnce(response(original));
    await updateCondition(original.uuid, {
      patientId: 'patient-a',
      providerUuid: 'provider-a',
      conceptId: 'concept-a',
      display: 'Synthetic antecedent',
      clinicalStatus: 'inactive',
      originalCondition: original,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toEqual({ clinicalStatus: 'INACTIVE' });
  });

  it('detects a changed audit identity even when the visible clinical fields still match', async () => {
    const original = resource();
    fetchMock.mockResolvedValueOnce(
      response({
        ...original,
        auditInfo: { changedBy: { uuid: 'another-editor' }, dateChanged: '2026-01-01T00:00:00.000Z' },
      }),
    );
    await expect(
      updateCondition(original.uuid, {
        patientId: 'patient-a',
        providerUuid: 'provider-a',
        conceptId: 'concept-a',
        display: 'Synthetic antecedent',
        clinicalStatus: 'inactive',
        originalCondition: original,
      }),
    ).rejects.toMatchObject({ code: 'CONDITION_CHANGED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verifies ownership freshly before deleting and fails closed when the read is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(response(resource('condition-a', 'patient-b')));
    await expect(deleteCondition('condition-a', 'patient-a', '  Synthetic correction & duplicate?  ')).rejects.toThrow(
      /current patient/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    await expect(deleteCondition('condition-a', 'patient-a', '  Synthetic correction & duplicate?  ')).rejects.toThrow(
      'Offline',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'DELETE')).toBe(true);
  });

  it.each([
    '',
    '   ',
    'x'.repeat(256),
  ])('rejects missing or excessive deletion reasons before any request %#', async (reason) => {
    await expect(deleteCondition('condition-a', 'patient-a', reason)).rejects.toThrow(/valid reason/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes a matching condition after a fresh GET, using a distinct read nonce for each attempt', async () => {
    fetchMock.mockResolvedValue(response(resource()));
    await deleteCondition('condition-a', 'patient-a', '  Synthetic correction & duplicate?  ');
    await deleteCondition('condition-a', 'patient-a', '  Synthetic correction & duplicate?  ');
    expect(fetchMock.mock.calls[0]?.[0]).not.toBe(fetchMock.mock.calls[2]?.[0]);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ method: 'DELETE', rejectOnAuthFailure: true });
    expect(fetchMock.mock.calls[3]?.[1]).toEqual({ method: 'DELETE', rejectOnAuthFailure: true });
    const deletion = new URL(String(fetchMock.mock.calls[1][0]), window.location.href);
    expect(deletion.searchParams.get('reason')).toBe('Synthetic correction & duplicate?');
    expect(deletion.searchParams.has('purge')).toBe(false);
  });
});
