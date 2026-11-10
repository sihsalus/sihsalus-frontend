import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useConcepts } from './useConcepts';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@openmrs/esm-framework/src/internal', () => ({
  openmrsFetch: mockFetch,
  restBaseUrl: '/ws/rest/v1',
}));

it('loads native numeric metadata together with coded concepts', async () => {
  const numeric = { uuid: 'temperature', lowAbsolute: 25, hiAbsolute: 45, allowDecimal: true };
  mockFetch.mockImplementation(async (url: string) => {
    // Model REST projection: omitted properties are not available to validation.
    const projection = url.split('v=')[1];
    const projected = Object.fromEntries(Object.entries(numeric).filter(([key]) => projection.includes(key)));
    return { data: { temperature: projected, answer: { uuid: 'answer', display: 'Yes' } } };
  });
  const { result } = renderHook(() => useConcepts(['temperature', 'answer']), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
  });
  await waitFor(() => expect(result.current.concepts).toHaveLength(2));
  expect(result.current.concepts?.[0]).toEqual(numeric);
  expect(result.current.error).toBeUndefined();
});
