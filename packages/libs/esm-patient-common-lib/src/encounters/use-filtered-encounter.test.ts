import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useFilteredEncounter } from './use-filtered-encounter';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useOpenmrsFetchAll: (await import('../../../esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const swrWrapper = ({ children }: PropsWithChildren) =>
  createElement(
    SWRConfig,
    { value: { dedupingInterval: 0, provider: () => new Map(), shouldRetryOnError: false } },
    children,
  );

const encounter = ({
  uuid,
  datetime,
  formUuid = 'form-uuid',
  formName = 'Published form name',
  formDisplay = 'Published form display',
  obs = [],
}: {
  uuid: string;
  datetime: string;
  formUuid?: string;
  formName?: string;
  formDisplay?: string;
  obs?: unknown;
}) => ({
  uuid,
  encounterDatetime: datetime,
  form: { uuid: formUuid, name: formName, display: formDisplay },
  obs,
});

describe('useFilteredEncounter', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it.each([
    [undefined, 'encounter-type', 'form-uuid'],
    ['patient-uuid', undefined, 'form-uuid'],
    ['patient-uuid', 'encounter-type', undefined],
    ['   ', 'encounter-type', 'form-uuid'],
    ['patient-uuid', '   ', 'form-uuid'],
    ['patient-uuid', 'encounter-type', '   '],
  ])('does not fetch when a required identifier is missing', (patientUuid, encounterType, formUuid) => {
    const { result } = renderHook(() => useFilteredEncounter(patientUuid, encounterType, formUuid), {
      wrapper: swrWrapper,
    });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.current.prenatalEncounter).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('trims query identifiers and requests all form identifiers needed for local filtering', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(
      () => useFilteredEncounter('  patient-uuid  ', '  encounter-type  ', '  form-uuid  '),
      { wrapper: swrWrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);

    const requestedUrl = new URL(mockOpenmrsFetch.mock.calls[0][0], 'http://openmrs.test');
    expect(requestedUrl.pathname).toBe(`${restBaseUrl}/encounter`);
    expect(requestedUrl.searchParams.get('patient')).toBe('patient-uuid');
    expect(requestedUrl.searchParams.get('encounterType')).toBe('encounter-type');
    expect(requestedUrl.searchParams.get('order')).toBe('desc');
    expect(requestedUrl.searchParams.get('limit')).toBe('100');
    expect(requestedUrl.searchParams.get('startIndex')).toBe('0');
    expect(requestedUrl.searchParams.get('v')).toContain('form:(uuid,name,display)');
    expect(requestedUrl.searchParams.get('order')).toBe('desc');
    expect(requestedUrl.searchParams.get('limit')).toBe('100');
    expect(requestedUrl.searchParams.get('startIndex')).toBe('0');
    expect(requestedUrl.searchParams.has('form')).toBe(false);
  });

  it('filters canonical form UUIDs on the server and requests only the latest match', async () => {
    const formUuid = '28c37ff6-0079-4fa7-b803-5d547ac454e0';
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          encounter({
            uuid: 'matching',
            datetime: '2026-07-15T12:00:00.000Z',
            formUuid,
          }),
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', `  ${formUuid}  `), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.prenatalEncounter?.uuid).toBe('matching'));

    const requestedUrl = new URL(mockOpenmrsFetch.mock.calls[0][0], 'http://openmrs.test');
    expect(requestedUrl.searchParams.get('form')).toBe(formUuid);
    expect(requestedUrl.searchParams.get('order')).toBe('desc');
    expect(requestedUrl.searchParams.get('limit')).toBe('1');
    expect(requestedUrl.searchParams.get('startIndex')).toBe('0');
  });

  it.each([
    ['FORM-UUID', { formUuid: 'form-uuid', formName: 'Other', formDisplay: 'Other' }],
    ['published FORM name', { formUuid: 'other', formName: 'Published Form Name', formDisplay: 'Other' }],
    ['published form DISPLAY', { formUuid: 'other', formName: 'Other', formDisplay: 'Published Form Display' }],
  ])('matches the configured form by UUID, name, or display', async (formIdentifier, form) => {
    const matchingEncounter = encounter({
      uuid: 'matching',
      datetime: '2026-07-15T12:00:00.000Z',
      ...form,
    });
    mockOpenmrsFetch.mockResolvedValue({
      data: { results: [matchingEncounter] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(
      () => useFilteredEncounter('patient-uuid', 'encounter-type', `  ${formIdentifier}  `),
      { wrapper: swrWrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prenatalEncounter?.uuid).toBe('matching');
  });

  it('returns the newest valid matching encounter without mutating the response order', async () => {
    const results = [
      encounter({ uuid: 'older-match', datetime: '2026-07-12T12:00:00.000Z' }),
      encounter({ uuid: 'wrong-form', datetime: '2026-07-15T12:00:00.000Z', formUuid: 'other-form' }),
      encounter({ uuid: 'newer-match', datetime: '2026-07-14T12:00:00.000Z' }),
      encounter({ uuid: 'invalid-date', datetime: 'not-a-date' }),
      encounter({ uuid: '', datetime: '2026-07-16T12:00:00.000Z' }),
      encounter({ uuid: 'invalid-observations', datetime: '2026-07-16T12:00:00.000Z', obs: null }),
    ];
    const originalOrder = results.map(({ uuid }) => uuid);
    mockOpenmrsFetch.mockResolvedValue({ data: { results } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', 'form-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prenatalEncounter?.uuid).toBe('newer-match');
    expect(results.map(({ uuid }) => uuid)).toEqual(originalOrder);
  });

  it('exposes an invalid response instead of treating it as empty history', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: null } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', 'form-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prenatalEncounter).toBeNull();
    expect(result.current.error).toEqual(new Error('Invalid encounter search response'));
  });

  it('exposes fetch failures and returns no encounter', async () => {
    const fetchError = new Error('network unavailable');
    mockOpenmrsFetch.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', 'form-uuid'), {
      wrapper: swrWrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(fetchError);
    expect(result.current.prenatalEncounter).toBeNull();
  });

  it('waits for later pages before selecting a named form and refreshes the complete history', async () => {
    let finish!: (response: Awaited<ReturnType<typeof openmrsFetch>>) => void;
    const laterPage = new Promise<Awaited<ReturnType<typeof openmrsFetch>>>((resolve) => {
      finish = resolve;
    });
    const next = `https://openmrs.test${restBaseUrl}/encounter?patient=patient-uuid&startIndex=100`;
    let refreshed = false;
    const previous = encounter({ uuid: 'older-match', datetime: '2026-09-01T10:00:00Z' });
    const latest = encounter({ uuid: 'newer-match', datetime: '2026-10-01T10:00:00Z' });
    const updated = encounter({ uuid: 'refreshed-match', datetime: '2026-10-02T10:00:00Z' });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) {
        return refreshed
          ? ({ data: { results: [updated], links: [] } } as Awaited<ReturnType<typeof openmrsFetch>>)
          : laterPage;
      }
      return { data: { results: [previous], links: [{ rel: 'next', uri: next }] } } as Awaited<
        ReturnType<typeof openmrsFetch>
      >;
    });
    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', 'form-uuid'), {
      wrapper: swrWrapper,
    });
    await waitFor(() =>
      expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.prenatalEncounter).toBeNull();
    await act(async () =>
      finish({ data: { results: [latest], links: [] } } as Awaited<ReturnType<typeof openmrsFetch>>),
    );
    await waitFor(() => expect(result.current.prenatalEncounter?.uuid).toBe('newer-match'));
    refreshed = true;
    await act(async () => {
      await result.current.mutate();
    });
    await waitFor(() => expect(result.current.prenatalEncounter?.uuid).toBe('refreshed-match'));
  });

  it('exposes a later-page failure without authorizing a new record', async () => {
    const failure = new Error('Synthetic later-page failure');
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) throw failure;
      return {
        data: {
          results: [],
          links: [{ rel: 'next', uri: `https://openmrs.test${restBaseUrl}/encounter?startIndex=100` }],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    });
    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', 'form-uuid'), {
      wrapper: swrWrapper,
    });
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.prenatalEncounter).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not follow older pages after a server-filtered latest UUID match', async () => {
    const formUuid = '28c37ff6-0079-4fa7-b803-5d547ac454e0';
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [encounter({ uuid: 'latest-match', datetime: '2026-10-01T10:00:00Z', formUuid })],
        links: [{ rel: 'next', uri: `https://openmrs.test${restBaseUrl}/encounter?startIndex=1` }],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useFilteredEncounter('patient-uuid', 'encounter-type', formUuid), {
      wrapper: swrWrapper,
    });
    await waitFor(() => expect(result.current.prenatalEncounter?.uuid).toBe('latest-match'));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('hides the previous patient and ignores a late page after the patient changes', async () => {
    let finish!: (response: Awaited<ReturnType<typeof openmrsFetch>>) => void;
    const laterPage = new Promise<Awaited<ReturnType<typeof openmrsFetch>>>((resolve) => {
      finish = resolve;
    });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) return laterPage;
      if (String(url).includes('patient=next-patient'))
        return { data: { results: [], links: [] } } as Awaited<ReturnType<typeof openmrsFetch>>;
      return {
        data: {
          results: [],
          links: [
            { rel: 'next', uri: `https://openmrs.test${restBaseUrl}/encounter?patient=first-patient&startIndex=100` },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    });
    const { result, rerender } = renderHook(
      ({ patient }) => useFilteredEncounter(patient, 'encounter-type', 'form-uuid'),
      { initialProps: { patient: 'first-patient' }, wrapper: swrWrapper },
    );
    await waitFor(() =>
      expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
    );
    rerender({ patient: 'next-patient' });
    expect(result.current.prenatalEncounter).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () =>
      finish({
        data: { results: [encounter({ uuid: 'previous-patient-match', datetime: '2026-10-01T10:00:00Z' })], links: [] },
      } as Awaited<ReturnType<typeof openmrsFetch>>),
    );
    expect(result.current.prenatalEncounter).toBeNull();
  });
});
