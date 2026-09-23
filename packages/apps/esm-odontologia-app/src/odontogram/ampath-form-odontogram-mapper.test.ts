import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type OdontogramConfig } from '../config-schema';
import {
  applyExistingObsUuids,
  getOdontogramDataFromEncounter,
  getOdontogramRecordTypeFromEncounter,
  getParentBaseEncounterUuidFromEncounter,
  mapToAmpathOdontogramEncounterPayload,
} from './ampath-form-odontogram-mapper';
import { adultConfig } from './config/adultConfig';
import { childConfig } from './config/childConfig';
import { getOdontogramConfig } from './config/dentition';
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
    expect(payload).not.toHaveProperty('encounterDatetime');
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

  it.each([
    'base',
    'attention',
  ] as const)('round-trips the complete primary %s snapshot and updates its existing observation', (recordType) => {
    const data = createEmptyOdontogramData(childConfig);
    const finding = { id: 'synthetic-finding', findingId: 1, color: { id: 1, name: 'red' } };
    data.teeth[0].findings = [finding];
    data.teeth[0].notes = 'Synthetic tooth note';
    data.teeth[0].annotations = [{ findingId: 1, text: 'Synthetic annotation', color: 'red' }];
    data.spacingFindings[1][0].findings = [finding];
    data.legendSpaces[0].findings = [finding];
    data.especificaciones = 'Synthetic specification';
    data.observaciones = 'Synthetic observation';
    const snapshotConcept = config.ampathFormPersistence.concepts.snapshot;
    const payload = mapToAmpathOdontogramEncounterPayload({
      config,
      data,
      recordType,
      activeBaseEncounterUuid: 'primary-base',
      patientUuid: 'synthetic-patient',
      encounterTypeUuid: recordType === 'base' ? config.baseEncounterTypeUuid : config.attentionEncounterTypeUuid,
    });
    const existingObs = [{ uuid: 'existing-snapshot', concept: { uuid: snapshotConcept } }];
    const update = applyExistingObsUuids(payload, existingObs);
    expect(update.obs.filter((obs) => obs.concept === snapshotConcept)).toEqual([
      { uuid: 'existing-snapshot', concept: snapshotConcept, value: JSON.stringify(data) },
    ]);
    const encounter = {
      uuid: 'existing-encounter',
      encounterDatetime: '2026-09-22T10:00:00.000Z',
      obs: update.obs.map((obs) => ({ ...obs, concept: { uuid: obs.concept } })),
    };
    const reloaded = getOdontogramDataFromEncounter(encounter, config);
    expect(reloaded).toEqual(data);
    expect(getOdontogramConfig(reloaded)).toBe(childConfig);
    if (recordType === 'attention')
      expect(getParentBaseEncounterUuidFromEncounter(encounter, config)).toBe('primary-base');
  });

  describe('applyExistingObsUuids', () => {
    const basePayload = {
      patient: 'patient-uuid',
      encounterType: config.baseEncounterTypeUuid,
      form: config.ampathFormPersistence.baseFormUuid,
      encounterDatetime: '2026-05-28T10:30:00.000Z',
      obs: [
        { concept: config.ampathFormPersistence.concepts.snapshot, value: '{"teeth":[]}' },
        { concept: config.ampathFormPersistence.concepts.recordType, value: 'base' },
      ],
    };

    it('reuses the existing obs uuid per concept so updates edit in place', () => {
      const result = applyExistingObsUuids(basePayload, [
        { uuid: 'obs-snapshot', concept: { uuid: config.ampathFormPersistence.concepts.snapshot } },
        { uuid: 'obs-record-type', concept: { uuid: config.ampathFormPersistence.concepts.recordType } },
      ]);

      expect(result.obs).toEqual([
        { uuid: 'obs-snapshot', concept: config.ampathFormPersistence.concepts.snapshot, value: '{"teeth":[]}' },
        { uuid: 'obs-record-type', concept: config.ampathFormPersistence.concepts.recordType, value: 'base' },
      ]);
    });

    it('reuses the first obs uuid when a concept has duplicates and leaves unmatched entries untouched', () => {
      const result = applyExistingObsUuids(basePayload, [
        { uuid: 'obs-snapshot-old', concept: { uuid: config.ampathFormPersistence.concepts.snapshot } },
        { uuid: 'obs-snapshot-new', concept: { uuid: config.ampathFormPersistence.concepts.snapshot } },
      ]);

      expect(result.obs[0]).toEqual({
        uuid: 'obs-snapshot-old',
        concept: config.ampathFormPersistence.concepts.snapshot,
        value: '{"teeth":[]}',
      });
      // recordType had no existing obs → stays without a uuid (created fresh)
      expect(result.obs[1]).toEqual({
        concept: config.ampathFormPersistence.concepts.recordType,
        value: 'base',
      });
    });
  });
});
