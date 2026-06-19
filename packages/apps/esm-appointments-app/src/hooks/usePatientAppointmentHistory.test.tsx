import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import SelectedDateContext from './selectedDateContext';
import { usePatientAppointmentHistory } from './usePatientAppointmentHistory';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockFetchResponse = (data: Array<unknown>) => ({ data }) as Awaited<ReturnType<typeof openmrsFetch>>;
let selectedDate = '2026-04-01';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      dedupingInterval: 0,
      provider: () => new Map(),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }}
  >
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate: vi.fn() }}>
      {children}
    </SelectedDateContext.Provider>
  </SWRConfig>
);

describe('usePatientAppointmentHistory', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue(mockFetchResponse([]));
    selectedDate = '2026-04-01';
  });

  it('fetches separately when both patientUuid and selectedDate change', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Missed', startDateTime: Date.now() }]));

    const { rerender, result } = renderHook(({ patientUuid }) => usePatientAppointmentHistory(patientUuid), {
      wrapper,
      initialProps: { patientUuid: 'patient-1' },
    });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ patientUuid: 'patient-1', startDate: '2026-04-01' }),
      }),
    );
    expect(result.current.appointmentsCount.missedAppointments).toBe(0);

    selectedDate = '2026-04-15';
    rerender({ patientUuid: 'patient-2' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ patientUuid: 'patient-2', startDate: '2026-04-15' }),
      }),
    );
    // Data must reflect patient-2's response, not patient-1's cached empty data
    await waitFor(() => expect(result.current.appointmentsCount.missedAppointments).toBe(1));
  });

  it('triggers a new fetch and returns fresh data when only patientUuid changes', async () => {
    // patient-1 returns empty; patient-2 returns one Missed appointment
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Missed', startDateTime: Date.now() }]));

    const { rerender, result } = renderHook(({ patientUuid }) => usePatientAppointmentHistory(patientUuid), {
      wrapper,
      initialProps: { patientUuid: 'patient-1' },
    });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    // patient-1 has no missed appointments
    expect(result.current.appointmentsCount.missedAppointments).toBe(0);

    // Change only the patient - selectedDate remains '2026-04-01'
    rerender({ patientUuid: 'patient-2' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-2', startDate: '2026-04-01' }),
      }),
    );
    // Result must reflect patient-2's data, not patient-1's cached empty data
    await waitFor(() => expect(result.current.appointmentsCount.missedAppointments).toBe(1));
  });

  it('triggers a new fetch when only selectedDate changes', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Completed', startDateTime: Date.now() }]));

    const { rerender, result } = renderHook(({ patientUuid }) => usePatientAppointmentHistory(patientUuid), {
      wrapper,
      initialProps: { patientUuid: 'patient-1' },
    });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-1', startDate: '2026-04-01' }),
      }),
    );
    expect(result.current.appointmentsCount.completedAppointments).toBe(0);

    // Change only the selected date - patientUuid remains 'patient-1'
    selectedDate = '2026-04-15';
    rerender({ patientUuid: 'patient-1' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-1', startDate: '2026-04-15' }),
      }),
    );
    // Data must reflect the new date's response, not the first date's cached empty data
    await waitFor(() => expect(result.current.appointmentsCount.completedAppointments).toBe(1));
  });

  it('does not fetch again when patientUuid and selectedDate are unchanged (cache hit)', async () => {
    const { rerender } = renderHook(({ patientUuid }) => usePatientAppointmentHistory(patientUuid), {
      wrapper,
      initialProps: { patientUuid: 'patient-1' },
    });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));

    // Rerender with identical inputs - SWR key is unchanged, must serve from cache
    rerender({ patientUuid: 'patient-1' });

    // Flush pending microtasks then assert no second fetch was triggered
    await waitFor(() => {});
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });
});
