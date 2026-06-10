import {
  createNextScheduleStore,
  normalizeScheduleData,
  scheduleEntriesToSequenceDefinitions,
  type VersionedScheduleData,
} from './vaccination-schedule.resource';

describe('vaccination schedule resource', () => {
  it('normalizes the previous single-version setting format', () => {
    const store = normalizeScheduleData({
      version: 2,
      updatedAt: '2026-06-01T00:00:00.000Z',
      entries: [{ conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'required' } }],
    });

    expect(store).toEqual({
      activeVersion: 2,
      versions: [
        {
          version: 2,
          status: 'published',
          updatedAt: '2026-06-01T00:00:00.000Z',
          entries: [{ conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'required' } }],
        },
      ],
    });
  });

  it('creates a new published version and retires the previous active version', () => {
    const currentStore: VersionedScheduleData = {
      activeVersion: 1,
      versions: [
        {
          version: 1,
          status: 'published',
          updatedAt: '2026-06-01T00:00:00.000Z',
          entries: [{ conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'required' } }],
        },
      ],
    };

    const nextStore = createNextScheduleStore(currentStore, {
      entries: [{ conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'optional' } }],
      updatedBy: 'Super User',
    });

    expect(nextStore.activeVersion).toBe(2);
    expect(nextStore.versions).toHaveLength(2);
    expect(nextStore.versions[0].status).toBe('retired');
    expect(nextStore.versions[1]).toMatchObject({
      version: 2,
      status: 'published',
      updatedBy: 'Super User',
      entries: [{ conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'optional' } }],
    });
  });

  it('converts the active schedule matrix into dose sequence definitions', () => {
    const sequences = scheduleEntriesToSequenceDefinitions({
      version: 1,
      status: 'published',
      updatedAt: '2026-06-01T00:00:00.000Z',
      entries: [
        {
          conceptUuid: 'pentavalente',
          name: 'Pentavalente',
          schedule: { '2m': 'required', '4m': 'required', '6m': 'optional' },
        },
      ],
    });

    expect(sequences).toEqual([
      {
        vaccineConceptUuid: 'pentavalente',
        sequences: [
          {
            sequenceLabel: '2m',
            sequenceNumber: 1,
            intervalInDaysAfterPreviousDose: undefined,
            minAgeInDays: 60,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '4m',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 120,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '6m opcional',
            sequenceNumber: 3,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 180,
            minsaLabel: '6 meses',
          },
        ],
      },
    ]);
  });
});
