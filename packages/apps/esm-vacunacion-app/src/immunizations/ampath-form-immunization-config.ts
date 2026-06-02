import type { ImmunizationConfigObject } from '../config-schema';

export const defaultAmpathImmunizationFormPersistence: ImmunizationConfigObject['ampathFormPersistence'] = {
  enabled: true,
  encounterTypeUuid: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
  formUuid: 'c1120000-0000-4000-8000-000000000011',
  concepts: {
    vaccineUuid: 'f9840000-0000-4000-8000-000000000984',
    vaccinationDate: 'f1410000-0000-4000-8000-000000001410',
    doseNumber: 'f1418000-0000-4000-8000-000000001418',
    manufacturer: 'f1419000-0000-4000-8000-000000001419',
    lotNumber: 'f1420000-0000-4000-8000-000000001420',
    expirationDate: 'f1659070-0000-4000-8000-000000165907',
    note: 'f1610110-0000-4000-8000-000000161011',
    nextDoseDate: 'f1700000-0000-4000-8000-000000170000',
    status: 'f0000182-0000-4000-8000-000000000182',
    statusReason: 'f0000183-0000-4000-8000-000000000183',
    programContext: 'f0000184-0000-4000-8000-000000000184',
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
