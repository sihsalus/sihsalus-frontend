import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import {
  createMotherChildRelationship,
  useMotherAndChildLinks,
  useNewbornPatientSearch,
} from './mother-child-relationship.resource';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), fetchAll: vi.fn() }));
vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: mocks.fetch,
  useOpenmrsFetchAll: mocks.fetchAll,
  makeUrl: (url: string) => url,
  restBaseUrl: '/openmrs/ws/rest/v1',
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ data: { results: [] } });
  mocks.fetchAll.mockReturnValue({ data: [], error: undefined, isLoading: false });
});

it('queries both directions without requiring inpatient visits or the birth encounter', () => {
  renderHook(() => useMotherAndChildLinks({ motherUuid: 'synthetic-mother', childUuid: 'synthetic-child' }, true));
  const url: URL = mocks.fetchAll.mock.calls[0][0];
  expect(url.pathname).toBe('/openmrs/ws/rest/v1/emrapi/maternal/mothersAndChildren');
  expect(url.searchParams.get('mother')).toBe('synthetic-mother');
  expect(url.searchParams.get('child')).toBe('synthetic-child');
  expect(url.searchParams.get('requireMotherHasActiveVisit')).toBe('false');
  expect(url.searchParams.get('requireChildHasActiveVisit')).toBe('false');
  expect(url.searchParams.get('requireChildBornDuringMothersActiveVisit')).toBe('false');
});

it.each([
  { query: {}, enabled: true },
  { query: { motherUuid: 'synthetic-mother' }, enabled: false },
])('never requests all hospital families for an empty or disabled query', ({ query, enabled }) => {
  renderHook(() => useMotherAndChildLinks(query, enabled));
  expect(mocks.fetchAll).toHaveBeenCalledWith(null);
});

it.each([
  { query: 'RN', enabled: true },
  { query: 'RN Sintético', enabled: false },
])('does not search without enough text and authorization', ({ query, enabled }) => {
  renderHook(() => useNewbornPatientSearch(query, enabled), { wrapper });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('searches registered patients using the complete encoded name or identifier', async () => {
  const patient = { uuid: 'synthetic-newborn', person: { display: 'RN & Niño Sintético' } };
  mocks.fetch.mockResolvedValue({ data: { results: [patient] } });
  const { result } = renderHook(() => useNewbornPatientSearch(' RN & Niño Sintético ', true), { wrapper });
  await waitFor(() => expect(result.current.patients).toEqual([patient]));
  const url = new URL(mocks.fetch.mock.calls[0][0], window.location.toString());
  expect(url.pathname).toBe('/openmrs/ws/rest/v1/patient');
  expect(url.searchParams.get('q')).toBe('RN & Niño Sintético');
  expect(url.searchParams.get('v')).toContain('birthdate');
  expect(url.searchParams.get('v')).toContain('identifiers');
});

it('exposes a failed search to the UI instead of reporting matching patients', async () => {
  const error = new Error('synthetic request failure');
  mocks.fetch.mockRejectedValue(error);
  const { result } = renderHook(() => useNewbornPatientSearch('RN Sintético', true), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(error));
  expect(result.current.patients).toEqual([]);
});

it('posts the mother as personA, the newborn as personB, and the configured type', async () => {
  mocks.fetch.mockResolvedValue({ data: { uuid: 'synthetic-relationship' } });
  await createMotherChildRelationship('synthetic-mother', 'synthetic-newborn', 'synthetic-configured-type');
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/openmrs/ws/rest/v1/relationship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { personA: 'synthetic-mother', personB: 'synthetic-newborn', relationshipType: 'synthetic-configured-type' },
  });
});
