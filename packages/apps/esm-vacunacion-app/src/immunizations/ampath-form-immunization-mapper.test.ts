import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import type { ImmunizationFormData } from '../types';
import {
  mapFromAmpathImmunizationEncounters,
  mapToAmpathImmunizationEncounterPayload,
  mergeImmunizationGroups,
} from './ampath-form-immunization-mapper';

const config = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

describe('AMPATH immunization form mapper', () => {
  it('maps the custom vaccination UI model to an OpenMRS encounter payload', () => {
    const immunization: ImmunizationFormData = {
      patientUuid: 'patient-uuid',
      immunizationId: undefined,
      vaccineName: 'BCG',
      vaccineUuid: 'vaccine-uuid',
      vaccinationDate: '2026-05-28T00:00:00.000Z',
      doseNumber: 1,
      status: 'completed',
      statusReason: '',
      programContext: 'routine',
      nextDoseDate: '2026-06-28T00:00:00.000Z',
      note: 'Aplicada sin eventos',
      expirationDate: '2026-12-31',
      lotNumber: 'LOT-1',
      manufacturer: 'MINSA',
    };

    const payload = mapToAmpathImmunizationEncounterPayload(immunization, config, 'visit-uuid', 'location-uuid');

    expect(payload).toMatchObject({
      patient: 'patient-uuid',
      encounterType: config.ampathFormPersistence.encounterTypeUuid,
      form: config.ampathFormPersistence.formUuid,
      visit: 'visit-uuid',
      location: 'location-uuid',
      encounterDatetime: '2026-05-28T00:00:00.000Z',
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.vaccineUuid, value: 'vaccine-uuid' },
        { concept: config.ampathFormPersistence.concepts.doseNumber, value: 1 },
        { concept: config.ampathFormPersistence.concepts.lotNumber, value: 'LOT-1' },
      ]),
    );
  });

  it('maps OpenMRS AMPATH form encounters back to grouped immunizations', () => {
    const groups = mapFromAmpathImmunizationEncounters(
      [
        {
          uuid: 'encounter-uuid',
          encounterDatetime: '2026-05-28T10:30:00.000Z',
          visit: { uuid: 'visit-uuid' },
          obs: [
            {
              concept: { uuid: config.ampathFormPersistence.concepts.vaccineUuid },
              value: { uuid: 'vaccine-uuid', display: 'BCG' },
            },
            {
              concept: { uuid: config.ampathFormPersistence.concepts.vaccinationDate },
              value: '2026-05-28T00:00:00.000Z',
            },
            { concept: { uuid: config.ampathFormPersistence.concepts.doseNumber }, value: 1 },
            { concept: { uuid: config.ampathFormPersistence.concepts.status }, value: 'completed' },
            { concept: { uuid: config.ampathFormPersistence.concepts.programContext }, value: 'routine' },
          ],
        },
      ],
      config,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      vaccineUuid: 'vaccine-uuid',
      vaccineName: 'BCG',
      existingDoses: [
        {
          persistenceSource: 'ampath-form',
          immunizationObsUuid: 'encounter-uuid',
          doseNumber: 1,
          occurrenceDateTime: '2026-05-28T00:00:00.000Z',
        },
      ],
    });
  });

  it('merges FHIR and AMPATH groups by vaccine UUID', () => {
    const merged = mergeImmunizationGroups(
      [
        {
          vaccineUuid: 'vaccine-uuid',
          vaccineName: 'BCG',
          existingDoses: [
            {
              persistenceSource: 'fhir',
              immunizationObsUuid: 'fhir-dose',
              occurrenceDateTime: '2026-05-01T00:00:00.000Z',
              doseNumber: 1,
              expirationDate: '',
              lotNumber: '',
              manufacturer: '',
              nextDoseDate: '',
              note: [],
            },
          ],
        },
      ],
      [
        {
          vaccineUuid: 'vaccine-uuid',
          vaccineName: 'BCG',
          existingDoses: [
            {
              persistenceSource: 'ampath-form',
              immunizationObsUuid: 'ampath-dose',
              occurrenceDateTime: '2026-06-01T00:00:00.000Z',
              doseNumber: 2,
              expirationDate: '',
              lotNumber: '',
              manufacturer: '',
              nextDoseDate: '',
              note: [],
            },
          ],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].existingDoses.map((dose) => dose.immunizationObsUuid)).toEqual(['ampath-dose', 'fhir-dose']);
  });
});
