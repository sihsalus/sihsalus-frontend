import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useEncounterRole } from './useEncounterRole';

const mockOpenmrsFetch = vi.hoisted(() => vi.fn());
vi.mock('@openmrs/esm-framework/src/internal', () => ({
  openmrsFetch: mockOpenmrsFetch,
  restBaseUrl: '/ws/rest/v1',
}));

it.each([
  [
    [
      { uuid: 'unknown', name: 'Unknown' },
      { uuid: 'nurse', name: 'Enfermería' },
    ],
    undefined,
  ],
  [
    [
      { uuid: 'unknown', name: 'Unknown' },
      { uuid: 'clinician', name: 'Clinician' },
    ],
    'clinician',
  ],
  [[], undefined],
])('only defaults to the generic Clinician role, never the first catalog entry (%j)', async (roles, expected) => {
  mockOpenmrsFetch.mockResolvedValue({ data: { results: roles } });
  const { result } = renderHook(() => useEncounterRole(), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.encounterRole?.uuid).toBe(expected);
});
