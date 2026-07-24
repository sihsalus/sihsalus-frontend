import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import React from 'react';
import { SWRConfig } from 'swr';

import { omrsDateFormat } from '../constants';
import { type Appointment, AppointmentStatus, type AppointmentSummary } from '../types';

import SelectedDateContext from './selectedDateContext';
import { useAllAppointmentsByDate, useClinicalMetrics, useScheduledAppointments } from './useClinicalMetrics';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const selectedDate = '2026-07-24T00:00:00.000-05:00';
const serviceA = { uuid: 'service-a', name: 'Service A' };
const serviceB = { uuid: 'service-b', name: 'Service B' };

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

const appointment = (
  uuid: string,
  service: { uuid: string; name: string },
  status: AppointmentStatus,
  providers: Appointment['providers'] = [],
) =>
  ({
    uuid,
    service,
    status,
    providers,
  }) as Appointment;

describe('appointment metrics hooks', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('counts the same date range and selected services used by the appointments tables', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: [
        appointment('appointment-a-1', serviceA, AppointmentStatus.SCHEDULED),
        appointment('appointment-a-2', serviceA, AppointmentStatus.CHECKEDIN),
        appointment('appointment-b-1', serviceB, AppointmentStatus.SCHEDULED),
      ],
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useScheduledAppointments([serviceA.uuid]), { wrapper });

    await waitFor(() => expect(result.current.totalScheduledAppointments).toBe(2));

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        startDate: dayjs(selectedDate).startOf('day').format(omrsDateFormat),
        endDate: dayjs(selectedDate).endOf('day').format(omrsDateFormat),
      },
    });
  });

  it('filters booked providers by service before calculating the unique total', async () => {
    const providerA = { uuid: 'provider-a', response: 'ACCEPTED' } as Appointment['providers'][number];
    const providerB = { uuid: 'provider-b', response: 'ACCEPTED' } as Appointment['providers'][number];
    mockOpenmrsFetch.mockResolvedValue({
      data: [
        appointment('appointment-a-1', serviceA, AppointmentStatus.SCHEDULED, [providerA]),
        appointment('appointment-a-2', serviceA, AppointmentStatus.CHECKEDIN, [providerA]),
        appointment('appointment-b-1', serviceB, AppointmentStatus.SCHEDULED, [providerB]),
      ],
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useAllAppointmentsByDate([serviceA.uuid]), { wrapper });

    await waitFor(() => expect(result.current.totalProviders).toBe(1));
  });

  it('calculates the highest-volume service only within the selected services', async () => {
    const summary = [
      {
        appointmentService: serviceA,
        appointmentCountMap: {
          date: {
            allAppointmentsCount: 9,
            missedAppointmentsCount: 0,
            appointmentDate: 1,
            appointmentServiceUuid: serviceA.uuid,
          },
        },
      },
      {
        appointmentService: serviceB,
        appointmentCountMap: {
          date: {
            allAppointmentsCount: 3,
            missedAppointmentsCount: 1,
            appointmentDate: 1,
            appointmentServiceUuid: serviceB.uuid,
          },
        },
      },
    ] as Array<AppointmentSummary>;
    mockOpenmrsFetch.mockResolvedValue({
      data: summary,
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useClinicalMetrics([serviceB.uuid]), { wrapper });

    await waitFor(() =>
      expect(result.current.highestServiceLoad).toEqual({
        serviceName: serviceB.name,
        count: 3,
      }),
    );
    expect(result.current.totalAppointments).toBe(3);
    expect(result.current.missedAppointments).toBe(1);
  });
});
