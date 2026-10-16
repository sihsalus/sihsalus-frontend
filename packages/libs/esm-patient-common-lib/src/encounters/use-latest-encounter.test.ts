import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import type { OpenmrsEncounter } from '../encounter-list/types';
import { useLatestValidEncounter } from './use-latest-encounter';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...actual,
    useOpenmrsFetchAll: (await import('../../../esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
    openmrsFetch: vi.fn(),
    restBaseUrl: '/ws/rest/v1',
  };
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const swrWrapper = ({ children }: PropsWithChildren) =>
  createElement(
    SWRConfig,
    {
      value: {
        dedupingInterval: 0,
        provider: () => new Map(),
        shouldRetryOnError: false,
      },
    },
    children,
  );

function createEncounter(
  uuid: string,
  encounterDatetime: string,
  form?: { uuid: string; name: string; display?: string },
): OpenmrsEncounter {
  return {
    uuid,
    encounterDatetime,
    encounterType: { uuid: 'encounter-type-uuid', display: 'Encounter type' },
    form,
    location: 'location-uuid',
    obs: [],
    patient: 'patient-uuid',
  };
}

function createResponse(results: OpenmrsEncounter[], next?: string): FetchResponse<{ results: OpenmrsEncounter[] }> {
  return Object.assign(new Response(), {
    data: { results, links: next ? [{ rel: 'next', uri: next }] : [] },
  });
}

describe('useLatestValidEncounter', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('uses the ordered and paginated OpenMRS REST encounter query', async () => {
    mockOpenmrsFetch.mockResolvedValue(createResponse([]));

    const { result } = renderHook(() => useLatestValidEncounter(' patient-uuid ', ' encounter-type-uuid '), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    const parsedUrl = new URL(requestUrl, 'http://openmrs.test');

    expect(parsedUrl.pathname).toBe(`${restBaseUrl}/encounter`);
    expect(Object.fromEntries(parsedUrl.searchParams)).toMatchObject({
      patient: 'patient-uuid',
      encounterType: 'encounter-type-uuid',
      order: 'desc',
      limit: '1',
      startIndex: '0',
    });
    expect(parsedUrl.searchParams.get('v')).toContain('form:(uuid,name,display)');
    expect(parsedUrl.searchParams.get('v')).toContain('obs:(uuid,obsDatetime,formFieldNamespace,formFieldPath,');
    expect(parsedUrl.searchParams.has('form')).toBe(false);
  });

  it('filters canonical form UUIDs on the server and only requests the latest match', async () => {
    const formUuid = '28c37ff6-0079-4fa7-b803-5d547ac454e0';
    const matchingEncounter = createEncounter('uuid-match', '2026-07-07T10:00:00.000Z', {
      uuid: formUuid,
      name: 'UUID form name',
      display: 'UUID form display',
    });
    mockOpenmrsFetch.mockResolvedValue(createResponse([matchingEncounter]));

    const { result } = renderHook(
      () => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', ` ${formUuid} `),
      { wrapper: swrWrapper },
    );

    await waitFor(() => expect(result.current.encounter?.uuid).toBe('uuid-match'));

    const requestUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    const searchParams = new URL(requestUrl, 'http://openmrs.test').searchParams;
    expect(searchParams.get('form')).toBe(formUuid);
    expect(searchParams.get('limit')).toBe('1');
    expect(searchParams.get('order')).toBe('desc');
    expect(searchParams.get('startIndex')).toBe('0');
  });

  it.each([
    ['', 'encounter-type-uuid'],
    ['   ', 'encounter-type-uuid'],
    ['patient-uuid', ''],
    ['patient-uuid', '   '],
  ])('does not fetch when a required identifier is empty', (patientUuid, encounterTypeUuid) => {
    const { result } = renderHook(() => useLatestValidEncounter(patientUuid, encounterTypeUuid), {
      wrapper: swrWrapper,
    });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.current.encounter).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(new Error('patientUuid and encounterTypeUuid are required'));
  });

  it('selects the newest encounter without mutating the cached results array', async () => {
    const olderEncounter = createEncounter('older-encounter', '2026-07-01T10:00:00.000Z');
    const newestEncounter = createEncounter('newest-encounter', '2026-07-03T10:00:00.000Z');
    const middleEncounter = createEncounter('middle-encounter', '2026-07-02T10:00:00.000Z');
    const cachedResults = [olderEncounter, newestEncounter, middleEncounter];
    const originalOrder = cachedResults.map(({ uuid }) => uuid);
    Object.freeze(cachedResults);
    mockOpenmrsFetch.mockResolvedValue(createResponse(cachedResults));

    const { result } = renderHook(() => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.encounter?.uuid).toBe('newest-encounter'));

    expect(cachedResults.map(({ uuid }) => uuid)).toEqual(originalOrder);
  });

  it('matches formIdentifier exactly by uuid, name, or display', async () => {
    const misleadingEncounter = createEncounter('misleading-encounter', '2026-07-10T10:00:00.000Z', {
      uuid: 'other-form-uuid',
      name: 'Target form extended',
      display: 'Not the target form',
    });
    const uuidMatch = createEncounter('uuid-match', '2026-07-07T10:00:00.000Z', {
      uuid: 'target-form-uuid',
      name: 'UUID form name',
      display: 'UUID form display',
    });
    const nameMatch = createEncounter('name-match', '2026-07-06T10:00:00.000Z', {
      uuid: 'name-form-uuid',
      name: 'Target form name',
      display: 'Name form display',
    });
    const displayMatch = createEncounter('display-match', '2026-07-05T10:00:00.000Z', {
      uuid: 'display-form-uuid',
      name: 'Display form name',
      display: 'Target form display',
    });
    mockOpenmrsFetch.mockResolvedValue(createResponse([misleadingEncounter, displayMatch, nameMatch, uuidMatch]));

    const { result, rerender } = renderHook(
      ({ formIdentifier }) => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', formIdentifier),
      {
        initialProps: { formIdentifier: ' target FORM NAME ' },
        wrapper: swrWrapper,
      },
    );

    await waitFor(() => expect(result.current.encounter?.uuid).toBe('name-match'));

    const requestUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    const searchParams = new URL(requestUrl, 'http://openmrs.test').searchParams;
    expect(searchParams.has('form')).toBe(false);
    expect(searchParams.get('limit')).toBe('100');

    rerender({ formIdentifier: 'Target Form Display' });
    expect(result.current.encounter?.uuid).toBe('display-match');

    rerender({ formIdentifier: ' TARGET-FORM-UUID ' });
    expect(result.current.encounter?.uuid).toBe('uuid-match');

    rerender({ formIdentifier: 'Target form' });
    expect(result.current.encounter).toBeUndefined();

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('returns the fetch error without selecting an encounter', async () => {
    const fetchError = new Error('Encounter request failed');
    mockOpenmrsFetch.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.error).toBe(fetchError));
    expect(result.current.encounter).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('waits for the complete history to find a named form beyond the first 100 encounters', async () => {
    let finish!: (response: ReturnType<typeof createResponse>) => void;
    const laterPage = new Promise<ReturnType<typeof createResponse>>((resolve) => {
      finish = resolve;
    });
    const unrelated = Array.from({ length: 100 }, (_, index) =>
      createEncounter(`other-${index}`, '2026-09-01T10:00:00Z', {
        uuid: 'other-form',
        name: 'Other form',
      }),
    );
    const match = createEncounter('historical-match', '2026-08-01T10:00:00Z', {
      uuid: 'old-form-version',
      name: 'Birth details',
    });
    mockOpenmrsFetch.mockImplementation(async (url) =>
      String(url).includes('startIndex=100')
        ? laterPage
        : createResponse(unrelated, 'https://openmrs.test/ws/rest/v1/encounter?startIndex=100'),
    );

    const { result } = renderHook(
      () => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', 'Birth details'),
      { wrapper: swrWrapper },
    );

    await waitFor(() =>
      expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.encounter).toBeUndefined();
    await act(async () => finish(createResponse([match])));
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('historical-match'));
    expect(result.current.isLoading).toBe(false);
  });

  it('does not interpret a later page failure as missing history and recovers on refresh', async () => {
    const failure = new Error('Synthetic second-page failure');
    const match = createEncounter('historical-match', '2026-08-01T10:00:00Z', {
      uuid: 'old-form-version',
      name: 'Birth details',
    });
    let failed = true;
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) {
        if (failed) throw failure;
        return createResponse([match]);
      }
      return createResponse([], 'https://openmrs.test/ws/rest/v1/encounter?startIndex=100');
    });
    const { result } = renderHook(
      () => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', 'Birth details'),
      { wrapper: swrWrapper },
    );
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.encounter).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    failed = false;
    await act(async () => {
      await result.current.mutate();
    });
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('historical-match'));
    expect(result.current.error).toBeNull();
  });

  it('does not load older pages when the server already filtered and ordered a form UUID', async () => {
    const formUuid = '28c37ff6-0079-4fa7-b803-5d547ac454e0';
    const match = createEncounter('latest-match', '2026-08-01T10:00:00Z', {
      uuid: formUuid,
      name: 'Birth details',
    });
    mockOpenmrsFetch.mockResolvedValue(
      createResponse([match], 'https://openmrs.test/ws/rest/v1/encounter?startIndex=1'),
    );
    const { result } = renderHook(() => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', formUuid), {
      wrapper: swrWrapper,
    });
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('latest-match'));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a latest-only snapshot for a subsequent named-form search', async () => {
    const match = createEncounter('historical-match', '2026-08-01T10:00:00Z', {
      uuid: 'old-form',
      name: 'Birth details',
    });
    mockOpenmrsFetch.mockImplementation(async (url) =>
      String(url).includes('startIndex=100')
        ? createResponse([match])
        : createResponse(
            [createEncounter('other', '2026-09-01T10:00:00Z')],
            'https://openmrs.test/ws/rest/v1/encounter?startIndex=100',
          ),
    );
    const { result, rerender } = renderHook(
      ({ name }) => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', name),
      {
        wrapper: swrWrapper,
        initialProps: { name: undefined as string | undefined },
      },
    );
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('other'));
    rerender({ name: 'Birth details' });
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('historical-match'));
  });

  it('fetches newly added pages after a confirmed save is refreshed', async () => {
    const match = createEncounter('historical-match', '2026-08-01T10:00:00Z', {
      uuid: 'old-form',
      name: 'Birth details',
    });
    let saved = false;
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) return createResponse([match]);
      return createResponse([], saved ? 'https://openmrs.test/ws/rest/v1/encounter?startIndex=100' : undefined);
    });
    const { result } = renderHook(
      () => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid', 'Birth details'),
      { wrapper: swrWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.encounter).toBeUndefined();
    saved = true;
    await act(async () => {
      await result.current.mutate();
    });
    await waitFor(() => expect(result.current.encounter?.uuid).toBe('historical-match'));
  });

  it('hides a previous patient immediately and ignores their late history response', async () => {
    let finish!: (response: ReturnType<typeof createResponse>) => void;
    const previousPage = new Promise<ReturnType<typeof createResponse>>((resolve) => {
      finish = resolve;
    });
    const match = createEncounter('old-patient-encounter', '2026-08-01T10:00:00Z', {
      uuid: 'old-form',
      name: 'Birth details',
    });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) return previousPage;
      if (String(url).includes('patient=second-patient')) return createResponse([]);
      return createResponse([], 'https://openmrs.test/ws/rest/v1/encounter?patient=first-patient&startIndex=100');
    });
    const { result, rerender } = renderHook(
      ({ patient }) => useLatestValidEncounter(patient, 'encounter-type-uuid', 'Birth details'),
      {
        wrapper: swrWrapper,
        initialProps: { patient: 'first-patient' },
      },
    );
    await waitFor(() =>
      expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
    );
    rerender({ patient: 'second-patient' });
    expect(result.current.encounter).toBeUndefined();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => finish(createResponse([match])));
    expect(result.current.encounter).toBeUndefined();
  });

  it('revalidates and exposes the refreshed encounter through mutate', async () => {
    const initialEncounter = createEncounter('initial-encounter', '2026-07-01T10:00:00.000Z');
    const refreshedEncounter = createEncounter('refreshed-encounter', '2026-07-02T10:00:00.000Z');
    mockOpenmrsFetch
      .mockResolvedValueOnce(createResponse([initialEncounter]))
      .mockResolvedValueOnce(createResponse([refreshedEncounter]));

    const { result } = renderHook(() => useLatestValidEncounter('patient-uuid', 'encounter-type-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.encounter?.uuid).toBe('initial-encounter'));

    await act(async () => {
      await result.current.mutate();
    });

    await waitFor(() => expect(result.current.encounter?.uuid).toBe('refreshed-encounter'));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });
});
