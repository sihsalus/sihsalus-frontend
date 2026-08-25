import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  fetchNextScheduledAppointment,
  isUpcomingScheduledAppointment,
  selectNextScheduledAppointment,
} from './outpatient-next-appointment.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('outpatient next appointment', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('selects the earliest future scheduled appointment and normalizes its printable details', () => {
    const result = selectNextScheduledAppointment(
      [
        {
          uuid: 'cancelled',
          patient: { uuid: 'patient-uuid' },
          status: 'Cancelled',
          startDateTime: '2026-08-26T08:00:00-05:00',
        },
        {
          uuid: 'later',
          patient: { uuid: 'patient-uuid' },
          status: 'WaitList',
          startDateTime: '2026-08-27T08:00:00-05:00',
        },
        {
          uuid: 'linked-current-appointment',
          patient: { uuid: 'patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-26T09:00:00-05:00',
        },
        {
          uuid: 'other-patient',
          patient: { uuid: 'other-patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-26T09:30:00-05:00',
        },
        {
          uuid: 'next',
          patient: { uuid: 'PATIENT-UUID' },
          status: 'Scheduled',
          startDateTime: '2026-08-26T10:00:00-05:00',
          service: { name: 'Consulta sintética' },
          location: { name: 'Consultorio sintético' },
          providers: [
            { display: 'Profesional rechazado', response: 'DECLINED' },
            {
              person: { display: 'Profesional sintético' },
              response: 'ACCEPTED',
            },
          ],
        },
      ],
      new Date('2026-08-25T09:00:00-05:00'),
      'patient-uuid',
      ['LINKED-CURRENT-APPOINTMENT'],
    );

    expect(result).toEqual({
      uuid: 'next',
      startDateTime: '2026-08-26T15:00:00.000Z',
      service: 'Consulta sintética',
      location: 'Consultorio sintético',
      provider: 'Profesional sintético',
    });
  });

  it('excludes voided, completed, past and invalid appointments', () => {
    expect(
      selectNextScheduledAppointment(
        [
          {
            uuid: 'voided',
            patient: { uuid: 'patient-uuid' },
            status: 'Scheduled',
            voided: true,
            startDateTime: '2026-08-26T10:00:00-05:00',
          },
          {
            uuid: 'completed',
            patient: { uuid: 'patient-uuid' },
            status: 'Completed',
            startDateTime: '2026-08-26T10:00:00-05:00',
          },
          {
            uuid: 'requested',
            patient: { uuid: 'patient-uuid' },
            status: 'Requested',
            startDateTime: '2026-08-26T10:00:00-05:00',
          },
          {
            uuid: 'waitlist',
            patient: { uuid: 'patient-uuid' },
            status: 'WaitList',
            startDateTime: '2026-08-26T10:00:00-05:00',
          },
          {
            uuid: 'past',
            patient: { uuid: 'patient-uuid' },
            status: 'Scheduled',
            startDateTime: '2026-08-24T10:00:00-05:00',
          },
          {
            uuid: 'invalid',
            patient: { uuid: 'patient-uuid' },
            status: 'Scheduled',
            startDateTime: 'not-a-date',
          },
        ],
        new Date('2026-08-25T09:00:00-05:00'),
        'patient-uuid',
      ),
    ).toBeNull();
  });

  it('requires an appointment to be strictly later than the evaluation instant', () => {
    const now = new Date('2026-08-25T09:00:00-05:00');
    const appointment = {
      uuid: 'boundary-appointment',
      patient: { uuid: 'patient-uuid' },
      status: 'Scheduled',
      startDateTime: now.toISOString(),
    };

    expect(selectNextScheduledAppointment([appointment], now, 'patient-uuid')).toBeNull();
    expect(
      isUpcomingScheduledAppointment(
        {
          uuid: appointment.uuid,
          startDateTime: appointment.startDateTime,
          service: null,
          location: null,
          provider: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it('fails closed when every scheduled result belongs to another patient or the active visit', () => {
    expect(
      selectNextScheduledAppointment(
        [
          {
            uuid: 'linked-current-appointment',
            patient: { uuid: 'patient-uuid' },
            status: 'Scheduled',
            startDateTime: '2026-08-26T09:00:00-05:00',
          },
          {
            uuid: 'other-patient',
            patient: { uuid: 'other-patient-uuid' },
            status: 'Scheduled',
            startDateTime: '2026-08-26T10:00:00-05:00',
          },
          {
            uuid: 'missing-patient',
            status: 'Scheduled',
            startDateTime: '2026-08-26T11:00:00-05:00',
          },
        ],
        new Date('2026-08-25T09:00:00-05:00'),
        'patient-uuid',
        ['linked-current-appointment'],
      ),
    ).toBeNull();
  });

  it('accepts Unix timestamps in seconds from the appointments API', () => {
    const startDate = new Date('2026-08-26T10:00:00-05:00');
    expect(
      selectNextScheduledAppointment(
        [
          {
            uuid: 'next',
            patient: { uuid: 'patient-uuid' },
            status: 'Scheduled',
            startDateTime: Math.floor(startDate.valueOf() / 1000),
          },
        ],
        new Date('2026-08-25T09:00:00-05:00'),
        'patient-uuid',
      )?.startDateTime,
    ).toBe(startDate.toISOString());
  });

  it('reads the appointments array directly from a successful OpenMRS response', async () => {
    const now = new Date('2026-08-25T09:00:00-05:00');
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: [
        {
          uuid: 'current-appointment',
          patient: { uuid: 'patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-26T09:00:00-05:00',
        },
        {
          uuid: 'next-appointment',
          patient: { uuid: 'patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-27T09:00:00-05:00',
          service: { name: 'Consulta sintética' },
        },
      ],
    } as never);

    await expect(
      fetchNextScheduledAppointment('patient-uuid', {
        excludedAppointmentUuids: ['current-appointment'],
        now,
      }),
    ).resolves.toMatchObject({
      uuid: 'next-appointment',
      service: 'Consulta sintética',
    });
  });

  it('reselects against the current time when the appointment response is delayed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T09:00:00-05:00'));
    let resolveSearch: (value: unknown) => void = () => undefined;
    mockOpenmrsFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }) as never,
    );

    const request = fetchNextScheduledAppointment('patient-uuid');
    vi.setSystemTime(new Date('2026-08-25T11:00:00-05:00'));
    resolveSearch({
      data: [
        {
          uuid: 'expired-while-waiting',
          patient: { uuid: 'patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-25T10:00:00-05:00',
        },
        {
          uuid: 'still-upcoming',
          patient: { uuid: 'patient-uuid' },
          status: 'Scheduled',
          startDateTime: '2026-08-25T12:00:00-05:00',
        },
      ],
    });

    await expect(request).resolves.toMatchObject({ uuid: 'still-upcoming' });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        body: expect.objectContaining({ startDate: '2026-08-25T14:00:00.000Z' }),
      }),
    );
  });

  it('queries the appointment API for the exact patient and propagates access failures', async () => {
    const now = new Date('2026-08-25T09:00:00-05:00');
    const accessError = { response: { status: 403 } };
    mockOpenmrsFetch.mockRejectedValueOnce(accessError);

    await expect(fetchNextScheduledAppointment('patient-uuid', { now })).rejects.toBe(accessError);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointments/search`, {
      method: 'POST',
      signal: expect.any(AbortSignal),
      headers: { 'Content-Type': 'application/json' },
      body: {
        patientUuid: 'patient-uuid',
        startDate: now.toISOString(),
      },
    });
  });

  it('aborts a stalled appointment query so printing can continue without it', async () => {
    vi.useFakeTimers();
    mockOpenmrsFetch.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const request = fetchNextScheduledAppointment('patient-uuid', {
      now: new Date('2026-08-25T09:00:00-05:00'),
    });
    const rejection = expect(request).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
  });
});
