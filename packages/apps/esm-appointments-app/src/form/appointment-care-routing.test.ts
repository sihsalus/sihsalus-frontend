import { type AppointmentArrivalRule } from '../config-schema';
import { type AppointmentService } from '../types';
import {
  filterAppointmentLocationsByServices,
  filterAppointmentServicesByLocation,
  getAppointmentCareRoutingIssue,
} from './appointment-care-routing';

const service = {
  uuid: 'service-uuid',
  location: { uuid: 'upss-uuid' },
} as AppointmentService;

const directRule: AppointmentArrivalRule = {
  appointmentServiceUuid: service.uuid,
  appointmentLocationUuid: service.location.uuid,
  arrivalPolicy: 'direct',
  requiredVisitTypeUuid: 'visit-type-uuid',
};

const baseInput = {
  appointmentArrivalRules: [directRule],
  enforceArrivalRouting: true,
  selectableLocationUuids: new Set(['upss-uuid']),
  selectedLocationUuid: 'upss-uuid',
  service,
};

describe('appointment care routing', () => {
  it('only exposes UPSS that have an available appointment service', () => {
    const locations = [{ uuid: 'upss-uuid' }, { uuid: 'upss-without-services' }];

    expect(
      filterAppointmentLocationsByServices({
        enforceArrivalRouting: true,
        locations,
        services: [service],
      }),
    ).toEqual([{ uuid: 'upss-uuid' }]);
  });

  it('keeps tagged UPSS compatible when the canonical routing contract is disabled', () => {
    const locations = [{ uuid: 'upss-uuid' }, { uuid: 'legacy-upss' }];

    expect(
      filterAppointmentLocationsByServices({
        enforceArrivalRouting: false,
        locations,
        services: [{ ...service, location: undefined }],
      }),
    ).toEqual(locations);
  });

  it('filters services by the UPSS selected first', () => {
    const otherService = {
      ...service,
      uuid: 'other-service-uuid',
      location: { uuid: 'other-upss-uuid' },
    } as AppointmentService;

    expect(
      filterAppointmentServicesByLocation({
        enforceArrivalRouting: true,
        selectedLocationUuid: 'upss-uuid',
        services: [otherService, service],
      }),
    ).toEqual([service]);
  });

  it('does not expose services before a UPSS is selected', () => {
    expect(
      filterAppointmentServicesByLocation({
        enforceArrivalRouting: true,
        selectedLocationUuid: '',
        services: [service],
      }),
    ).toEqual([]);
  });

  it('accepts one exact service-UPSS route', () => {
    expect(getAppointmentCareRoutingIssue(baseInput)).toBeNull();
  });

  it('rejects a service without a configured UPSS when routing is enforced', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        service: { ...service, location: undefined },
      }),
    ).toBe('service-location-missing');
  });

  it('rejects a configured UPSS that is no longer selectable', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        selectableLocationUuids: new Set(['other-upss-uuid']),
      }),
    ).toBe('service-location-unavailable');
  });

  it('rejects a selected UPSS that differs from the service UPSS', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        selectableLocationUuids: new Set(['upss-uuid', 'other-upss-uuid']),
        selectedLocationUuid: 'other-upss-uuid',
      }),
    ).toBe('service-location-mismatch');
  });

  it('fails closed when the exact arrival route is missing', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        appointmentArrivalRules: [],
      }),
    ).toBe('arrival-rule-missing');
  });

  it('fails closed when the exact arrival route is ambiguous', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        appointmentArrivalRules: [directRule, { ...directRule }],
      }),
    ).toBe('arrival-rule-ambiguous');
  });

  it('fails closed when the exact arrival route is incomplete', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        appointmentArrivalRules: [{ ...directRule, arrivalPolicy: 'queue-required' }],
      }),
    ).toBe('arrival-rule-invalid');
  });

  it('keeps upstream installations compatible when no routing contract is enabled', () => {
    expect(
      getAppointmentCareRoutingIssue({
        ...baseInput,
        appointmentArrivalRules: [],
        enforceArrivalRouting: false,
        service: { ...service, location: undefined },
      }),
    ).toBeNull();
  });
});
