import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { usePatientListsForPatient } from './usePatientListsForPatient';

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('usePatientListsForPatient', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty result without repeatedly retrying a failed request', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Request failed'));

    const { result } = renderHook(() => usePatientListsForPatient('patient-123'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cohorts).toEqual([]);
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('maps valid patient lists and ignores incomplete memberships', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue(
      {
        data: {
          results: [
            {
              cohort: {
                uuid: 'cohort-1',
                name: 'Lista prioritaria',
                startDate: '2026-01-01',
                endDate: null,
              },
            },
            { cohort: null },
          ],
        },
      } as never,
    );

    const { result } = renderHook(() => usePatientListsForPatient('patient-123'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cohorts).toEqual([
      {
        uuid: 'cohort-1',
        name: 'Lista prioritaria',
        startDate: '2026-01-01',
        endDate: null,
      },
    ]);
  });
});
