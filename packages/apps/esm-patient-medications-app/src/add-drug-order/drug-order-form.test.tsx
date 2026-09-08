import { getDefaultsFromConfigSchema, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockDrugSearchResultApiData, mockFhirPatient, mockSessionDataResponse } from 'test-utils';
import { useRequireOutpatientQuantity } from '../api/api';
import { prepMedicationOrderPostData } from '../api/api';
import { type ConfigObject, configSchema } from '../config-schema';
import DrugOrderForm from './drug-order-form.component';
import { getTemplateOrderBasketItem } from './drug-search/drug-search.resource';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual('@openmrs/esm-framework');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    useLayoutType: vi.fn(() => 'small-desktop'),
    OpenmrsDatePicker: React.forwardRef(
      (props: Record<string, unknown>, ref: import('react').ForwardedRef<HTMLSpanElement>) =>
        React.createElement('span', { ref }, props.labelText as import('react').ReactNode),
    ),
  };
});

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);
const defaultConfig = getDefaultsFromConfigSchema(configSchema) as ConfigObject;

mockUseConfig.mockReturnValue(defaultConfig);
mockUseSession.mockReturnValue(mockSessionDataResponse.data);

vi.mock('../api/order-config', async () => ({
  useOrderConfig: vi.fn().mockReturnValue({
    orderConfigObject: {
      drugRoutes: [{ valueCoded: '160240AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Oral' }],
      drugDosingUnits: [{ valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' }],
      drugDispensingUnits: [
        { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' },
        { valueCoded: '162376AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Application' },
      ],
      durationUnits: [
        { valueCoded: 'minutes-uuid', value: 'Minutes' },
        { valueCoded: 'hours-uuid', value: 'Hours' },
        { valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Days' },
        { valueCoded: '1073AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Weeks' },
        { valueCoded: '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Months' },
        { valueCoded: '1734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Years' },
      ],
      orderFrequencies: [
        {
          valueCoded: '11111111-1111-4111-8111-111111111111',
          value: 'One administration',
          frequencyPerDay: null,
        },
        {
          valueCoded: 'once-daily-uuid',
          value: 'Once daily',
          frequencyPerDay: 1.0,
          names: ['OD', 'Once daily'],
        },
        {
          valueCoded: 'twice-daily-uuid',
          value: 'Twice daily',
          frequencyPerDay: 2.0,
          names: ['BD', 'Twice daily'],
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../api/api', async () => ({
  ...(await vi.importActual('../api/api')),
  useActivePatientOrders: vi.fn().mockReturnValue({ isLoading: false, data: [] }),
  useRequireOutpatientQuantity: vi
    .fn()
    .mockReturnValue({ requireOutpatientQuantity: true, error: null, isLoading: false }),
}));

afterEach(() => {
  mockUseConfig.mockReturnValue(defaultConfig);
  mockUseLayoutType.mockReturnValue('small-desktop');
  (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
    requireOutpatientQuantity: true,
    error: null,
    isLoading: false,
  });
});

function renderDrugOrderForm(initialOrderBasketItem: DrugOrderBasketItem, onSave = vi.fn()) {
  return render(
    <DrugOrderForm
      initialOrderBasketItem={initialOrderBasketItem}
      patient={mockFhirPatient}
      visitContext={null}
      onSave={onSave}
      saveButtonText="Save order"
      onCancel={vi.fn()}
      workspaceTitle="Add drug order"
    />,
  );
}

function createNewOrderBasketItem(overrides?: Partial<DrugOrderBasketItem>): DrugOrderBasketItem {
  const base = getTemplateOrderBasketItem(mockDrugSearchResultApiData[0], null);
  return {
    ...base,
    pillsDispensed: null,
    quantityUnits: null,
    ...overrides,
  } as DrugOrderBasketItem;
}

function getRequiredFieldLabels() {
  return screen.getAllByTitle('Required').map((indicator) =>
    indicator.parentElement?.textContent
      ?.replace(/\s*\*$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

describe('STAT single-dose prescriptions', () => {
  const onceUuid = '11111111-1111-4111-8111-111111111111';
  const tablet = {
    valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    value: 'Tablet',
  };
  const completeOrder = (overrides: Partial<DrugOrderBasketItem> = {}) =>
    createNewOrderBasketItem({
      dosage: 2,
      unit: tablet,
      quantityUnits: tablet,
      route: {
        valueCoded: '160240AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        value: 'Oral',
      },
      frequency: {
        valueCoded: 'once-daily-uuid',
        value: 'Once daily',
        frequencyPerDay: 1,
      },
      duration: 7,
      durationUnit: {
        valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        value: 'Days',
      },
      pillsDispensed: 14,
      numRefills: 2,
      indication: 'Synthetic test indication',
      ...overrides,
    });

  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      singleDoseFrequencyUuid: onceUuid,
    });
  });

  it.each([
    ['the previous calculated quantity is equal', 1, 1],
    ['the preset is applied twice', 7, 2],
  ] as const)('keeps the single-dose quantity when %s', async (_scenario, duration, presetClicks) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(completeOrder({ duration, pillsDispensed: duration * 2, isQuantityManual: false }), onSave);
    const quantity = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    expect(quantity).toHaveValue(duration * 2);

    const preset = screen.getByRole('button', { name: 'STAT — administer once now' });
    for (let click = 0; click < presetClicks; click++) {
      await user.click(preset);
      expect(quantity).toHaveValue(2);
    }

    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      urgency: 'STAT',
      frequency: { valueCoded: onceUuid },
      dosage: 2,
      unit: tablet,
      quantityUnits: tablet,
      pillsDispensed: 2,
      isQuantityManual: false,
      asNeeded: false,
      numRefills: 0,
      duration: null,
      durationUnit: null,
    });
  });

  it('preserves a manual single-dose quantity after the preset when the dose changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(completeOrder(), onSave);
    await user.click(screen.getByRole('button', { name: 'STAT — administer once now' }));
    const quantity = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    expect(quantity).toHaveValue(2);
    await user.clear(quantity);
    await user.type(quantity, '4');
    const dose = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(dose);
    await user.type(dose, '3');

    expect(quantity).toHaveValue(4);
    expect(screen.getByText(/apply calculated quantity \(3\)/i)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      dosage: 3,
      pillsDispensed: 4,
      isQuantityManual: true,
      frequency: { valueCoded: onceUuid },
      duration: null,
      numRefills: 0,
    });
  });

  it('submits one immediate dose, clearing repeating and PRN fields and the old quantity', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(
      completeOrder({
        asNeeded: true,
        asNeededCondition: 'Synthetic PRN reason',
        isQuantityManual: true,
      }),
      onSave,
    );

    await user.click(screen.getByRole('button', { name: 'STAT — administer once now' }));

    expect(screen.getByRole('combobox', { name: 'Urgency' })).toHaveValue('STAT');
    expect(screen.getByRole('combobox', { name: /frequency/i })).toHaveValue('One administration');
    expect(screen.getByRole('checkbox', { name: /take as needed/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /take as needed/i })).toBeDisabled();
    expect(screen.queryByRole('spinbutton', { name: /duration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /refills/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(2));
    // Happy DOM rejects valid decimal steps (2 with min/step 0.01); submit through the form's schema.
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const draft = onSave.mock.calls[0][0] as DrugOrderBasketItem;
    expect(draft).toMatchObject({
      urgency: 'STAT',
      urgencyCode: 'STAT',
      frequency: { valueCoded: onceUuid },
      asNeeded: false,
      asNeededCondition: '',
      numRefills: 0,
      duration: null,
      durationUnit: null,
      pillsDispensed: 2,
      isQuantityManual: false,
    });
    expect(prepMedicationOrderPostData(draft, 'synthetic-patient', 'synthetic-encounter')).toMatchObject({
      urgency: 'STAT',
      frequency: onceUuid,
      dose: 2,
      quantity: 2,
      numRefills: 0,
      asNeeded: false,
      duration: null,
    });
  });

  it.each([
    '',
    '22222222-2222-4222-8222-222222222222',
  ])('disables the preset when the configured UUID %s is unavailable', (uuid) => {
    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      singleDoseFrequencyUuid: uuid,
    });
    renderDrugOrderForm(completeOrder());
    expect(screen.getByRole('button', { name: 'STAT — administer once now' })).toBeDisabled();
    expect(screen.getByText(/Single-dose prescribing is unavailable/)).toBeInTheDocument();
  });

  it('does not reinterpret a daily STAT order as one administration when editing', async () => {
    const onSave = vi.fn();
    renderDrugOrderForm(completeOrder({ action: 'REVISE', urgency: 'STAT', urgencyCode: 'STAT' }), onSave);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(7);
    expect(screen.getByRole('combobox', { name: /frequency/i })).toHaveValue('Once daily');
    expect(screen.getByRole('checkbox', { name: /take as needed/i })).toBeEnabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      urgency: 'STAT',
      frequency: { valueCoded: 'once-daily-uuid' },
      duration: 7,
      numRefills: 2,
    });
  });

  it('preserves once semantics and manual quantity when reopening an existing single-dose order', async () => {
    const onSave = vi.fn();
    renderDrugOrderForm(
      completeOrder({
        action: 'REVISE',
        urgency: 'STAT',
        frequency: { valueCoded: onceUuid, value: 'One administration' },
        duration: null,
        durationUnit: null,
        numRefills: 0,
        pillsDispensed: 3,
      }),
      onSave,
    );
    expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(3);
    expect(screen.queryByRole('spinbutton', { name: /duration/i })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      urgency: 'STAT',
      frequency: { valueCoded: onceUuid },
      duration: null,
      numRefills: 0,
      pillsDispensed: 3,
    });
  });

  it('requires a manually reviewed dispense quantity when units do not match', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(
      completeOrder({
        unit: { valueCoded: 'synthetic-mg', value: 'mg' },
        isQuantityManual: true,
      }),
      onSave,
    );
    await user.click(screen.getByRole('button', { name: 'STAT — administer once now' }));
    expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).not.toHaveValue();
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    expect(await screen.findByText('Quantity to dispense is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires duration again when the clinician changes a single dose to daily dosing', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(completeOrder(), onSave);
    await user.click(screen.getByRole('button', { name: 'STAT — administer once now' }));
    const frequency = screen.getByRole('combobox', { name: /frequency/i });
    await user.clear(frequency);
    await user.type(frequency, 'Once daily');
    await user.click(screen.getByRole('option', { name: 'Once daily' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    expect(await screen.findByText('Treatment duration is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    'frequency-first',
    'urgency-first',
  ])('sets today when configuring a backdated single dose manually: %s', async (sequence) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderDrugOrderForm(completeOrder({ startDate: yesterday }), onSave);
    const selectFrequency = async () => {
      const frequency = screen.getByRole('combobox', { name: /frequency/i });
      await user.clear(frequency);
      await user.type(frequency, 'One administration');
      await user.click(screen.getByRole('option', { name: 'One administration' }));
    };
    const selectUrgency = () => user.selectOptions(screen.getByRole('combobox', { name: 'Urgency' }), 'STAT');
    if (sequence === 'frequency-first') {
      await selectFrequency();
      await selectUrgency();
    } else {
      await selectUrgency();
      await selectFrequency();
    }
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const draft = onSave.mock.calls[0][0] as DrugOrderBasketItem;
    expect((draft.startDate as Date).toDateString()).toBe(new Date().toDateString());
    expect(
      prepMedicationOrderPostData(draft, 'synthetic-patient', 'synthetic-encounter').dateActivated,
    ).toBeUndefined();
  });

  it('blocks submission of an existing once draft when its configured frequency is no longer available', () => {
    const onSave = vi.fn();
    const missingOnce = '22222222-2222-4222-8222-222222222222';
    mockUseConfig.mockReturnValue({ ...defaultConfig, singleDoseFrequencyUuid: missingOnce });
    renderDrugOrderForm(
      completeOrder({
        action: 'REVISE',
        urgency: 'STAT',
        frequency: { valueCoded: missingOnce, value: 'One administration' },
        duration: null,
        durationUnit: null,
        numRefills: 0,
      }),
      onSave,
    );
    expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('applies single-dose restrictions when selecting the native frequency directly without changing urgency', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(completeOrder(), onSave);
    const frequency = screen.getByRole('combobox', { name: /frequency/i });
    await user.clear(frequency);
    await user.type(frequency, 'One administration');
    await user.click(screen.getByRole('option', { name: 'One administration' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      urgency: 'ROUTINE',
      frequency: { valueCoded: onceUuid },
      duration: null,
      numRefills: 0,
    });
  });
});

describe('DrugOrderForm - required field indicators', () => {
  it('marks every required field configured for a structured outpatient order', () => {
    renderDrugOrderForm(createNewOrderBasketItem());

    expect(getRequiredFieldLabels()).toEqual([
      'Dose',
      'Dose unit',
      'Route of administration',
      'Frequency',
      'Start date',
      'Duration',
      'Duration unit',
      'Quantity to dispense',
      'Quantity unit',
      'Number of refills',
      'Diagnosis or reason for prescription',
    ]);
    screen.getAllByTitle('Required').forEach((indicator) => {
      expect(indicator).toHaveTextContent('*');
    });
  });

  it('marks free-text dosage when editing a legacy free-text outpatient order', () => {
    renderDrugOrderForm(
      createNewOrderBasketItem({
        isFreeTextDosage: true,
        freeTextDosage: 'Take one tablet daily',
      }),
    );

    expect(getRequiredFieldLabels()).toEqual([
      'Free-text dosage (exception)',
      'Start date',
      'Duration',
      'Duration unit',
      'Quantity to dispense',
      'Quantity unit',
      'Number of refills',
      'Diagnosis or reason for prescription',
    ]);
  });

  it('does not mark indication or dispensing fields when they are optional', () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, requireIndication: false });
    (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
      requireOutpatientQuantity: false,
      error: null,
      isLoading: false,
    });

    renderDrugOrderForm(createNewOrderBasketItem());

    expect(getRequiredFieldLabels()).toEqual([
      'Dose',
      'Dose unit',
      'Route of administration',
      'Frequency',
      'Start date',
    ]);
  });
});

