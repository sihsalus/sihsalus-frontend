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

    const payload = mapToAmpathImmunizationEncounterPayload(immunization, config, {
      visitUuid: 'visit-uuid',
      locationUuid: 'location-uuid',
      formUuid: 'persisted-form-uuid',
      providerUuid: 'provider-uuid',
      recordedAt: '2026-05-28T15:30:00.000Z',
    });

    expect(payload).toMatchObject({
      patient: 'patient-uuid',
      encounterType: config.ampathFormPersistence.encounterTypeUuid,
      form: 'persisted-form-uuid',
      encounterProviders: [{ provider: 'provider-uuid', encounterRole: '738ba7c1-354f-47f8-b6d4-9d705ce05731' }],
      visit: 'visit-uuid',
      location: 'location-uuid',
      encounterDatetime: '2026-05-28T15:30:00.000Z',
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.vaccineUuid, value: 'vaccine-uuid' },
        { concept: config.ampathFormPersistence.concepts.vaccinationDate, value: '2026-05-28' },
        { concept: config.ampathFormPersistence.concepts.doseNumber, value: 1 },
        { concept: config.ampathFormPersistence.concepts.lotNumber, value: 'LOT-1' },
        { concept: config.ampathFormPersistence.concepts.expirationDate, value: '2026-12-31' },
        { concept: config.ampathFormPersistence.concepts.nextDoseDate, value: '2026-06-28' },
        { concept: 'af2ec074-87e5-4651-8e7f-5578bd111cf9', value: 'completed' },
        { concept: '5c45d979-90aa-4f27-94de-0fc76c3e4d7d', value: 'routine' },
      ]),
    );
    const update = mapToAmpathImmunizationEncounterPayload(immunization, config);
    expect(update).not.toHaveProperty('form');
    expect(update).not.toHaveProperty('encounterProviders');
    expect(update).not.toHaveProperty('encounterDatetime');
    expect(update).not.toHaveProperty('visit');
    expect(update).not.toHaveProperty('location');
  });

  it('preserves an historical administration date separately from the current visit registration time', () => {
    const immunization = {
      patientUuid: 'synthetic-patient',
      vaccineUuid: 'vaccine',
      vaccineName: 'Synthetic vaccine',
      vaccinationDate: '2026-05-01T00:00:00.000Z',
      doseNumber: 1,
      status: 'completed' as const,
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    };
    const context = {
      formUuid: 'form',
      visitUuid: 'current-visit',
      locationUuid: 'location',
      providerUuid: 'provider',
      recordedAt: '2026-05-28T16:30:00.000Z',
    };
    const payload = mapToAmpathImmunizationEncounterPayload(immunization, config, context);
    // Synthetic visit starts today at 10:00 Peru time; midnight would be outside it.
    expect(new Date(payload.encounterDatetime).getTime()).toBeGreaterThan(new Date('2026-05-28T15:00:00Z').getTime());
    expect(payload.obs).toContainEqual({ concept: 'f1410000-0000-4000-8000-000000001410', value: '2026-05-01' });
    const deferred = mapToAmpathImmunizationEncounterPayload({ ...immunization, status: 'not-done' }, config, context);
    expect(deferred.obs.some((obs) => 'concept' in obs && obs.concept === 'f1410000-0000-4000-8000-000000001410')).toBe(
      false,
    );
    expect(deferred.encounterDatetime).toBe(context.recordedAt);
  });

  it('maps OpenMRS AMPATH form encounters back to grouped immunizations', () => {
    const groups = mapFromAmpathImmunizationEncounters(
      [
        {
          uuid: 'encounter-uuid',
          encounterDatetime: '2026-05-28T10:30:00.000Z',
          visit: { uuid: 'visit-uuid' },
          location: { uuid: 'historical-location-uuid' },
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
            { concept: { uuid: 'af2ec074-87e5-4651-8e7f-5578bd111cf9' }, value: 'not-done' },
            { concept: { uuid: '9dab3f0d-b9da-45c3-beea-5ec3182e53be' }, value: 'Diferida por evaluación clínica' },
            { concept: { uuid: '5c45d979-90aa-4f27-94de-0fc76c3e4d7d' }, value: 'special' },
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
          locationUuid: 'historical-location-uuid',
          doseNumber: 1,
          occurrenceDateTime: '2026-05-28T00:00:00.000Z',
          status: 'not-done',
          statusReason: 'Diferida por evaluación clínica',
          programContext: 'special',
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
