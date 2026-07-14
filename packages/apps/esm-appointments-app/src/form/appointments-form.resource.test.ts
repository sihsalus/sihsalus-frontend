import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { AppointmentKind, type AppointmentPayload, type RecurringAppointmentsPayload } from '../types';
import { checkAppointmentConflict, checkRecurringAppointmentConflict } from './appointments-form.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const appointmentPayload: AppointmentPayload = {
  patientUuid: 'patient-uuid',
  serviceUuid: 'service-uuid',
  serviceTypeUuid: 'service-type-uuid',
  dateAppointmentScheduled: '2026-07-14T09:00:00-05:00',
  startDateTime: '2026-07-15T09:00:00-05:00',
  endDateTime: '2026-07-15T09:30:00-05:00',
  appointmentKind: AppointmentKind.SCHEDULED,
  providers: [
    { uuid: 'provider-one', response: 'ACCEPTED' },
    { uuid: 'provider-two', response: 'AWAITING' },
  ],
  locationUuid: 'location-uuid',
  comments: '',
};

describe('appointment conflict checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenmrsFetch.mockResolvedValue({ status: 204 } as FetchResponse);
  });

  it('checks the real providers and service type for a single appointment', async () => {
    await checkAppointmentConflict(appointmentPayload);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/conflicts`, {
      method: 'POST',
      body: expect.objectContaining({
        providers: appointmentPayload.providers,
        serviceTypeUuid: appointmentPayload.serviceTypeUuid,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('does not treat rejected, tentative, or cancelled provider history as an active conflict assignment', async () => {
    const payloadWithProviderHistory: AppointmentPayload = {
      ...appointmentPayload,
      providers: [
        ...appointmentPayload.providers,
        { uuid: 'provider-rejected', response: 'REJECTED' },
        { uuid: 'provider-tentative', response: 'TENTATIVE' },
        { uuid: 'provider-cancelled', response: 'CANCELLED' },
        { uuid: 'provider-new' },
      ],
    };

    await checkAppointmentConflict(payloadWithProviderHistory);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointments/conflicts`,
      expect.objectContaining({
        body: expect.objectContaining({
          providers: [
            { uuid: 'provider-one', response: 'ACCEPTED' },
            { uuid: 'provider-two', response: 'AWAITING' },
            { uuid: 'provider-new' },
          ],
        }),
      }),
    );
  });

  it('uses the backend recurrence endpoint to check every occurrence in a series', async () => {
    const recurringPayload: RecurringAppointmentsPayload = {
      appointmentRequest: appointmentPayload,
      recurringPattern: {
        type: 'WEEK',
        period: 1,
        endDate: '2026-08-15T23:59:00-05:00',
        daysOfWeek: ['WEDNESDAY'],
      },
    };

    await checkRecurringAppointmentConflict(recurringPayload);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/recurring-appointments/conflicts`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          appointmentRequest: expect.objectContaining({ providers: appointmentPayload.providers }),
          recurringPattern: recurringPayload.recurringPattern,
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});
