import {
  appointmentServicesSearchParam,
  getAppointmentServiceFilterSearch,
  getAppointmentServiceTypes,
} from './useAppointmentServiceFilter';

describe('appointment service filter URL state', () => {
  it('reads, trims and deduplicates multiple selected services', () => {
    const searchParams = new URLSearchParams({
      [appointmentServicesSearchParam]: 'service-one, service-two,service-one',
    });

    expect(getAppointmentServiceTypes(searchParams)).toEqual(['service-one', 'service-two']);
  });

  it('supports legacy service routes until query state is available', () => {
    expect(getAppointmentServiceTypes(new URLSearchParams(), 'legacy-service')).toEqual(['legacy-service']);
    expect(
      getAppointmentServiceTypes(
        new URLSearchParams({
          [appointmentServicesSearchParam]: '',
        }),
        'legacy-service',
      ),
    ).toEqual([]);
  });

  it('serializes selected services for calendar and back navigation', () => {
    const search = getAppointmentServiceFilterSearch(['service-one', 'service-two', 'service-one']);
    const searchParams = new URLSearchParams(search);

    expect(getAppointmentServiceTypes(searchParams)).toEqual(['service-one', 'service-two']);
    expect(getAppointmentServiceFilterSearch([])).toBe('');
  });
});
