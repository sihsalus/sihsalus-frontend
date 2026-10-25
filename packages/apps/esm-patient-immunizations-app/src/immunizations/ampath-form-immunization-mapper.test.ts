import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import type { ImmunizationFormData } from '../types';
import {
  mapFromAmpathImmunizationEncounters,
  mapToAmpathImmunizationEncounterPayload,
  mergeImmunizationGroups,
} from './ampath-form-immunization-mapper';
import { mapToFHIRImmunizationResource } from './immunization-mapper';

const config = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

describe('AMPATH immunization form mapper', () => {
  it.each([undefined, 'unverified', 'unknown'])(
    'rejects status %s in both transports before constructing a writable payload',
    (status) => {
      const immunization: ImmunizationFormData = {
        patientUuid: 'synthetic-patient',
        vaccineUuid: 'synthetic-vaccine',
        vaccineName: 'Synthetic vaccine',
        vaccinationDate: '2026-05-28',
        doseNumber: 1,
        status: 'completed',
        note: '',
        expirationDate: '',
        lotNumber: '',
        nextDoseDate: '',
        manufacturer: '',
      };
      // Simulate an untrusted runtime value beyond the writable TypeScript union.
      Reflect.set(immunization, 'status', status);
      expect(() => mapToAmpathImmunizationEncounterPayload(immunization, config)).toThrow(/explicit.*status/i);
      expect(() => mapToFHIRImmunizationResource(immunization, 'visit', 'location', 'provider')).toThrow(
        /explicit.*status/i,
      );
    },
  );

  it('retains a historical encounter with the old appetite observation as unverified', () => {
    const encounter = {
      uuid: 'synthetic-historical-encounter',
      encounterDatetime: '2026-05-28T10:30:00.000Z',
      obs: [
        {
          concept: { uuid: config.ampathFormPersistence.concepts.vaccineUuid },
          value: { uuid: 'synthetic-vaccine', display: 'Synthetic vaccine' },
        },
        { concept: { uuid: config.ampathFormPersistence.concepts.doseNumber }, value: 1 },
        { concept: { uuid: 'f0000182-0000-4000-8000-000000000182' }, value: 'not-done' },
      ],
    };
    const original = JSON.stringify(encounter);
    const groups = mapFromAmpathImmunizationEncounters([encounter], config);
    expect(groups[0].existingDoses).toEqual([
      expect.objectContaining({
        immunizationObsUuid: encounter.uuid,
        doseNumber: 1,
        status: 'unverified',
      }),
    ]);
    expect(JSON.stringify(encounter)).toBe(original);
  });

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
      encounterProviders: [
        { provider: 'provider-uuid', encounterRole: config.ampathFormPersistence.encounterRoleUuid },
        { provider: 'provider-uuid', encounterRole: config.unknownEncounterRoleUuid },
      ],
      visit: 'visit-uuid',
      location: 'location-uuid',
      encounterDatetime: '2026-05-28T15:30:00.000Z',
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.vaccineUuid, value: 'vaccine-uuid' },
        { concept: config.ampathFormPersistence.concepts.vaccinationDate, value: '2026-05-28T00:00:00.000+0000' },
        { concept: config.ampathFormPersistence.concepts.doseNumber, value: 1 },
        { concept: config.ampathFormPersistence.concepts.lotNumber, value: 'LOT-1' },
        { concept: config.ampathFormPersistence.concepts.expirationDate, value: '2026-12-31T00:00:00.000+0000' },
        { concept: config.ampathFormPersistence.concepts.nextDoseDate, value: '2026-06-28T00:00:00.000+0000' },
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
    expect(payload.obs).toContainEqual({
      concept: 'f1410000-0000-4000-8000-000000001410',
      value: '2026-05-01T00:00:00.000+0000',
    });
    const deferred = mapToAmpathImmunizationEncounterPayload({ ...immunization, status: 'not-done' }, config, context);
    expect(deferred.obs.some((obs) => 'concept' in obs && obs.concept === 'f1410000-0000-4000-8000-000000001410')).toBe(
      false,
    );
    expect(deferred.encounterDatetime).toBe(context.recordedAt);
  });

  it('deduplicates matching registration and FHIR provider roles without changing edits', () => {
    const matchingConfig = { ...config, unknownEncounterRoleUuid: config.ampathFormPersistence.encounterRoleUuid };
    const immunization: ImmunizationFormData = {
      patientUuid: 'synthetic-patient',
      vaccineUuid: 'synthetic-vaccine',
      vaccineName: 'Synthetic vaccine',
      vaccinationDate: '2026-05-28',
      doseNumber: 1,
      status: 'completed',
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    };
    const payload = mapToAmpathImmunizationEncounterPayload(immunization, matchingConfig, {
      formUuid: 'synthetic-form',
      visitUuid: 'synthetic-visit',
      locationUuid: 'synthetic-location',
      providerUuid: 'synthetic-provider',
      recordedAt: '2026-05-28T15:30:00Z',
    });
    expect(payload.encounterProviders).toEqual([
      { provider: 'synthetic-provider', encounterRole: matchingConfig.unknownEncounterRoleUuid },
    ]);
    expect(mapToAmpathImmunizationEncounterPayload(immunization, matchingConfig)).not.toHaveProperty(
      'encounterProviders',
    );
  });

  it.each([
    { form: { name: config.ampathFormPersistence.formName, version: '1.1.0' }, expected: '' },
    { form: undefined, expected: '' },
    { form: { name: 'Unverified form', version: '1.0.0' }, expected: '' },
    { form: { name: config.ampathFormPersistence.formName, version: '1.0.0' }, expected: '2026-05-28T15:30:00Z' },
  ])('uses encounter dates only for the verified historical administration contract: $form', ({ form, expected }) => {
    const concepts = config.ampathFormPersistence.concepts;
    const encounter = {
      uuid: 'synthetic-encounter',
      form,
      encounterDatetime: '2026-05-28T15:30:00Z',
      obs: [
        { concept: { uuid: concepts.vaccineUuid }, value: { uuid: 'synthetic-vaccine', display: 'Synthetic vaccine' } },
        { concept: { uuid: concepts.status }, value: 'completed' },
      ],
    };
    const [group] = mapFromAmpathImmunizationEncounters([encounter], config);
    expect(group.existingDoses[0]).toMatchObject({ status: 'completed', occurrenceDateTime: expected });
    const dated = {
      ...encounter,
      obs: [...encounter.obs, { concept: { uuid: concepts.vaccinationDate }, value: '2026-05-01' }],
    };
    expect(mapFromAmpathImmunizationEncounters([dated], config)[0].existingDoses[0].occurrenceDateTime).toBe(
      '2026-05-01',
    );
    const deferred = {
      ...encounter,
      obs: encounter.obs.map((obs) => (obs.concept.uuid === concepts.status ? { ...obs, value: 'not-done' } : obs)),
    };
    expect(mapFromAmpathImmunizationEncounters([deferred], config)[0].existingDoses[0].occurrenceDateTime).toBe('');
  });

  it.each(
    [
      'patientUuid',
      'encounterTypeUuid',
      'formUuid',
      'visitUuid',
      'locationUuid',
      'providerUuid',
      'recordedAt',
      'encounterRoleUuid',
    ].flatMap((field) => [undefined, '', '   '].map((value) => ({ field, value }))),
  )('rejects new REST registrations with $field=$value', ({ field, value }) => {
    const immunization: ImmunizationFormData = {
      patientUuid: 'patient-uuid',
      vaccineName: 'BCG',
      vaccineUuid: 'vaccine-uuid',
      vaccinationDate: '2026-05-28T00:00:00.000Z',
      doseNumber: 1,
      status: 'completed',
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    };
    const context = {
      formUuid: 'persisted-form',
      visitUuid: 'visit-uuid',
      locationUuid: 'location-uuid',
      providerUuid: 'recording-provider',
      recordedAt: '2026-05-28T15:30:00.000Z',
    };
    const changedConfig = {
      ...config,
      ampathFormPersistence: { ...config.ampathFormPersistence },
    };
    if (field === 'encounterRoleUuid' || field === 'encounterTypeUuid') {
      Reflect.set(changedConfig.ampathFormPersistence, field, value);
    } else if (field === 'patientUuid') {
      Reflect.set(immunization, field, value);
    } else {
      Reflect.set(context, field, value);
    }
    expect(() => mapToAmpathImmunizationEncounterPayload(immunization, changedConfig, context)).toThrow(
      /registration context is incomplete/i,
    );
  });

  it.each(
    ['UTC', 'America/Lima'].flatMap((timezone) =>
      ['2026-05-28', '2026-05-28T00:00:00.000Z', '2026-05-28T00:00:00-05:00'].map((date) => ({ timezone, date })),
    ),
  )(
    'sends REST date observations as timestamps without changing the calendar day ($timezone, $date)',
    ({ timezone, date }) => {
      const originalTimezone = process.env.TZ;
      try {
        process.env.TZ = timezone;
        const immunization: ImmunizationFormData = {
          patientUuid: 'synthetic-patient',
          vaccineUuid: 'synthetic-product',
          vaccineName: 'Synthetic vaccine',
          vaccinationDate: date,
          doseNumber: 1,
          status: 'completed',
          note: '',
          lotNumber: '',
          manufacturer: '',
          expirationDate: '2027-05-31',
          nextDoseDate: '2026-07-28T00:00:00.000Z',
        };
        const recordedAt = '2026-10-21T17:00:00.000Z';
        const payload = mapToAmpathImmunizationEncounterPayload(immunization, config, {
          formUuid: 'synthetic-form',
          visitUuid: 'synthetic-visit',
          locationUuid: 'synthetic-location',
          providerUuid: 'synthetic-provider',
          recordedAt,
        });
        const offset = timezone === 'UTC' ? '+0000' : '-0500';
        for (const [concept, day] of [
          [config.ampathFormPersistence.concepts.vaccinationDate, '2026-05-28'],
          [config.ampathFormPersistence.concepts.expirationDate, '2027-05-31'],
          [config.ampathFormPersistence.concepts.nextDoseDate, '2026-07-28'],
        ]) {
          expect(payload.obs).toContainEqual({ concept, value: `${day}T00:00:00.000${offset}` });
        }
        expect(payload.encounterDatetime).toBe(recordedAt);
      } finally {
        if (originalTimezone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimezone;
      }
    },
  );

  it('rejects a new registration with an invalid recording timestamp', () => {
    const immunization: ImmunizationFormData = {
      patientUuid: 'synthetic-patient',
      vaccineUuid: 'synthetic-vaccine',
      vaccineName: 'Synthetic vaccine',
      vaccinationDate: '2026-05-28',
      doseNumber: 1,
      status: 'completed',
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    };
    expect(() =>
      mapToAmpathImmunizationEncounterPayload(immunization, config, {
        formUuid: 'synthetic-form',
        visitUuid: 'synthetic-visit',
        locationUuid: 'synthetic-location',
        providerUuid: 'synthetic-provider',
        recordedAt: 'invalid-date',
      }),
    ).toThrow(/registration context is incomplete/i);
  });

  it('updates observations without requiring or inventing new registration context', () => {
    const immunization: ImmunizationFormData = {
      patientUuid: 'synthetic-patient',
      vaccineUuid: 'synthetic-vaccine',
      vaccineName: 'Synthetic vaccine',
      vaccinationDate: '2026-05-28',
      doseNumber: 1,
      status: 'completed',
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    };
    const payload = mapToAmpathImmunizationEncounterPayload(immunization, config);
    for (const field of ['form', 'visit', 'location', 'encounterDatetime', 'encounterProviders']) {
      expect(payload).not.toHaveProperty(field);
    }
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: config.ampathFormPersistence.concepts.vaccineUuid, value: immunization.vaccineUuid },
      ]),
    );
  });

  it('lists the highest dose first when several doses share the same date', () => {
    const encounterFor = (uuid: string, doseNumber: number) => ({
      uuid,
      encounterDatetime: '2026-10-16T10:00:00.000Z',
      obs: [
        {
          concept: { uuid: config.ampathFormPersistence.concepts.vaccineUuid },
          value: { uuid: 'vaccine-uuid', display: 'Pentavalente' },
        },
        { concept: { uuid: config.ampathFormPersistence.concepts.vaccinationDate }, value: '2026-10-16T00:00:00.000Z' },
        { concept: { uuid: config.ampathFormPersistence.concepts.doseNumber }, value: doseNumber },
      ],
    });

    const groups = mapFromAmpathImmunizationEncounters(
      [encounterFor('dose-1', 1), encounterFor('dose-3', 3), encounterFor('dose-2', 2)],
      config,
    );

    expect(groups[0].existingDoses.map((dose) => dose.doseNumber)).toEqual([3, 2, 1]);
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
          occurrenceDateTime: '',
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