describe('DrugOrderForm - auto-calculation of dispense quantity', () => {
  it('prevents scientific notation and signs in medication dose and duration inputs', () => {
    renderDrugOrderForm(createNewOrderBasketItem());

    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    for (const key of ['e', 'E', '+', '-', ',']) {
      expect(fireEvent.keyDown(doseInput, { key })).toBe(false);
    }
    expect(fireEvent.keyDown(doseInput, { key: '.' })).toBe(true);
    expect(
      fireEvent.paste(doseInput, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    for (const key of ['e', 'E', '+', '-', '.', ',']) {
      expect(fireEvent.keyDown(durationInput, { key })).toBe(false);
    }
    expect(
      fireEvent.paste(durationInput, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);
  });

  it('renders and validates an incomplete order for a drug without dosage form', async () => {
    const user = userEvent.setup();
    const drugWithoutDosageForm = createNewOrderBasketItem({
      drug: {
        ...mockDrugSearchResultApiData[0],
        uuid: '5219bdad-dfb2-4079-b6a2-1dcce2304058',
        display: '04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL',
        strength: '300 µg 2 mL',
        dosageForm: null,
      },
      display: '04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL',
      commonMedicationName: '04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL',
      isOrderIncomplete: true,
      unit: null,
      quantityUnits: null,
    });

    renderDrugOrderForm(drugWithoutDosageForm);

    expect(screen.getByText(/04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText(/dosage is required/i)).toBeInTheDocument();
  });

  it('auto-calculates quantity when dose, frequency, and duration are filled', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    await waitFor(() => {
      const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
      expect(quantityInput).toHaveValue(14);
    });
    expect(screen.getByText(/auto-calculated/i)).toBeInTheDocument();
  });

  it('auto-calculates with weekly duration units', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '3');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '1');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.clear(durationUnitCombobox);
    await user.type(durationUnitCombobox, 'Week');
    await user.click(screen.getByText('Weeks'));

    // 3 × 2.0 × 7 = 42
    await waitFor(() => {
      const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
      expect(quantityInput).toHaveValue(42);
    });
  });

  it('clears quantity when a required input is removed', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(14);
    });

    // Clear the duration
    await user.clear(durationInput);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).not.toHaveValue();
    });
  });

  it('does not auto-calculate when PRN is checked', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(14);
    });

    // Check PRN
    const prnCheckbox = screen.getByRole('checkbox', { name: /take as needed/i });
    await user.click(prnCheckbox);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).not.toHaveValue();
    });
    expect(screen.queryByText(/auto-calculated/i)).not.toBeInTheDocument();
  });

  it('does not auto-calculate for free-text dosage', async () => {
    renderDrugOrderForm(
      createNewOrderBasketItem({
        action: 'REVISE',
        isFreeTextDosage: true,
        freeTextDosage: 'Take one tablet as directed',
      }),
    );

    // The quantity input should remain empty
    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    expect(quantityInput).not.toHaveValue();
    expect(screen.queryByText(/auto-calculated/i)).not.toBeInTheDocument();
  });

  it('does not offer free-text dosage for a new outpatient prescription', () => {
    renderDrugOrderForm(createNewOrderBasketItem());

    expect(screen.queryByRole('switch', { name: /free.?text dosage/i })).not.toBeInTheDocument();
  });

  it('does not auto-calculate when quantity unit differs from dose unit', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(14);
    });

    // Change quantity unit to something different from dose unit (Tablet)
    const quantityUnitCombobox = screen.getByRole('combobox', { name: /quantity unit/i });
    await user.clear(quantityUnitCombobox);
    await user.type(quantityUnitCombobox, 'Application');
    await user.click(screen.getByText('Application'));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).not.toHaveValue();
    });
  });

  it('stops auto-calculating after manual edit and shows recalculate link', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs to trigger auto-calc
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    await waitFor(() => {
      expect(quantityInput).toHaveValue(14);
    });

    // Manually edit quantity
    await user.clear(quantityInput);
    await user.type(quantityInput, '20');

    await waitFor(() => {
      expect(quantityInput).toHaveValue(20);
    });
    expect(screen.queryByText(/auto-calculated/i)).not.toBeInTheDocument();
    expect(screen.getByText(/apply calculated quantity \(14\)/i)).toBeInTheDocument();
  });

  it('keeps manual override when upstream inputs change', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    await waitFor(() => {
      expect(quantityInput).toHaveValue(14);
    });

    // Manual edit
    await user.clear(quantityInput);
    await user.type(quantityInput, '20');

    await waitFor(() => {
      expect(quantityInput).toHaveValue(20);
    });

    // Change duration — manual value should be preserved, recalculate link should update
    await user.clear(durationInput);
    await user.type(durationInput, '14');

    // Quantity stays at 20 (manual override is sticky)
    await waitFor(() => {
      expect(quantityInput).toHaveValue(20);
    });
    // Recalculate link shows the would-be value: 1 × 2.0 × 14 = 28
    expect(screen.getByText(/apply calculated quantity \(28\)/i)).toBeInTheDocument();
  });

  it('resumes auto-calculation when recalculate link is clicked', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    await waitFor(() => {
      expect(quantityInput).toHaveValue(14);
    });

    // Manual edit
    await user.clear(quantityInput);
    await user.type(quantityInput, '20');

    await waitFor(() => {
      expect(quantityInput).toHaveValue(20);
    });

    // Click recalculate
    await user.click(screen.getByText(/apply calculated quantity \(14\)/i));

    await waitFor(() => {
      expect(quantityInput).toHaveValue(14);
    });
    expect(screen.getByText(/auto-calculated/i)).toBeInTheDocument();
    expect(screen.queryByText(/apply calculated quantity/i)).not.toBeInTheDocument();
  });

  it('keeps manual override when quantity field is cleared', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    // Fill all inputs
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    await waitFor(() => {
      expect(quantityInput).toHaveValue(14);
    });

    // Manual edit
    await user.clear(quantityInput);
    await user.type(quantityInput, '20');

    await waitFor(() => {
      expect(quantityInput).toHaveValue(20);
    });

    // Clear the quantity field — should stay empty (manual override is sticky)
    await user.clear(quantityInput);

    await waitFor(() => {
      expect(quantityInput).toHaveValue(null);
    });
    expect(screen.getByText(/apply calculated quantity \(14\)/i)).toBeInTheDocument();
  });

  it('stays in auto mode when reopening a NEW basket item with auto-calculated quantity', async () => {
    const user = userEvent.setup();
    // Simulate reopening a saved NEW order that had auto-calculated quantity
    const item = createNewOrderBasketItem({
      pillsDispensed: 14,
      isQuantityManual: false,
      dosage: 1,
      frequency: {
        valueCoded: 'twice-daily-uuid',
        value: 'Twice daily',
        frequencyPerDay: 2.0,
      },
      duration: 7,
      durationUnit: { valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Days' },
    });
    renderDrugOrderForm(item);

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    expect(quantityInput).toHaveValue(14);
    expect(screen.getByText(/auto-calculated/i)).toBeInTheDocument();

    // Changing duration should auto-update quantity (not show recalculate link)
    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '14');

    // 1 × 2.0 × 14 = 28
    await waitFor(() => {
      expect(quantityInput).toHaveValue(28);
    });
    expect(screen.getByText(/auto-calculated/i)).toBeInTheDocument();
    expect(screen.queryByText(/apply calculated quantity/i)).not.toBeInTheDocument();
  });

  it('preserves quantity for REVISE orders when frequencyPerDay is null', async () => {
    const item = createNewOrderBasketItem({
      action: 'REVISE',
      pillsDispensed: 30,
      frequency: {
        valueCoded: 'some-frequency-uuid',
        value: 'Once daily',
        frequencyPerDay: null,
      },
      dosage: 1,
      unit: { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' },
      duration: 30,
      durationUnit: { valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Days' },
      quantityUnits: { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' },
    });

    renderDrugOrderForm(item);

    // Quantity is preserved from the existing order — the effect returns early for
    // REVISE orders with null frequencyPerDay
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(30);
    });
    expect(screen.queryByText(/auto-calculated/i)).not.toBeInTheDocument();
  });

  it('shows recalculate link for REVISE orders after re-selecting frequency with frequencyPerDay', async () => {
    const user = userEvent.setup();
    const item = createNewOrderBasketItem({
      action: 'REVISE',
      pillsDispensed: 30,
      frequency: {
        valueCoded: 'some-frequency-uuid',
        value: 'Once daily',
        frequencyPerDay: null,
      },
      dosage: 1,
      unit: { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' },
      duration: 7,
      durationUnit: { valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Days' },
      quantityUnits: { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' },
    });

    renderDrugOrderForm(item);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(30);
    });

    // Re-select a frequency that has frequencyPerDay — clear first so all options appear
    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.clear(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    // Quantity is preserved — manual override is sticky for REVISE orders.
    // Recalculate link shows the would-be value: 1 × 2.0 × 7 = 14
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(30);
    });
    expect(screen.getByText(/apply calculated quantity \(14\)/i)).toBeInTheDocument();

    // Clicking recalculate applies the calculated value
    await user.click(screen.getByText(/apply calculated quantity \(14\)/i));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /quantity to dispense/i })).toHaveValue(14);
    });
    expect(screen.getByText(/auto-calculated/i)).toBeInTheDocument();
  });

  it('does not auto-calculate when requireOutpatientQuantity is false', async () => {
    const user = userEvent.setup();
    (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
      requireOutpatientQuantity: false,
      error: null,
      isLoading: false,
    });
    renderDrugOrderForm(createNewOrderBasketItem());

    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '1');

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    await user.click(frequencyCombobox);
    await user.click(screen.getByText('Twice daily'));

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '7');

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);
    await user.click(screen.getByText('Days'));

    const quantityInput = screen.getByRole('spinbutton', { name: /quantity to dispense/i });
    // Quantity should remain empty — auto-calc is disabled
    await waitFor(() => {
      expect(quantityInput).not.toHaveValue();
    });
    expect(screen.queryByText(/auto-calculated/i)).not.toBeInTheDocument();

    // Restore default mock
    (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
      requireOutpatientQuantity: true,
      error: null,
      isLoading: false,
    });
  });

  it('proposes matching dose and quantity units for a new outpatient prescription', async () => {
    renderDrugOrderForm(createNewOrderBasketItem());

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue('Tablet');
      expect(screen.getByRole('combobox', { name: /quantity unit/i })).toHaveValue('Tablet');
    });
  });

  it('limits outpatient duration units and defaults a positive duration to days', async () => {
    const user = userEvent.setup();
    renderDrugOrderForm(createNewOrderBasketItem());

    const durationUnitCombobox = screen.getByRole('combobox', { name: /duration unit/i });
    await user.click(durationUnitCombobox);

    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Weeks')).toBeInTheDocument();
    expect(screen.getByText('Months')).toBeInTheDocument();
    expect(screen.queryByText('Minutes')).not.toBeInTheDocument();
    expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Years')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.type(durationInput, '7');

    await waitFor(() => expect(durationUnitCombobox).toHaveValue('Days'));
  });

  it('keeps the complete backend duration catalog outside the outpatient workflow', async () => {
    const user = userEvent.setup();
    (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
      requireOutpatientQuantity: false,
      error: null,
      isLoading: false,
    });
    renderDrugOrderForm(createNewOrderBasketItem());

    await user.click(screen.getByRole('combobox', { name: /duration unit/i }));

    expect(screen.getByText('Minutes')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Years')).toBeInTheDocument();

    (useRequireOutpatientQuantity as vi.Mock).mockReturnValue({
      requireOutpatientQuantity: true,
      error: null,
      isLoading: false,
    });
  });

  it('shows mandatory fields and blocks an outpatient prescription without treatment duration', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(createNewOrderBasketItem(), onSave);

    expect(screen.getByText('* Required field')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /^dose$/i })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('combobox', { name: /route of administration/i })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('combobox', { name: /frequency/i })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveAttribute('aria-required', 'true');

    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText('Treatment duration is required')).toBeInTheDocument();
    expect(screen.getByText('Duration unit is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the required duration error on tablet', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    mockUseLayoutType.mockReturnValue('tablet');
    renderDrugOrderForm(createNewOrderBasketItem(), onSave);

    const durationInput = screen.getByRole('textbox', { name: /duration/i });
    expect(durationInput).toHaveAttribute('aria-required', 'true');

    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText('Treatment duration is required')).toBeInTheDocument();
    expect(durationInput).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects an indication containing only whitespace', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(createNewOrderBasketItem(), onSave);

    await user.type(
      screen.getByRole('textbox', {
        name: /diagnosis or reason for prescription/i,
      }),
      '   ',
    );
    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText('Indication is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects legacy free-text dosage containing only whitespace', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(
      createNewOrderBasketItem({
        isFreeTextDosage: true,
        freeTextDosage: '',
      }),
      onSave,
    );

    await user.type(screen.getByPlaceholderText(/free-text dosage/i), '   ');
    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText('Add free dosage note')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires a reason when medication is prescribed as needed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDrugOrderForm(createNewOrderBasketItem(), onSave);

    await user.click(screen.getByRole('checkbox', { name: /take as needed/i }));
    expect(screen.getByRole('textbox', { name: /reason for as-needed use/i })).toHaveAttribute('aria-required', 'true');
    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(await screen.findByText('Specify the reason for as-needed medication')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('special prescription warning', () => {
  const morphineDrug = {
    uuid: 'morphine-drug-uuid',
    display: 'Morfina clorhidrato 20 mg/mL solución inyectable',
    name: 'Morfina clorhidrato 20 mg/mL solución inyectable',
    strength: '20 mg/mL',
    dosageForm: { display: 'Solución inyectable', uuid: 'injectable-dosage-form-uuid' },
    concept: { display: 'Morfina', uuid: 'morphine-concept-uuid' },
  } as unknown as DrugOrderBasketItem['drug'];

  it('warns when the selected drug requires a special prescription', () => {
    renderDrugOrderForm(createNewOrderBasketItem({ drug: morphineDrug }));

    expect(screen.getByText(/requires a special prescription/i)).toBeInTheDocument();
    expect(screen.getByText(/023-2001-SA/)).toBeInTheDocument();
  });

  it('does not warn for drugs outside the special prescription list', () => {
    renderDrugOrderForm(createNewOrderBasketItem());

    expect(screen.queryByText(/requires a special prescription/i)).not.toBeInTheDocument();
  });

  it('does not warn when the configured substance list is empty', () => {
    mockUseConfig.mockReturnValue({ ...defaultConfig, specialPrescriptionDrugNames: [] });
    renderDrugOrderForm(createNewOrderBasketItem({ drug: morphineDrug }));

    expect(screen.queryByText(/requires a special prescription/i)).not.toBeInTheDocument();
  });
});
