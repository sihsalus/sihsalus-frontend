import { resolvePublishedForm } from '@openmrs/esm-patient-common-lib';
import type { ImmunizationConfigObject } from '../config-schema';

/** OpenMRS "Unknown" encounter role, required by FHIR2 on immunization encounters. */
export const defaultUnknownEncounterRoleUuid = 'a0b03050-c99b-11e0-9572-0800200c9a66';

export const defaultAmpathImmunizationFormPersistence: ImmunizationConfigObject['ampathFormPersistence'] = {
  enabled: true,
  encounterTypeUuid: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
  encounterRoleUuid: '738ba7c1-354f-47f8-b6d4-9d705ce05731',
  formName: 'INMU-001-REGISTRO DE VACUNACIÓN',
  formVersion: '1.1.0',
  encounterDateAdministrationFormVersions: ['1.0.0'],
  concepts: {
    vaccineUuid: 'f9840000-0000-4000-8000-000000000984',
    vaccinationDate: 'f1410000-0000-4000-8000-000000001410',
    doseNumber: 'f1418000-0000-4000-8000-000000001418',
    manufacturer: 'f1419000-0000-4000-8000-000000001419',
    lotNumber: 'f1420000-0000-4000-8000-000000001420',
    expirationDate: 'f1659070-0000-4000-8000-000000165907',
    note: 'f1610110-0000-4000-8000-000000161011',
    nextDoseDate: 'f1700000-0000-4000-8000-000000170000',
    status: 'af2ec074-87e5-4651-8e7f-5578bd111cf9',
    statusReason: '9dab3f0d-b9da-45c3-beea-5ec3182e53be',
    programContext: '5c45d979-90aa-4f27-94de-0fc76c3e4d7d',
  },
};

export function getAmpathImmunizationFormPersistence(config: ImmunizationConfigObject) {
  return {
    ...defaultAmpathImmunizationFormPersistence,
    ...(config?.ampathFormPersistence ?? {}),
    concepts: {
      ...defaultAmpathImmunizationFormPersistence.concepts,
      ...(config?.ampathFormPersistence?.concepts ?? {}),
    },
  };
}

export async function resolveAmpathImmunizationForm(config: ImmunizationConfigObject) {
  const persistence = getAmpathImmunizationFormPersistence(config);
  if (!persistence.formName?.trim() || !persistence.formVersion?.trim()) {
    throw new Error('The immunization Form name and version are required');
  }
  return resolvePublishedForm(persistence.formUuid || persistence.formName, {
    name: persistence.formName,
    version: persistence.formVersion,
    formCategory: 'Immunization',
  });
}
