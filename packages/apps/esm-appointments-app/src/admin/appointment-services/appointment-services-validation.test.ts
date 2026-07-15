import { validationSchema } from './appointment-services-validation';

const validService = {
  appointmentServiceId: 0,
  creatorName: '',
  description: '',
  durationMins: 30,
  endTime: '05:30',
  initialAppointmentStatus: '',
  location: { uuid: 'location-uuid', display: 'Consulta externa' },
  maxAppointmentsLimit: 0,
  name: 'Medicina general',
  startTime: '08:00',
  uuid: '',
  color: '#0f62fe',
  startTimeTimeFormat: 'AM',
  endTimeTimeFormat: 'PM',
};

describe('appointment service validation', () => {
  it('accepts a complete, realistic service schedule', async () => {
    await expect(validationSchema.validate(validService)).resolves.toBeTruthy();
  });

  it('requires a concrete location uuid', async () => {
    await expect(
      validationSchema.validate({ ...validService, location: { uuid: '', display: '' } }),
    ).rejects.toThrow('locationRequired');
  });

  it.each([0, 1.5, 1441])('rejects an unrealistic duration: %s', async (durationMins) => {
    await expect(validationSchema.validate({ ...validService, durationMins })).rejects.toThrow();
  });

  it.each(['00:30', '13:00', '08:99'])('rejects an invalid 12-hour time: %s', async (startTime) => {
    await expect(validationSchema.validate({ ...validService, startTime })).rejects.toThrow(
      'appointmentServiceTimeInvalid',
    );
  });

  it('requires the end time to be later than the start time', async () => {
    await expect(
      validationSchema.validate({
        ...validService,
        startTime: '05:00',
        startTimeTimeFormat: 'PM',
        endTime: '04:59',
        endTimeTimeFormat: 'PM',
      }),
    ).rejects.toThrow('appointmentServiceEndAfterStart');
  });

  it('rejects an invalid color and an overlong name', async () => {
    await expect(validationSchema.validate({ ...validService, color: 'blue' })).rejects.toThrow('colorInvalid');
    await expect(validationSchema.validate({ ...validService, name: 'x'.repeat(51) })).rejects.toThrow(
      'appointmentServiceNameTooLong',
    );
  });

  it('requires the duration to fit within the configured service window', async () => {
    await expect(
      validationSchema.validate({
        ...validService,
        startTime: '08:00',
        endTime: '08:29',
        endTimeTimeFormat: 'AM',
        durationMins: 30,
      }),
    ).rejects.toThrow('appointmentServiceDurationExceedsWindow');
  });
});
