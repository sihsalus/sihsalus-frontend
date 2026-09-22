import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useSession,
} from '@openmrs/esm-framework';
import { type DrugOrderBasketItem, type Order } from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { mockDrugSearchResultApiData, mockFhirPatient, mockSessionDataResponse } from 'test-utils';
import { buildMedicationOrder, prepMedicationOrderPostData } from '../api/api';
import { type ConfigObject, configSchema } from '../config-schema';
import DrugOrderForm from './drug-order-form.component';
import { getTemplateOrderBasketItem } from './drug-search/drug-search.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useLayoutType: vi.fn(() => 'small-desktop'),
}));

vi.mock('../api/api', async () => ({
  ...(await vi.importActual('../api/api')),
  useActivePatientOrders: vi.fn(() => ({ isLoading: false, data: [] })),
  useRequireOutpatientQuantity: vi.fn(() => ({
    requireOutpatientQuantity: true,
    error: null,
    isLoading: false,
  })),
}));

// Exercise the real useOrderConfig and SWR together with the form. Only HTTP is mocked.
const mockFetch = vi.mocked(openmrsFetch);
const tablet = { valueCoded: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Tablet' };
const milligram = { uuid: 'synthetic-milligram', display: 'mg' };
const metadata = {
  drugRoutes: [{ uuid: 'synthetic-oral', display: 'Oral' }],
  drugDosingUnits: [milligram],
  drugDispensingUnits: [{ uuid: tablet.valueCoded, display: tablet.value }],
  durationUnits: [{ uuid: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Days' }],
  orderFrequencies: [{ uuid: 'synthetic-daily', display: 'Once daily', frequencyPerDay: 1 }],
};
const response = (data: unknown) => ({ data, status: 200, statusText: 'OK' }) as FetchResponse;

function renderForm(overrides: Partial<DrugOrderBasketItem> = {}) {
  const item = {
    ...getTemplateOrderBasketItem(mockDrugSearchResultApiData[0], null),
    dosage: 2,
    unit: null,
    route: { valueCoded: 'synthetic-oral', value: 'Oral' },
    frequency: { valueCoded: 'synthetic-daily', value: 'Once daily', frequencyPerDay: 1 },
    duration: 7,
    durationUnit: { valueCoded: '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: 'Days' },
    pillsDispensed: 14,
    quantityUnits: tablet,
    isQuantityManual: true,
    numRefills: 0,
    indication: 'Synthetic indication',
    patientInstructions: 'Synthetic instructions',
    ...overrides,
  } as DrugOrderBasketItem;
  const onSave = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <DrugOrderForm
        initialOrderBasketItem={item}
        patient={mockFhirPatient}
        visitContext={null}
        onSave={onSave}
        saveButtonText="Save order"
        onCancel={vi.fn()}
        workspaceTitle="Add drug order"
      />
    </SWRConfig>,
  );
  return { onSave, item };
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(useConfig<ConfigObject>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
  vi.mocked(useSession).mockReturnValue(mockSessionDataResponse.data);
});

it.each([
  null,
  tablet,
])('waits for the catalog without substituting the drug dosage form or submitting: %j', async (savedUnit) => {
  let resolve!: (value: FetchResponse) => void;
  mockFetch.mockReturnValue(new Promise((done) => (resolve = done)));
  const { onSave } = renderForm({ unit: savedUnit });
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue(savedUnit?.value ?? '');
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toBeDisabled();
  expect(screen.getByText('Loading prescription options')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  });
  expect(onSave).not.toHaveBeenCalled();
  await act(async () => resolve(response(metadata)));
  await waitFor(() => expect(screen.getByRole('combobox', { name: /dose unit/i })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue(savedUnit?.value ?? '');
});

it('selects a catalog unit and preserves its UUID through the draft, REST payload and read mapping', async () => {
  mockFetch.mockResolvedValue(response(metadata));
  const user = userEvent.setup();
  const { onSave, item } = renderForm();
  const unit = screen.getByRole('combobox', { name: /dose unit/i });
  await waitFor(() => expect(unit).toBeEnabled());
  await user.click(unit);
  expect(screen.queryByRole('option', { name: 'Tablet' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'mg' }));
  expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const draft = onSave.mock.calls[0][0] as DrugOrderBasketItem;
  const payload = prepMedicationOrderPostData(draft, 'synthetic-patient', 'synthetic-encounter', 'synthetic-provider');
  expect(payload).toMatchObject({
    dose: 2,
    doseUnits: milligram.uuid,
    dosingType: 'org.openmrs.SimpleDosingInstructions',
  });
  // A synthetic REST representation checks the existing read mapper, not live backend persistence.
  const readBack = buildMedicationOrder(
    {
      ...payload,
      uuid: 'synthetic-order',
      drug: item.drug,
      doseUnits: milligram,
      encounter: { uuid: 'synthetic-encounter', visit: null },
    } as unknown as Order,
    'REVISE',
  );
  expect(readBack.unit).toEqual(draft.unit);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it.each([
  ['omitted', undefined, 'Dose units are unavailable'],
  ['empty', [], 'No dose units are configured'],
  ['invalid collection', {}, 'Dose units are unavailable'],
  ['invalid member', [{ uuid: '', display: 'Invalid' }], 'Dose units are unavailable'],
] as const)('shows a recoverable %s catalog without replacing a saved unit', async (_case, units, title) => {
  mockFetch.mockResolvedValue(response({ ...metadata, drugDosingUnits: units }));
  const { onSave } = renderForm({ unit: tablet });
  await screen.findByText(title);
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue('Tablet');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  });
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox', { name: /free-text dosage/i })).not.toBeInTheDocument();
});

it.each([
  401, 403, 500,
])('retries a %s failure in both requests, preserves input, and keeps a repeated failure visible', async (status) => {
  const error = Object.assign(new Error('Private backend detail'), { status });
  mockFetch.mockRejectedValue(error);
  const user = userEvent.setup();
  const { onSave } = renderForm({ unit: tablet });
  await screen.findByText('Prescription options could not be loaded');
  expect(screen.queryByText(/Private backend detail/)).not.toBeInTheDocument();
  const dose = screen.getByRole('spinbutton', { name: /^dose/i });
  await user.clear(dose);
  await user.type(dose, '3');
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
  await screen.findByText('Prescription options could not be loaded');
  expect(dose).toHaveValue(3);
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  });
  expect(onSave).not.toHaveBeenCalled();

  mockFetch.mockResolvedValue(
    response({
      ...metadata,
      drugDosingUnits: [{ uuid: tablet.valueCoded, display: tablet.value }, milligram],
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled());
  expect(mockFetch).toHaveBeenCalledTimes(6);
  expect(dose).toHaveValue(3);
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue('Tablet');
  fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0]).toMatchObject({
    dosage: 3,
    unit: tablet,
    patientInstructions: 'Synthetic instructions',
  });
});

it('requires explicit selection when a saved unit is absent from the current catalog', async () => {
  mockFetch.mockResolvedValue(response(metadata));
  const user = userEvent.setup();
  const { onSave } = renderForm({ unit: tablet, action: 'REVISE' });
  await screen.findByText('Select a dose unit from the available list.');
  const unit = screen.getByRole('combobox', { name: /dose unit/i });
  expect(unit).toHaveValue('Tablet');
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form')));
  expect(onSave).not.toHaveBeenCalled();
  await user.clear(unit);
  await user.type(unit, 'mg');
  await user.click(screen.getByRole('option', { name: 'mg' }));
  expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].unit.valueCoded).toBe(milligram.uuid);
});

