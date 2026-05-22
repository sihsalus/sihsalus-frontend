import { toOmrsIsoString } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';

import { prepMedicationOrderPostData } from './api';

describe('prepMedicationOrderPostData', () => {
  const baseOrder = {
    action: 'NEW',
    drug: {
      uuid: 'drug-uuid',
      concept: { uuid: 'concept-uuid' },
      display: 'Drug',
    },
    dosage: 1,
    unit: { valueCoded: 'dose-unit-uuid', value: 'Tablet' },
    route: { valueCoded: 'route-uuid', value: 'Oral' },
    frequency: { valueCoded: 'frequency-uuid', value: 'Once daily' },
    asNeeded: false,
    asNeededCondition: null,
    numRefills: 0,
    pillsDispensed: 7,
    quantityUnits: { valueCoded: 'quantity-unit-uuid', value: 'Tablet' },
    duration: 7,
    durationUnit: { valueCoded: 'duration-unit-uuid', value: 'Days' },
    isFreeTextDosage: false,
    patientInstructions: 'Take after food',
    freeTextDosage: null,
    indication: 'Pain',
    startDate: new Date('2026-05-21T15:30:00.000-05:00'),
    display: 'Drug',
    commonMedicationName: 'Drug',
  } as DrugOrderBasketItem;

  it('maps the form start date to the order activation date', () => {
    expect(prepMedicationOrderPostData(baseOrder, 'patient-uuid', 'encounter-uuid', 'provider-uuid')).toEqual(
      expect.objectContaining({
        action: 'NEW',
        dateActivated: toOmrsIsoString(baseOrder.startDate),
        encounter: 'encounter-uuid',
        orderer: 'provider-uuid',
        patient: 'patient-uuid',
      }),
    );
  });
});
