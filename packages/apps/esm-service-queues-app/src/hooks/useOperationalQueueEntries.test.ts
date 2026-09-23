import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';

import { type ConfigObject, configSchema } from '../config-schema';
import { type QueueEntry } from '../types';
import {
  getOperationalQueueLocationUuid,
  matchesOperationalQueueLocation,
  useOperationalQueueEntries,
} from './useOperationalQueueEntries';
import { useQueueEntries } from './useQueueEntries';

vi.mock('./useQueueEntries');

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseQueueEntries = vi.mocked(useQueueEntries);
const triageQueueUuid = 'shared-triage-queue';

function makeQueueEntry({
  visitLocation,
  queueLocation,
  queueUuid = 'queue-uuid',
}: {
  visitLocation?: string;
  queueLocation?: string;
  queueUuid?: string;
}) {
  return {
    uuid: 'queue-entry-uuid',
    queue: {
      uuid: queueUuid,
      location: queueLocation ? { uuid: queueLocation } : undefined,
    },
    visit: visitLocation ? { uuid: 'visit-uuid', location: { uuid: visitLocation } } : undefined,
  } as QueueEntry;
}

describe('operational queue location', () => {
  it('uses the visit UPSS only for the configured shared triage queue', () => {
    const triageEntry = makeQueueEntry({
      queueUuid: triageQueueUuid,
      visitLocation: 'upss-consulta-externa',
      queueLocation: 'hospital',
    });

    expect(getOperationalQueueLocationUuid(triageEntry, triageQueueUuid)).toBe('upss-consulta-externa');
    expect(matchesOperationalQueueLocation(triageEntry, 'upss-consulta-externa', triageQueueUuid)).toBe(true);
    expect(matchesOperationalQueueLocation(triageEntry, 'hospital', triageQueueUuid)).toBe(false);
  });

  it.each([
    'upss-hospitalizacion',
    'upss-emergencia',
  ])('keeps a transfer from %s visible in Centro Obstétrico', (visitLocation) => {
    const entry = makeQueueEntry({ visitLocation, queueLocation: 'upss-centro-obstetrico' });

    expect(getOperationalQueueLocationUuid(entry, triageQueueUuid)).toBe('upss-centro-obstetrico');
    expect(matchesOperationalQueueLocation(entry, 'upss-centro-obstetrico', triageQueueUuid)).toBe(true);
    expect(matchesOperationalQueueLocation(entry, visitLocation, triageQueueUuid)).toBe(false);
  });

  it.each([
    undefined,
    '',
    'another-triage-queue',
  ])('does not infer shared triage when its configured UUID is %s', (configuredTriageUuid) => {
    const entry = makeQueueEntry({
      queueUuid: triageQueueUuid,
      visitLocation: 'upss-consulta-externa',
      queueLocation: 'hospital',
    });

    expect(getOperationalQueueLocationUuid(entry, configuredTriageUuid)).toBe('hospital');
  });

  it.each(['administrative-queue', triageQueueUuid])('uses the location of %s when there is no visit', (queueUuid) => {
    const entry = makeQueueEntry({ queueUuid, queueLocation: 'hospital' });

    expect(getOperationalQueueLocationUuid(entry, triageQueueUuid)).toBe('hospital');
    expect(matchesOperationalQueueLocation(entry, 'hospital', triageQueueUuid)).toBe(true);
  });

  it('falls back to the visit location when the queue location is unavailable', () => {
    const entry = makeQueueEntry({ visitLocation: 'upss-centro-obstetrico' });

    expect(getOperationalQueueLocationUuid(entry, triageQueueUuid)).toBe('upss-centro-obstetrico');
  });

  it('does not mix entries from another UPSS', () => {
    const rehabilitationEntry = makeQueueEntry({
      visitLocation: 'upss-consulta-externa',
      queueLocation: 'upss-rehabilitacion',
    });

    expect(matchesOperationalQueueLocation(rehabilitationEntry, 'upss-consulta-externa', triageQueueUuid)).toBe(false);
  });

  it('matches multiple selected UPSS using the current queue destination', () => {
    const entry = makeQueueEntry({ visitLocation: 'upss-hospitalizacion', queueLocation: 'upss-centro-obstetrico' });

    expect(matchesOperationalQueueLocation(entry, ['upss-emergencia', 'upss-centro-obstetrico'])).toBe(true);
    expect(matchesOperationalQueueLocation(entry, ['upss-emergencia', 'upss-hospitalizacion'])).toBe(false);
  });

  it('keeps every location when Todo is selected', () => {
    const entryWithoutLocation = makeQueueEntry({});

    expect(matchesOperationalQueueLocation(entryWithoutLocation, null)).toBe(true);
    expect(matchesOperationalQueueLocation(entryWithoutLocation, [])).toBe(true);
    expect(matchesOperationalQueueLocation(entryWithoutLocation, '')).toBe(true);
    expect(matchesOperationalQueueLocation(entryWithoutLocation, [''])).toBe(true);
    expect(matchesOperationalQueueLocation(entryWithoutLocation, 'upss-centro-obstetrico')).toBe(false);
    expect(getOperationalQueueLocationUuid(entryWithoutLocation, triageQueueUuid)).toBeUndefined();
  });
});

describe('useOperationalQueueEntries', () => {
  const triageEntry = makeQueueEntry({
    queueUuid: triageQueueUuid,
    visitLocation: 'upss-consulta-externa',
    queueLocation: 'hospital',
  });
  const transferredEntry = makeQueueEntry({
    visitLocation: 'upss-hospitalizacion',
    queueLocation: 'upss-centro-obstetrico',
  });

  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema<ConfigObject>(configSchema));
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [triageEntry, transferredEntry],
      totalCount: 2,
      isLoading: true,
      isValidating: true,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('filters transfers without restricting the backend query to the original visit location', () => {
    const { result } = renderHook(() =>
      useOperationalQueueEntries({ location: 'upss-centro-obstetrico', isEnded: false }),
    );

    expect(mockUseQueueEntries).toHaveBeenLastCalledWith({ location: null, isEnded: false });
    expect(result.current.queueEntries).toEqual([transferredEntry]);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isValidating).toBe(true);
  });

  it('reapplies shared-triage routing when its configuration becomes available', () => {
    const { result, rerender } = renderHook(() =>
      useOperationalQueueEntries({ location: 'upss-consulta-externa', isEnded: false }),
    );
    expect(result.current.queueEntries).toEqual([]);

    const config = getDefaultsFromConfigSchema<ConfigObject>(configSchema);
    config.appointmentTriage.triageRouting.queueUuid = triageQueueUuid;
    mockUseConfig.mockReturnValue(config);
    rerender();

    expect(result.current.queueEntries).toEqual([triageEntry]);
    expect(result.current.totalCount).toBe(1);
  });
});