it('recovers an omitted catalog without reopening and waits for both retry requests', async () => {
  mockFetch.mockResolvedValue(response({ ...metadata, drugDosingUnits: undefined }));
  const user = userEvent.setup();
  const { onSave } = renderForm({ unit: tablet });
  await screen.findByText('Dose units are unavailable');
  const requests: Array<(value: FetchResponse) => void> = [];
  mockFetch.mockImplementation(() => new Promise((resolve) => requests.push(resolve)));
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Loading prescription options');
  expect(requests).toHaveLength(2);
  const recoveredMetadata = {
    ...metadata,
    drugDosingUnits: [{ uuid: tablet.valueCoded, display: tablet.value }],
  };
  await act(async () => requests[0](response(recoveredMetadata)));
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: /dose unit/i })).toHaveValue('Tablet');
  await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form')));
  expect(onSave).not.toHaveBeenCalled();
  await act(async () => requests[1](response(recoveredMetadata)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled());
  fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0]).toMatchObject({ unit: tablet, dosage: 2 });
});

it('does not allow the free-text exception to bypass a failed frequency request', async () => {
  mockFetch.mockImplementation((url) =>
    String(url).includes('?')
      ? Promise.reject(Object.assign(new Error('Private frequency detail'), { status: 403 }))
      : Promise.resolve(response(metadata)),
  );
  const { onSave } = renderForm({
    isFreeTextDosage: true,
    freeTextDosage: 'Synthetic explicit regimen',
    dosage: null,
    route: null,
    frequency: null,
  });
  await screen.findByText('Prescription options could not be loaded');
  expect(screen.queryByText(/Private frequency detail/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save order' })).toBeDisabled();
  await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form')));
  expect(onSave).not.toHaveBeenCalled();
});

it('keeps the catalog warning visible for an explicitly selected free-text exception', async () => {
  mockFetch.mockResolvedValue(response({ ...metadata, drugDosingUnits: [] }));
  const { onSave } = renderForm({
    isFreeTextDosage: true,
    freeTextDosage: 'Synthetic explicit regimen',
    dosage: null,
    route: null,
    frequency: null,
  });
  await screen.findByText('No dose units are configured');
  expect(screen.getByPlaceholderText('Free-text dosage (exception)')).toHaveValue('Synthetic explicit regimen');
  expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Save order' }).closest('form'));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0]).toMatchObject({
    isFreeTextDosage: true,
    freeTextDosage: 'Synthetic explicit regimen',
    unit: null,
  });
});
