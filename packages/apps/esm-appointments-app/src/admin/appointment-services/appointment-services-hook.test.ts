import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { type AppointmentService } from '../../types';
import {
  AppointmentServiceCatalogInvalidError,
  fetchAppointmentServices,
  hasSameAppointmentServiceName,
  isSameAppointmentService,
  toTwentyFourHourServiceTime,
} from './appointment-services-hook';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const service: AppointmentService = {
  appointmentServiceId: 1,
  creatorName: 'Admin',
  description: '',
  durationMins: 30,
  endTime: '17:30:00',
  initialAppointmentStatus: 'Scheduled',
  location: { uuid: 'location-uuid', display: 'Consulta externa' },
  maxAppointmentsLimit: null,
  name: 'Medicina General',
  startTime: '08:00:00',
  uuid: 'service-uuid',
  color: '#0f62fe',
};

describe('appointment service safety helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['12:00', 'AM', '00:00:00'],
    ['12:00', 'PM', '12:00:00'],
    ['1:05', 'PM', '13:05:00'],
  ])('converts %s %s to the backend 24-hour value', (value, format, expected) => {
    expect(toTwentyFourHourServiceTime(value, format)).toBe(expected);
  });

  it.each(['00:30', '13:00', '09:99', '09:00:00'])('rejects an invalid 12-hour service time: %s', (value) => {
    expect(() => toTwentyFourHourServiceTime(value, 'AM')).toThrow('Invalid appointment service time');
  });

  it('matches the same normalized service identity and schedule', () => {
    expect(
      isSameAppointmentService(service, {
        name: '  MEDICINA   general ',
        startTime: '08:00:00',
        endTime: '17:30:00',
        durationMins: 30,
        color: '#0f62fe',
        locationUuid: 'location-uuid',
      }),
    ).toBe(true);
  });

  it('uses the backend name-only uniqueness rule but requires exact persisted settings for reconciliation', () => {
    const payload = {
      name: service.name,
      startTime: service.startTime,
      endTime: service.endTime,
      durationMins: 45,
      color: '#da1e28',
      locationUuid: service.location?.uuid ?? '',
    };

    expect(hasSameAppointmentServiceName(service, payload.name)).toBe(true);
    expect(
      isSameAppointmentService(service, payload),
    ).toBe(false);
  });

  it.each([
    { color: 62 },
    { color: 'blue' },
    { durationMins: '30' },
    { durationMins: 0 },
    { startTime: '25:00:00' },
    { endTime: '17:75:00' },
    { location: null },
  ])('never throws or reconciles malformed persisted settings: %j', (overrides) => {
    expect(() =>
      isSameAppointmentService({ ...service, ...overrides } as AppointmentService, {
        name: service.name,
        startTime: service.startTime,
        endTime: service.endTime,
        durationMins: service.durationMins,
        color: service.color,
        locationUuid: service.location?.uuid ?? '',
      }),
    ).not.toThrow();
    expect(
      isSameAppointmentService({ ...service, ...overrides } as AppointmentService, {
        name: service.name,
        startTime: service.startTime,
        endTime: service.endTime,
        durationMins: service.durationMins,
        color: service.color,
        locationUuid: service.location?.uuid ?? '',
      }),
    ).toBe(false);
  });

  it('accepts a legacy unrelated catalog entry but does not treat it as an exact reconciliation match', async () => {
    const legacyService = { ...service, uuid: 'legacy-uuid', name: 'Servicio legado', location: null, color: null };
    mockOpenmrsFetch.mockResolvedValue({ data: [legacyService] } as FetchResponse<unknown>);

    await expect(fetchAppointmentServices()).resolves.toEqual([legacyService]);
    expect(
      isSameAppointmentService(legacyService as AppointmentService, {
        name: 'Medicina General',
        startTime: '08:00:00',
        endTime: '17:30:00',
        durationMins: 30,
        color: '#0f62fe',
        locationUuid: 'location-uuid',
      }),
    ).toBe(false);
  });

  it('loads a structurally valid catalog', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: [service] } as FetchResponse<Array<AppointmentService>>);

    await expect(fetchAppointmentServices()).resolves.toEqual([service]);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/appointmentService/all/full`);
  });

  it.each([
    { data: null },
    { data: {} },
    { data: [{ ...service, uuid: '' }] },
    { data: [{ ...service, name: '' }] },
    { data: [service, { ...service }] },
  ])(
    'fails closed on an invalid catalog response',
    async (response) => {
      mockOpenmrsFetch.mockResolvedValue(response as FetchResponse<unknown>);

      await expect(fetchAppointmentServices()).rejects.toBeInstanceOf(AppointmentServiceCatalogInvalidError);
    },
  );
});
