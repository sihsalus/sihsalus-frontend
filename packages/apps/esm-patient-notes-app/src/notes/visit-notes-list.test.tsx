import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import type { ConfigObject } from '../config-schema';
import {
  AmbiguousVisitNoteSaveError,
  assertCanonicalVisitNoteCanBeCreated,
  getCanonicalVisitNoteEncounterUuid,
  saveCanonicalVisitNote,
  useCanonicalVisitNoteEncounter,
  useVisitNotes,
} from './visit-notes.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));
vi.mock('swr', () => ({ default: vi.fn() }));

const mockFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);
const mockUseSWR = vi.mocked(useSWR);
const patient = 'patient-uuid';
const visit = 'visit-uuid';
const encounterType = 'encounter-type-uuid';
const form = 'form-uuid';
const exactEncounter = (uuid: string) => ({
  uuid,
  encounterDatetime: '2026-08-23T10:00:00-05:00',
  patient: { uuid: patient },
  visit: { uuid: visit },
  encounterType: { uuid: encounterType },
  form: { uuid: form },
  location: { uuid: 'location' },
  encounterProviders: [
    {
      uuid: 'ep',
      encounterRole: { uuid: 'role' },
      provider: { uuid: 'provider' },
    },
  ],
  obs: [],
  diagnoses: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseConfig.mockReturnValue({
    visitNoteConfig: {
      encounterNoteTextConceptUuid: 'note',
      encounterTypeUuid: encounterType,
      formConceptUuid: form,
    },
  } as ConfigObject);
  mockUseSWR.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  } as never);
});

test('uses supported encounter filters and the fetcher exhausts pages before exact form filtering', async () => {
  renderHook(() => useVisitNotes(patient));
  const [key, fetcher] = mockUseSWR.mock.calls[0];
  const search = new URL(key as string, 'https://openmrs.test').searchParams;
  expect(search.get('patient')).toBe(patient);
  expect(search.get('encounterType')).toBe(encounterType);
  expect(search.has('form')).toBe(false);
  expect(search.has('obs')).toBe(false);

  mockFetch
    .mockResolvedValueOnce({
      data: { results: [exactEncounter('one')], links: [{ rel: 'next' }] },
    } as never)
    .mockResolvedValueOnce({
      data: {
        results: [exactEncounter('two'), { ...exactEncounter('wrong-form'), form: { uuid: 'other-form' } }],
      },
    } as never);
  const result = await (fetcher as () => Promise<{ data: { results: Array<{ uuid: string }> } }>)();
  expect(result.data.results.map(({ uuid }) => uuid)).toEqual(['one', 'two']);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  for (const [url] of mockFetch.mock.calls) {
    expect(new URL(url as string, 'https://openmrs.test').searchParams.has('form')).toBe(false);
  }
});

test.each([
  [[], 'ready'],
  [[exactEncounter('one')], 'ready'],
  [[exactEncounter('one'), exactEncounter('two')], 'ambiguous'],
])('resolves canonical cardinality %j as %s', (results, status) => {
  mockUseSWR.mockReturnValue({
    data: { data: { results } },
    isLoading: false,
    mutate: vi.fn(),
  } as never);
  const { result } = renderHook(() => useCanonicalVisitNoteEncounter(patient, visit, encounterType, form));
  expect(result.current.status).toBe(status);
});

test('keeps verified stale data mounted but exposes a failed background revalidation', () => {
  const revalidationError = new Error('network unavailable');
  mockUseSWR.mockReturnValue({
    data: { data: { results: [exactEncounter('one')] } },
    error: revalidationError,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  } as never);

  const { result } = renderHook(() => useCanonicalVisitNoteEncounter(patient, visit, encounterType, form));

  expect(result.current).toMatchObject({
    status: 'ready',
    encounter: { uuid: 'one' },
    isValidating: false,
    revalidationError,
  });
});

test('derives a stable UUID from the complete canonical identity', () => {
  const first = getCanonicalVisitNoteEncounterUuid(patient, visit, encounterType, form);
  expect(getCanonicalVisitNoteEncounterUuid(patient, visit, encounterType, form)).toBe(first);
  expect(getCanonicalVisitNoteEncounterUuid(patient, 'other-visit', encounterType, form)).not.toBe(first);
});

test('preflight exhausts the supported search and blocks an exact existing summary', async () => {
  mockFetch
    .mockResolvedValueOnce({
      data: {
        results: [{ ...exactEncounter('other'), form: { uuid: 'other-form' } }],
        links: [{ rel: 'next' }],
      },
    } as never)
    .mockResolvedValueOnce({
      data: { results: [exactEncounter('existing')] },
    } as never);

  await expect(assertCanonicalVisitNoteCanBeCreated(patient, visit, encounterType, form)).rejects.toThrow(
    /already exists/i,
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
  for (const [url] of mockFetch.mock.calls) {
    expect(new URL(url as string, 'https://openmrs.test').searchParams.has('form')).toBe(false);
  }
});

test('fails closed when an ambiguous create finds the same deterministic identity', async () => {
  const uuid = getCanonicalVisitNoteEncounterUuid(patient, visit, encounterType, form);
  const payload = {
    uuid,
    visit,
    patient,
    encounterType,
    form,
    location: 'location',
    encounterProviders: [{ encounterRole: 'role', provider: 'provider' }],
    obs: [],
    diagnoses: [],
  };
  mockFetch.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ data: exactEncounter(uuid) } as never);

  await expect(saveCanonicalVisitNote(new AbortController(), payload)).rejects.toBeInstanceOf(
    AmbiguousVisitNoteSaveError,
  );
});
