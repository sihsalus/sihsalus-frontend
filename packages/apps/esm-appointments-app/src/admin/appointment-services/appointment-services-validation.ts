import * as Yup from 'yup';

const time12HourPattern = /^(0?[1-9]|1[0-2]):([0-5]\d)$/u;

const toMinutes = (time: string, format: string) => {
  const match = time12HourPattern.exec(time ?? '');
  if (!match || !['AM', 'PM'].includes(format)) {
    return null;
  }
  const [, hoursText, minutesText] = match;
  const hours = (Number(hoursText) % 12) + (format === 'PM' ? 12 : 0);
  return hours * 60 + Number(minutesText);
};

export const validationSchema = Yup.object({
  description: Yup.string().optional(),
  durationMins: Yup.number()
    .typeError('durationMinsRequired')
    .integer('durationMinsInteger')
    .min(1, 'durationMinsOutOfRange')
    .max(1440, 'durationMinsOutOfRange')
    .required('durationMinsRequired'),
  endTime: Yup.string().matches(time12HourPattern, 'appointmentServiceTimeInvalid').required('endTimeRequired'),
  initialAppointmentStatus: Yup.string().optional(),
  location: Yup.object({
    uuid: Yup.string().trim().required('locationRequired'),
    display: Yup.string().optional(),
  }).required('locationRequired'),
  maxAppointmentsLimit: Yup.number().integer('maxAppointmentLimitInteger').min(0, 'maxAppointmentLimitRequired').required('maxAppointmentLimitRequired'),
  name: Yup.string().trim().max(50, 'appointmentServiceNameTooLong').required('appointmentServiceNameRequired'),
  specialityUuid: Yup.string().optional(),
  startTime: Yup.string().matches(time12HourPattern, 'appointmentServiceTimeInvalid').required('startTimeRequired'),
  color: Yup.string().matches(/^#[0-9a-f]{6}$/iu, 'colorInvalid').required('colorRequired'),
  startTimeTimeFormat: Yup.string().oneOf(['AM', 'PM'], 'startTimeFormatRequired').required('startTimeFormatRequired'),
  endTimeTimeFormat: Yup.string().oneOf(['AM', 'PM'], 'endTimeFormatRequired').required('endTimeFormatRequired'),
}).test('end-after-start', 'appointmentServiceEndAfterStart', function (values) {
  const start = toMinutes(values.startTime, values.startTimeTimeFormat);
  const end = toMinutes(values.endTime, values.endTimeTimeFormat);
  if (start === null || end === null || end > start) {
    return true;
  }
  return this.createError({ path: 'endTime', message: 'appointmentServiceEndAfterStart' });
}).test('duration-fits-service-window', 'appointmentServiceDurationExceedsWindow', function (values) {
  const start = toMinutes(values.startTime, values.startTimeTimeFormat);
  const end = toMinutes(values.endTime, values.endTimeTimeFormat);
  const duration = Number(values.durationMins);
  if (start === null || end === null || end <= start || !Number.isFinite(duration) || duration <= end - start) {
    return true;
  }
  return this.createError({ path: 'durationMins', message: 'appointmentServiceDurationExceedsWindow' });
});
