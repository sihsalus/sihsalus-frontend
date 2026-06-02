import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type OdontogramConfig } from '../config-schema';
import {
  getOdontogramDataFromEncounter,
  getOdontogramRecordTypeFromEncounter,
  getParentBaseEncounterUuidFromEncounter,
  mapToAmpathOdontogramEncounterPayload,
} from './ampath-form-odontogram-mapper';
import { adultConfig } from './config/adultConfig';
import { createEmptyOdontogramData } from './types/odontogram';

const config = getDefaultsFromConfigSchema(configSchema) as OdontogramConfig;

describe('AMPATH odontogram form mapper', () => {
  it('maps odontogram UI state to an OpenMRS encounter payload', () => {
    const data = createEmptyOdontogramData(adultConfig);
    data.teeth[0].findings.push({
      id: 'finding-1',
      findingId: 1,
      subOptionId: 2,
      color: { id: 1, name: 'red' },
    });

    const payload = mapToAmpathOdontogramEncounterPayload({
      activeBaseEncounterUuid: null,
      config,
      data,
      encounterTypeUuid: config.baseEncounterTypeUuid,
      patientUuid: 'patient-uuid',
      recordType: 'base',
    });

    expect(payload).toMatchObject({
      patient: 'patient-uuid',
      encounterType: config.baseEncounterTypeUuid,
      form: config.ampathFormPersistence.baseFormUuid,
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.recordType, value: 'base' },
        { concept: config.ampathFormPersistence.concepts.snapshot, value: JSON.stringify(data) },
      ]),
    );
  });

  it('maps attention odontogram state with its parent base encounter', () => {
    const data = createEmptyOdontogramData(adultConfig);

    const payload = mapToAmpathOdontogramEncounterPayload({
      activeBaseEncounterUuid: 'base-encounter',
      config,
      data,
      encounterTypeUuid: config.attentionEncounterTypeUuid,
      patientUuid: 'patient-uuid',
      recordType: 'attention',
    });

    expect(payload).toMatchObject({
      patient: 'patient-uuid',
      encounterType: config.attentionEncounterTypeUuid,
      form: config.ampathFormPersistence.attentionFormUuid,
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.recordType, value: 'attention' },
        { concept: config.ampathFormPersistence.concepts.parentBaseEncounterUuid, value: 'base-encounter' },
        { concept: config.ampathFormPersistence.concepts.snapshot, value: JSON.stringify(data) },
      ]),
    );
  });

  it('reads the odontogram snapshot and parent base from an OpenMRS encounter', () => {
    const data = createEmptyOdontogramData(adultConfig);
    const encounter = {
      uuid: 'attention-encounter',
      encounterDatetime: '2026-05-28T10:30:00.000Z',
      obs: [
        { concept: { uuid: config.ampathFormPersistence.concepts.snapshot }, value: JSON.stringify(data) },
        { concept: { uuid: config.ampathFormPersistence.concepts.recordType }, value: 'attention' },
        {
          concept: { uuid: config.ampathFormPersistence.concepts.parentBaseEncounterUuid },
          value: 'base-encounter',
        },
      ],
    };

    expect(getOdontogramRecordTypeFromEncounter(encounter, config, 'base')).toBe('attention');
    expect(getParentBaseEncounterUuidFromEncounter(encounter, config)).toBe('base-encounter');
    expect(getOdontogramDataFromEncounter(encounter, config)).toEqual(data);
  });
});
