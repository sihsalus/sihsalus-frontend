import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { useAppointments } from '../form/appointments-form.resource';
import { usePatientAppointments } from './patient-appointments.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual('swr');
  return {
    ...actual,
    __esModule: true,
    default: vi.fn(),
    useSWRConfig: vi.fn(() => ({ mutate: vi.fn() })),
  };
});

const mockUseSWR = vi.mocked(useSWR);

describe('appointment resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty appointment buckets when the patient appointments response has no data array', () => {
    mockUseSWR.mockReturnValue({
      data: { data: null },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => usePatientAppointments('patient-uuid', '2026-04-17', new AbortController()));

    expect(result.current.data).toEqual({
      pastAppointments: [],
      upcomingAppointments: [],
      todaysAppointments: [],
    });
  });

  it('returns empty appointment buckets when the form appointments response has no data array', () => {
    mockUseSWR.mockReturnValue({
      data: { data: null },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useAppointments('patient-uuid', '2026-04-17', new AbortController()));

    expect(result.current.data).toEqual({
      pastAppointments: [],
      upcomingAppointments: [],
      todaysAppointments: [],
    });
  });
});
