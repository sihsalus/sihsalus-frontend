import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import {
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
  changeAppointmentStatus,
  ensureAppointmentVisitLink,
  getAppointmentStatus,
  usePatientAppointments,
} from './patient-appointments.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockFetchResponse = (data: Array<unknown>) => ({ data }) as Awaited<ReturnType<typeof openmrsFetch>>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      dedupingInterval: 0,
      provider: () => new Map(),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }}
  >
    {children}
  </SWRConfig>
);

describe('usePatientAppointments', () => {
  let abortController: AbortController;

  beforeEach(() => {
    abortController = new AbortController();
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue(mockFetchResponse([]));
  });

  it('fetches separately when both patientUuid and startDate change', async () => {
    const pastDate = new Date('2020-01-01').getTime();
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Scheduled', startDateTime: pastDate }]));

    const { rerender, result } = renderHook(
      ({ patientUuid, startDate }) => usePatientAppointments(patientUuid, startDate, abortController),
      {
        wrapper,
        initialProps: {
          patientUuid: 'patient-1',
          startDate: '2026-04-01',
        },
      },
    );

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          patientUuid: 'patient-1',
          startDate: '2026-04-01',
        }),
      }),
    );
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(0));

    rerender({ patientUuid: 'patient-2', startDate: '2026-04-02' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          patientUuid: 'patient-2',
          startDate: '2026-04-02',
        }),
      }),
    );
    // Data must reflect patient-2's response, not patient-1's cached empty data
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(1));
  });

  it('triggers a new fetch and returns fresh data when only patientUuid changes', async () => {
    // patient-1 returns empty; patient-2 returns one past appointment
    const pastDate = new Date('2020-01-01').getTime();
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Scheduled', startDateTime: pastDate }]));

    const { rerender, result } = renderHook(
      ({ patientUuid, startDate }) => usePatientAppointments(patientUuid, startDate, abortController),
      {
        wrapper,
        initialProps: { patientUuid: 'patient-1', startDate: '2026-04-01' },
      },
    );

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    // patient-1 has no past appointments
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(0));

    // Change only the patient - startDate remains '2026-04-01'
    rerender({ patientUuid: 'patient-2', startDate: '2026-04-01' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-2', startDate: '2026-04-01' }),
      }),
    );
    // Result must reflect patient-2's data, not patient-1's cached empty data
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(1));
  });

  it('triggers a new fetch when only startDate changes', async () => {
    const pastDate = new Date('2020-01-01').getTime();
    mockOpenmrsFetch
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse([{ status: 'Scheduled', startDateTime: pastDate }]));

    const { rerender, result } = renderHook(
      ({ patientUuid, startDate }) => usePatientAppointments(patientUuid, startDate, abortController),
      {
        wrapper,
        initialProps: { patientUuid: 'patient-1', startDate: '2026-04-01' },
      },
    );

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-1', startDate: '2026-04-01' }),
      }),
    );
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(0));

    // Change only the startDate - patientUuid remains 'patient-1'
    rerender({ patientUuid: 'patient-1', startDate: '2026-04-15' });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ patientUuid: 'patient-1', startDate: '2026-04-15' }),
      }),
    );
    // Data must reflect the new date's response, not the first date's cached data
    await waitFor(() => expect(result.current.data?.pastAppointments).toHaveLength(1));
  });

  it('places an appointment occurring later today in todaysAppointments only', async () => {
    const laterToday = new Date().setHours(23, 0, 0, 0);
    mockOpenmrsFetch.mockResolvedValueOnce(
      mockFetchResponse([{ uuid: 'later-today', status: 'Scheduled', startDateTime: laterToday }]),
    );

    const { result } = renderHook(() => usePatientAppointments('patient-1', '2026-04-01', abortController), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.todaysAppointments).toHaveLength(1));
    expect(result.current.data?.upcomingAppointments).toHaveLength(0);
  });

  it('places an appointment on a future day in upcomingAppointments', async () => {
    const futureDate = new Date(new Date().setDate(new Date().getDate() + 2)).getTime();
    mockOpenmrsFetch.mockResolvedValueOnce(
      mockFetchResponse([{ uuid: 'future', status: 'Scheduled', startDateTime: futureDate }]),
    );

    const { result } = renderHook(() => usePatientAppointments('patient-1', '2026-04-01', abortController), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.upcomingAppointments).toHaveLength(1));
    expect(result.current.data?.todaysAppointments).toHaveLength(0);
  });

  it('does not fetch again when patientUuid and startDate are unchanged (cache hit)', async () => {
    const { rerender } = renderHook(
      ({ patientUuid, startDate }) => usePatientAppointments(patientUuid, startDate, abortController),
      {
        wrapper,
        initialProps: { patientUuid: 'patient-1', startDate: '2026-04-01' },
      },
    );

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));

    // Rerender with identical inputs - SWR key is unchanged, must serve from cache
    rerender({ patientUuid: 'patient-1', startDate: '2026-04-01' });

    // Flush pending microtasks then assert no second fetch was triggered
    await waitFor(() => {});
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('gets the current appointment status by uuid', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { status: 'CheckedIn' } } as Awaited<
      ReturnType<typeof openmrsFetch>
    >);

    await expect(getAppointmentStatus('appointment-uuid')).resolves.toBe('CheckedIn');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointment?uuid=appointment-uuid`);
  });

  it('uses the server timestamp when changing status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T15:30:00.000Z'));
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: { status: 'Scheduled' },
        headers: new Headers({ Date: 'Tue, 14 Jul 2026 16:45:30 GMT' }),
      } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    await changeAppointmentStatus('CheckedIn', 'appointment-uuid');

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(1, `${restBaseUrl}/appointment?uuid=appointment-uuid`);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/appointment-uuid/status-change`,
      expect.objectContaining({
        method: 'POST',
        body: { toStatus: 'CheckedIn', onDate: '2026-07-14T16:45:30.000Z' },
      }),
    );
    vi.useRealTimers();
  });

  it('falls back to an unambiguous client UTC timestamp when the server date is unavailable', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T15:30:00.250Z'));
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { status: 'Scheduled' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    await changeAppointmentStatus('CheckedIn', 'appointment-uuid');

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointments/appointment-uuid/status-change`,
      expect.objectContaining({
        body: { toStatus: 'CheckedIn', onDate: '2026-07-13T15:30:00.250Z' },
      }),
    );
    vi.useRealTimers();
  });

  it('reuses an existing appointment link on the visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        attributes: [
          {
            attributeType: { uuid: 'appointment-link-type' },
            value: 'appointment-uuid',
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      ensureAppointmentVisitLink('visit-uuid', 'appointment-uuid', 'appointment-link-type'),
    ).resolves.toEqual({ created: false });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('creates a missing appointment link on an active visit', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { attributes: [] } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { uuid: 'attribute-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      ensureAppointmentVisitLink('visit-uuid', 'appointment-uuid', 'appointment-link-type'),
    ).resolves.toMatchObject({ created: true });
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/visit/visit-uuid/attribute`,
      expect.objectContaining({
        method: 'POST',
        body: { attributeType: 'appointment-link-type', value: 'appointment-uuid' },
      }),
    );
  });

  it('fails before writing when the appointment visit link is not configured', async () => {
    const error = await ensureAppointmentVisitLink('visit-uuid', 'appointment-uuid', '').catch((reason) => reason);

    expect(error.code).toBe(APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
