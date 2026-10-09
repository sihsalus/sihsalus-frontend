import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { type MotherAndChildLink, useMotherAndChildLinks } from './mother-child-relationships.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework')),
  useOpenmrsFetchAll: (await import('../../../esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
  openmrsFetch: vi.fn(),
  makeUrl: (url: string) => url,
  restBaseUrl: '/ws/rest/v1',
}));

const fetch = vi.mocked(openmrsFetch);
const family: MotherAndChildLink = {
  mother: { uuid: 'synthetic-mother', display: 'Madre Sintética' },
  child: { uuid: 'synthetic-child', display: 'Niño Sintético' },
};
function response(results: MotherAndChildLink[], next?: string): FetchResponse<{ results: MotherAndChildLink[] }> {
  return Object.assign(new Response(), { data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } });
}
function wrapper({ children }: PropsWithChildren) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      {children}
    </SWRConfig>
  );
}
beforeEach(() => fetch.mockReset());

it.each([
  { motherUuid: 'synthetic-mother' },
  { childUuid: 'synthetic-child' },
  { motherUuid: 'synthetic-mother', childUuid: 'synthetic-child' },
])('queries explicit relationships in the requested direction across visits: %j', async (query) => {
  fetch.mockResolvedValue(response([family]));
  const { result } = renderHook(() => useMotherAndChildLinks(query, true), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual([family]));
  const url = new URL(String(fetch.mock.calls[0][0]), window.location.toString());
  expect(url.pathname).toBe('/ws/rest/v1/emrapi/maternal/mothersAndChildren');
  expect(url.searchParams.get('mother')).toBe(query.motherUuid ?? null);
  expect(url.searchParams.get('child')).toBe(query.childUuid ?? null);
  expect(url.searchParams.get('requireMotherHasActiveVisit')).toBe('false');
  expect(url.searchParams.get('requireChildHasActiveVisit')).toBe('false');
  expect(url.searchParams.get('requireChildBornDuringMothersActiveVisit')).toBe('false');
  expect(url.searchParams.get('v')).toBe('custom:(mother:(uuid,display),child:(uuid,display))');
});

it.each([
  { query: {}, enabled: true },
  { query: { motherUuid: '  ' }, enabled: true },
  { query: { motherUuid: 'synthetic-mother' }, enabled: false },
])('does not query unscoped families or disabled readers: %j', ({ query, enabled }) => {
  renderHook(() => useMotherAndChildLinks(query, enabled), { wrapper });
  expect(fetch).not.toHaveBeenCalled();
});

it('waits for every native REST page before presenting the complete family', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  const next = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  fetch.mockImplementation((url) =>
    new URL(String(url), window.location.toString()).searchParams.get('startIndex') === '1'
      ? next
      : Promise.resolve(
          response([family], 'http://localhost/ws/rest/v1/emrapi/maternal/mothersAndChildren?startIndex=1'),
        ),
  );
  const { result } = renderHook(() => useMotherAndChildLinks({ motherUuid: family.mother.uuid }, true), { wrapper });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('startIndex=1'))).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);
  const sibling = { ...family, child: { uuid: 'synthetic-sibling', display: 'Hermana Sintética' } };
  await act(async () => finish(response([sibling])));
  await waitFor(() => expect(result.current.data).toEqual([family, sibling]));
});

it('preserves a later-page error without claiming the partial family is complete or empty', async () => {
  const error = new Error('synthetic mapping or transport failure');
  fetch.mockImplementation((url) =>
    new URL(String(url), window.location.toString()).searchParams.get('startIndex') === '1'
      ? Promise.reject(error)
      : Promise.resolve(
          response([family], 'http://localhost/ws/rest/v1/emrapi/maternal/mothersAndChildren?startIndex=1'),
        ),
  );
  const { result } = renderHook(() => useMotherAndChildLinks({ motherUuid: family.mother.uuid }, true), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(error));
  expect(result.current.data).toBeUndefined();
});

it('removes the previous patient’s results while the next patient is loading', async () => {
  fetch.mockResolvedValueOnce(response([family]));
  const { result, rerender } = renderHook(({ childUuid }) => useMotherAndChildLinks({ childUuid }, true), {
    wrapper,
    initialProps: { childUuid: family.child.uuid },
  });
  await waitFor(() => expect(result.current.data).toEqual([family]));
  let finish!: (value: ReturnType<typeof response>) => void;
  fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  rerender({ childUuid: 'synthetic-other-child' });
  expect(result.current.data).toBeUndefined();
  await act(async () => finish(response([])));
  await waitFor(() => expect(result.current.data).toEqual([]));
});
