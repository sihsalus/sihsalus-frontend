import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockDrugSearchResultApiData, mockFhirPatient, mockSessionDataResponse } from 'test-utils';
import { useRequireOutpatientQuantity } from '../api/api';
import { type ConfigObject, configSchema } from '../config-schema';
import DrugOrderForm from './drug-order-form.component';
import { getTemplateOrderBasketItem } from './drug-search/drug-search.resource';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual('@openmrs/esm-framework');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    OpenmrsDatePicker: React.forwardRef(
      (props: Record<string, unknown>, ref: import('react').ForwardedRef<HTMLSpanElement>) =>
        React.createElement('span', { ref }, props.labelText as import('react').ReactNode),
    ),
  };
});

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
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
        { valueCoded: 'once-daily-uuid', value: 'Once daily', frequencyPerDay: 1.0, names: ['OD', 'Once daily'] },
        { valueCoded: 'twice-daily-uuid', value: 'Twice daily', frequencyPerDay: 2.0, names: ['BD', 'Twice daily'] },
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
