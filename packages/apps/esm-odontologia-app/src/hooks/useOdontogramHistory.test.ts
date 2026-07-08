import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { configSchema, type OdontogramConfig } from '../config-schema';
import type { OdontogramEncounter } from '../odontogram/ampath-form-odontogram-mapper';
import { adultConfig } from '../odontogram/config/adultConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import { buildOdontogramRecords } from './useOdontogramHistory';

const config = getDefaultsFromConfigSchema(configSchema) as OdontogramConfig;

function encounter({
  date,
  parentBaseEncounterUuid,
  recordType,
  snapshot,
  uuid,
}: {
  date: string;
  parentBaseEncounterUuid?: string;
  recordType?: string;
  snapshot?: string;
  uuid: string;
}): OdontogramEncounter {
  const obs: OdontogramEncounter['obs'] = [];

  if (snapshot != null) {
    obs.push({ concept: { uuid: config.ampathFormPersistence.concepts.snapshot }, value: snapshot });
  }

  if (recordType != null) {
    obs.push({ concept: { uuid: config.ampathFormPersistence.concepts.recordType }, value: recordType });
  }

  if (parentBaseEncounterUuid != null) {
    obs.push({
      concept: { uuid: config.ampathFormPersistence.concepts.parentBaseEncounterUuid },
      value: parentBaseEncounterUuid,
    });
  }

  return { uuid, encounterDatetime: date, obs };
}

describe('buildOdontogramRecords', () => {
  it('keeps only encounters with a valid odontogram snapshot and matching record type', () => {
    const data = createEmptyOdontogramData(adultConfig);
    data.observaciones = 'snapshot valido';
    const snapshot = JSON.stringify(data);

    const records = buildOdontogramRecords(
      [
        encounter({
          uuid: 'without-snapshot',
          date: '2026-01-01T10:00:00.000Z',
          recordType: 'base',
        }),
        encounter({
          uuid: 'attention-in-base-list',
          date: '2026-01-02T10:00:00.000Z',
          recordType: 'attention',
          snapshot,
        }),
        encounter({
          uuid: 'bad-json',
          date: '2026-01-03T10:00:00.000Z',
          recordType: 'base',
          snapshot: '{bad-json',
        }),
        encounter({
          uuid: 'base',
          date: '2026-01-04T10:00:00.000Z',
          recordType: 'base',
          snapshot,
        }),
      ],
      config,
      'base',
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      encounterUuid: 'base',
      type: 'base',
      data,
    });
  });

  it('preserves the parent base link for attention records', () => {
    const data = createEmptyOdontogramData(adultConfig);
    const records = buildOdontogramRecords(
      [
        encounter({
          uuid: 'attention',
          date: '2026-01-05T10:00:00.000Z',
          parentBaseEncounterUuid: 'base-encounter',
          recordType: 'attention',
          snapshot: JSON.stringify(data),
        }),
      ],
      config,
      'attention',
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      encounterUuid: 'attention',
      parentBaseEncounterUuid: 'base-encounter',
      type: 'attention',
    });
  });
});
