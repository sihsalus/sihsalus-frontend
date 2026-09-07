import { toOmrsIsoString } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem, type Order } from '@openmrs/esm-patient-common-lib';
import { renderHook } from '@testing-library/react';
import useSWRImmutable from 'swr/immutable';

import { buildMedicationOrder, prepMedicationOrderPostData, useRequireOutpatientQuantity } from './api';

vi.mock('swr/immutable', () => ({
  default: vi.fn(),
}));

const mockUseSWRImmutable = vi.mocked(useSWRImmutable);

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

  it('maps a backdated start date to the order activation date', () => {
    // baseOrder.startDate is a fixed date in the past relative to "now"
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

  it.each([
    { numRefills: 1 },
    { asNeeded: true },
    { asNeededCondition: 'Repeat if needed' },
    { duration: 7 },
    { durationUnit: { valueCoded: 'days', value: 'Days' } },
    { isFreeTextDosage: true },
    { startDate: new Date('2000-01-01T12:00:00.000Z') },
  ])('rejects a conflicting once draft at basket signing: %o', (conflict) => {
    expect(() =>
      prepMedicationOrderPostData(
        {
          ...baseOrder,
          frequency: { valueCoded: 'synthetic-once-frequency', value: 'One administration' },
          urgency: 'STAT',
          duration: null,
          durationUnit: null,
          startDate: new Date(),
          ...conflict,
        },
        'synthetic-patient',
        'synthetic-encounter',
        'synthetic-provider',
        'synthetic-care-setting',
        'synthetic-once-frequency',
        true,
      ),
    ).toThrow('The single-dose prescription must be reviewed before signing.');
  });

  it.each([
    'NEW',
    'RENEW',
    'REVISE',
  ] as const)('sends STAT and native once frequency independently for %s', (action) => {
    const result = prepMedicationOrderPostData(
      {
        ...baseOrder,
        action,
        urgency: 'STAT',
        frequency: {
          valueCoded: 'synthetic-once-frequency',
          value: 'Once',
          frequencyPerDay: null,
        },
        duration: null,
        durationUnit: null,
        pillsDispensed: 1,
        startDate: new Date(),
      },
      'synthetic-patient',
      'synthetic-encounter',
      'synthetic-provider',
      'synthetic-care-setting',
      'synthetic-once-frequency',
      true,
    );

    expect(result).toMatchObject({
      urgency: 'STAT',
      frequency: 'synthetic-once-frequency',
      dose: 1,
      quantity: 1,
      numRefills: 0,
      asNeeded: false,
      duration: null,
    });
    expect(result.durationUnits).toBeUndefined();
    expect(result.dateActivated).toBeUndefined();
    expect(result).not.toHaveProperty('dateStopped');
    expect(result).not.toHaveProperty('autoExpireDate');
  });

  it.each([
    'ROUTINE',
    'STAT',
    'ON_SCHEDULED_DATE',
  ])('preserves %s when an existing daily order is revised', (urgency) => {
    const savedOrder = {
      uuid: 'synthetic-order',
      drug: baseOrder.drug,
      urgency,
      scheduledDate: urgency === 'ON_SCHEDULED_DATE' ? '2026-09-08T12:00:00.000Z' : null,
      frequency: { uuid: 'daily-frequency', display: 'Once daily' },
      duration: 7,
      durationUnits: { uuid: 'days', display: 'Days' },
      quantity: 7,
      encounter: {
        uuid: 'synthetic-encounter',
        visit: { uuid: 'synthetic-visit' },
      },
    } as unknown as Order;
    const draft = buildMedicationOrder(savedOrder, 'REVISE');
    const payload = prepMedicationOrderPostData(draft, 'synthetic-patient', 'synthetic-encounter');

    expect(draft).toMatchObject({
      urgency,
      urgencyCode: urgency,
      frequency: { valueCoded: 'daily-frequency' },
    });
    expect(payload).toMatchObject({
      urgency,
      frequency: 'daily-frequency',
      duration: 7,
      durationUnits: 'days',
      quantity: 7,
    });
    expect(payload.scheduledDate).toBe(draft.scheduledDate ? toOmrsIsoString(draft.scheduledDate) : undefined);
  });

  it.each([
    'NEW',
    'REVISE',
    'RENEW',
  ] as const)('blocks %s of a once order when the configured frequency is unavailable', (action) => {
    const order = {
      ...baseOrder,
      action,
      urgency: 'STAT',
      frequency: { valueCoded: 'synthetic-once-frequency', value: 'Once' },
      duration: null,
      durationUnit: null,
      startDate: new Date(),
    };
    expect(() =>
      prepMedicationOrderPostData(
        order,
        'synthetic-patient',
        'synthetic-encounter',
        'synthetic-provider',
        'synthetic-care-setting',
        'synthetic-once-frequency',
        false,
      ),
    ).toThrow('The single-dose prescription must be reviewed before signing.');
  });

  // Regression tests: orders starting today must not carry an explicit dateActivated.
  // The basket sets startDate when the item is created, so by signing time that
  // timestamp precedes the encounterDatetime and the backend rejects the order with
  // "Date activated cannot be before that of the associated encounter".
  it.each(['NEW', 'RENEW', 'REVISE'] as const)('omits dateActivated for %s orders starting today', (action) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const order = {
      ...baseOrder,
      action,
      previousOrder: action === 'NEW' ? null : 'previous-order-uuid',
      startDate: startOfToday,
    } as DrugOrderBasketItem;

    const result = prepMedicationOrderPostData(order, 'patient-uuid', 'encounter-uuid', 'provider-uuid');

    expect(result.dateActivated).toBeUndefined();
  });

  it('sends an explicit dateActivated for orders backdated to a previous day', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    const order = { ...baseOrder, startDate } as DrugOrderBasketItem;

    const result = prepMedicationOrderPostData(order, 'patient-uuid', 'encounter-uuid', 'provider-uuid');

    expect(result.dateActivated).toBe(toOmrsIsoString(startDate));
  });
});

describe('useRequireOutpatientQuantity', () => {
  it.each([
    {
      state: { data: undefined, error: undefined, isLoading: true },
      expected: true,
      label: 'while the setting is loading',
    },
    {
      state: { data: undefined, error: new Error('forbidden'), isLoading: false },
      expected: true,
      label: 'when the clinical role cannot read the setting',
    },
    {
      state: { data: { data: { value: 'true' } }, error: undefined, isLoading: false },
      expected: true,
      label: 'when the setting is explicitly true',
    },
    {
      state: { data: { data: { value: 'false' } }, error: undefined, isLoading: false },
      expected: false,
      label: 'only when the setting is explicitly false',
    },
  ])('uses the safe quantity policy $label', ({ state, expected }) => {
    mockUseSWRImmutable.mockReturnValue(state as ReturnType<typeof useSWRImmutable>);

    const { result } = renderHook(() => useRequireOutpatientQuantity());

    expect(result.current.requireOutpatientQuantity).toBe(expected);
    expect(result.current.isLoading).toBe(state.isLoading);
    expect(result.current.error).toBe(state.error);
  });
});
