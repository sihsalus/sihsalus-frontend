import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';

import {
  buildGeneratedSlots,
  isShiftInsideAvailability,
  type ResourceAvailability,
  type StaffSchedulingData,
  type StaffShift,
  useStaffSchedulingData,
} from './staff-scheduling.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

vi.mock('swr', () => ({ default: vi.fn() }));

const mockUseSWR = vi.mocked(useSWR);
const response = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
};

const availability: ResourceAvailability = {
  id: 'availability-synthetic',
  locationUuid: 'location-synthetic',
  locationName: 'Consultorio sintético',
  daysOfWeek: [1, 3],
  startTime: '08:00',
  endTime: '10:00',
  active: true,
};

const shift: StaffShift = {
  id: 'shift-synthetic',
  date: '2026-11-02',
  providerUuid: 'provider-synthetic',
  providerName: 'Profesional sintético',
  locationUuid: availability.locationUuid,
  locationName: availability.locationName,
  serviceUuid: 'service-synthetic',
  serviceName: 'Servicio sintético',
  startTime: '08:00',
  endTime: '09:10',
  slotMinutes: 30,
  capacityPerSlot: 3,
  status: 'published',
};

describe('loading the stored staff roster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue(response);
  });

  it('keeps the roster loading until a response is available', () => {
    mockUseSWR.mockReturnValue({ ...response, isLoading: true });

    const { result } = renderHook(() => useStaffSchedulingData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.settingUuid).toBeNull();
    expect(result.current.schedulingData.shifts).toEqual([]);
  });

  it('starts an empty roster only when no stored setting exists', () => {
    mockUseSWR.mockReturnValue({ ...response, data: { data: { results: [] } } });

    const { result } = renderHook(() => useStaffSchedulingData());

    expect(result.current.error).toBeNull();
    expect(result.current.settingUuid).toBeNull();
    expect(result.current.schedulingData).toMatchObject({
      version: 1,
      resourceAvailabilities: [],
      shifts: [],
    });
  });

  it('reads the exact roster property and preserves its version, availability and shifts', () => {
    const roster: StaffSchedulingData = {
      version: 7,
      updatedAt: '2026-11-01T12:00:00Z',
      resourceAvailabilities: [availability],
      shifts: [shift],
    };
    mockUseSWR.mockReturnValue({
      ...response,
      data: {
        data: {
          results: [
            { uuid: 'another-setting', property: 'sihsalus.staffScheduling.roster.archived', value: '{}' },
            { uuid: 'roster-setting', property: 'sihsalus.staffScheduling.roster', value: JSON.stringify(roster) },
          ],
        },
      },
    });

    const { result } = renderHook(() => useStaffSchedulingData());

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/ws/rest/v1/systemsetting?q=sihsalus.staffScheduling.roster&v=default',
      openmrsFetch,
    );
    expect(result.current.settingUuid).toBe('roster-setting');
    expect(result.current.schedulingData).toEqual(roster);
    expect(result.current.error).toBeNull();
  });

  it('reports unreadable stored JSON as an error instead of a successful empty roster', () => {
    mockUseSWR.mockReturnValue({
      ...response,
      data: {
        data: {
          results: [{ uuid: 'roster-setting', property: 'sihsalus.staffScheduling.roster', value: '{invalid' }],
        },
      },
    });

    const { result } = renderHook(() => useStaffSchedulingData());

    expect(result.current.settingUuid).toBe('roster-setting');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('guardada está dañada');
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('preserves a failed lookup as an error for the caller to block editing', () => {
    const error = new Error('Synthetic request failure');
    mockUseSWR.mockReturnValue({ ...response, error });

    const { result } = renderHook(() => useStaffSchedulingData());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });
});

describe('generated appointment slots', () => {
  it('keeps complete intervals inside the shift and preserves resource identity and capacity', () => {
    const slots = buildGeneratedSlots([shift]);

    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => [slot.startDateTime, slot.endDateTime])).toEqual([
      [new Date(2026, 10, 2, 8, 0).toISOString(), new Date(2026, 10, 2, 8, 30).toISOString()],
      [new Date(2026, 10, 2, 8, 30).toISOString(), new Date(2026, 10, 2, 9, 0).toISOString()],
    ]);
    for (const slot of slots) {
      expect(slot).toMatchObject({
        shiftId: shift.id,
        providerUuid: shift.providerUuid,
        locationUuid: shift.locationUuid,
        serviceUuid: shift.serviceUuid,
        capacity: 3,
        status: 'published',
      });
    }
  });

  it('retains draft slots but excludes suspended shifts', () => {
    const slots = buildGeneratedSlots([
      { ...shift, id: 'draft-shift', status: 'draft' },
      { ...shift, id: 'suspended-shift', status: 'suspended' },
    ]);

    expect(slots).toHaveLength(2);
    expect(slots.every((slot) => slot.shiftId === 'draft-shift' && slot.status === 'draft')).toBe(true);
  });
});

describe('location availability', () => {
  it('accepts a shift matching both availability boundaries on the configured weekday', () => {
    expect(isShiftInsideAvailability({ ...shift, endTime: '10:00' }, [availability])).toBe(true);
  });

  it.each([
    ['another location', { locationUuid: 'another-location' }],
    ['an inactive availability', { active: false }],
    ['another weekday', { daysOfWeek: [2] }],
    ['an earlier closing time', { endTime: '09:00' }],
    ['a later opening time', { startTime: '08:30' }],
  ] satisfies Array<[string, Partial<ResourceAvailability>]>)('rejects %s', (_label, patch) => {
    expect(isShiftInsideAvailability(shift, [{ ...availability, ...patch }])).toBe(false);
  });
});
