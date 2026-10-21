import { useFeatureFlag } from '@openmrs/esm-framework';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik, useFormikContext } from 'formik';

import { FormManager } from '../../form-manager';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruDniPatientIdentifierTypeUuid,
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationNotConsultedConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceSelfFinancingConceptUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruSisEessNameAttributeTypeUuid,
  peruSisTypeDescriptionAttributeTypeUuid,
  replacePeruFinancerInForm,
} from '../../peru-registration-config';
import { lookupSisInsuranceByDni, useSisProductAnswers } from './sis-lookup.resource';
import { SisLookupField } from './sis-lookup-field.component';

vi.mock('./sis-lookup.resource', () => ({
  sisOnlineVerificationUrl: 'https://example.invalid/sis',
  lookupSisInsuranceByDni: vi.fn(),
  useSisProductAnswers: vi.fn(),
}));

const product = { uuid: 'synthetic-product', display: 'Synthetic SIS product' };
const checkedAt = '2026-09-01T12:00:00.000Z';
const now = '2026-10-21T22:00:00.000Z';
const statusAttribute = peruInsuranceAccreditationStatusAttributeTypeUuid;
const productAttribute = peruSisTypeDescriptionAttributeTypeUuid;
const dateAttribute = peruInsuranceAccreditationCheckedAtAttributeTypeUuid;
const methodAttribute = peruInsuranceVerificationMethodAttributeTypeUuid;

function buildValues(attributes: FormValues['attributes'] = {}) {
  return {
    attributes: {
      [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
      [peruInsuranceCodeAttributeTypeUuid]: 'TEST-SIS-401',
      [statusAttribute]: peruInsuranceAccreditationNotConsultedConceptUuid,
      ...attributes,
    },
    identifiers: {
      dni: { identifierTypeUuid: peruDniPatientIdentifierTypeUuid, identifierValue: '12345678' },
    },
  } as unknown as FormValues;
}

function Fields({ initialValues, isOffline }: { initialValues: FormValues; isOffline: boolean }) {
  const { values, setFieldValue, setFieldTouched } = useFormikContext<FormValues>();
  return (
    <PatientRegistrationContext.Provider
      value={{
        currentPhoto: null,
        identifierTypes: [],
        inEditMode: true,
        initialFormValues: initialValues,
        isOffline,
        setCapturePhotoProps: vi.fn(),
        setFieldValue,
        setFieldTouched,
        validationSchema: null,
        values,
      }}
    >
      <SisLookupField />
      <button
        type="button"
        onClick={() => replacePeruFinancerInForm(peruInsuranceSelfFinancingConceptUuid, setFieldValue)}
      >
        Cambiar financiador
      </button>
    </PatientRegistrationContext.Provider>
  );
}

function VerificationForm({
  initialValues = buildValues(),
  isOffline = false,
  onSave,
}: {
  initialValues?: FormValues;
  isOffline?: boolean;
  onSave: (values: FormValues) => void;
}) {
  return (
    <Formik initialValues={initialValues} onSubmit={async (values) => onSave(values)}>
      <Form noValidate>
        <Fields initialValues={initialValues} isOffline={isOffline} />
        <button type="submit">Guardar paciente</button>
      </Form>
    </Formik>
  );
}

const getProductSelect = () => screen.getByRole('combobox', { name: /Producto SIS|SIS product/i });
const getActiveRadio = () => screen.getByRole('radio', { name: /^Vigente$|^Active$/i });
const save = () => screen.getByRole('button', { name: 'Guardar paciente' });

async function selectProduct(user: ReturnType<typeof userEvent.setup>) {
  const select = getProductSelect();
  await user.selectOptions(select, within(select).getByRole('option', { name: product.display }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.mocked(useFeatureFlag).mockReturnValue(false);
  vi.mocked(useSisProductAnswers).mockReturnValue({ answers: [product], error: undefined, isLoading: false });
  vi.mocked(lookupSisInsuranceByDni).mockResolvedValue(null);
});

afterEach(() => vi.useRealTimers());

it.each([
  [/^Vigente$|^Active$/i, peruInsuranceAccreditationActiveConceptUuid],
  [/^No vigente$|^Inactive$/i, peruInsuranceAccreditationInactiveConceptUuid],
  [/No consultada|Not checked/i, peruInsuranceAccreditationPendingConceptUuid],
])('saves the selected SIS result with the patient without a separate apply action: %s', async (name, uuid) => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  const { unmount } = render(<VerificationForm onSave={onSave} />);

  await user.click(screen.getByRole('radio', { name }));
  await selectProduct(user);
  expect(onSave).not.toHaveBeenCalled();
  await user.click(save());

  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const values = onSave.mock.calls[0][0] as FormValues;
  const payload = FormManager.getPatientAttributes(values, { [`attribute.${statusAttribute}`]: 'existing-status-row' });
  expect(payload).toEqual(
    expect.arrayContaining([
      { attributeType: statusAttribute, uuid: 'existing-status-row', value: uuid },
      { attributeType: productAttribute, value: product.display },
      { attributeType: methodAttribute, value: 'manual-web' },
      { attributeType: dateAttribute, value: now },
      { attributeType: peruInsuranceCodeAttributeTypeUuid, value: 'TEST-SIS-401' },
    ]),
  );
  unmount();
  vi.setSystemTime('2026-10-22T12:00:00.000Z');
  render(
    <VerificationForm
      initialValues={buildValues(
        Object.fromEntries(payload.map((attribute) => [attribute.attributeType, attribute.value])),
      )}
      onSave={onSave}
    />,
  );
  expect(screen.getByRole('radio', { name })).toBeChecked();
  expect(getProductSelect()).toHaveValue(product.display);
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[1][0].attributes[dateAttribute]).toBe(now);
});

it('reopens saved SIS values and preserves the original verification evidence on an unchanged save', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  const initialValues = buildValues({
    [statusAttribute]: peruInsuranceAccreditationActiveConceptUuid,
    [productAttribute]: product.display,
    [peruSisEessNameAttributeTypeUuid]: 'Synthetic facility',
    [dateAttribute]: checkedAt,
    [methodAttribute]: 'setisis',
  });
  render(<VerificationForm initialValues={initialValues} onSave={onSave} />);

  expect(getActiveRadio()).toBeChecked();
  expect(getProductSelect()).toHaveValue(product.display);
  expect(screen.getByRole('textbox', { name: /EESS|facility/i })).toHaveValue('Synthetic facility');
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes).toEqual(initialValues.attributes);
});

it('reconfirms an already active result only when the operator explicitly selects it again', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <VerificationForm
      initialValues={buildValues({
        [statusAttribute]: peruInsuranceAccreditationActiveConceptUuid,
        [productAttribute]: product.display,
        [dateAttribute]: checkedAt,
        [methodAttribute]: 'setisis',
      })}
      onSave={onSave}
    />,
  );
  expect(getActiveRadio()).toBeChecked();
  await user.click(getActiveRadio());
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes).toMatchObject({
    [dateAttribute]: now,
    [methodAttribute]: 'manual-web',
  });
});

it('blocks the patient save for a new verification without a product and retains the selection for retry', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<VerificationForm onSave={onSave} />);
  await user.click(getActiveRadio());
  await user.click(save());
  await screen.findByText(/Seleccione un producto SIS|Select a SIS product/i);
  expect(onSave).not.toHaveBeenCalled();
  expect(getActiveRadio()).toBeChecked();

  await selectProduct(user);
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
});

it('requires an explicit result when a product is entered before a new verification', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<VerificationForm onSave={onSave} />);
  await selectProduct(user);
  await user.click(save());
  await screen.findByText(/Seleccione el resultado|Select the SIS verification result/i);
  expect(onSave).not.toHaveBeenCalled();
});

it.each(['', 'Historical product outside the current catalog'])(
  'preserves an unchanged historical verification with product %j',
  async (historicalProduct) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initialValues = buildValues({
      [statusAttribute]: peruInsuranceAccreditationActiveConceptUuid,
      [productAttribute]: historicalProduct,
      [dateAttribute]: checkedAt,
      [methodAttribute]: 'manual-web',
    });
    render(<VerificationForm initialValues={initialValues} onSave={onSave} />);
    expect(getProductSelect()).toHaveValue(historicalProduct);
    await user.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].attributes).toEqual(initialValues.attributes);
  },
);

it('does not renew the verification date or method when only the facility changes', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <VerificationForm
      initialValues={buildValues({
        [statusAttribute]: peruInsuranceAccreditationActiveConceptUuid,
        [productAttribute]: product.display,
        [dateAttribute]: checkedAt,
        [methodAttribute]: 'setisis',
      })}
      onSave={onSave}
    />,
  );
  await user.type(screen.getByRole('textbox', { name: /EESS|facility/i }), 'Synthetic facility');
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes).toMatchObject({
    [dateAttribute]: checkedAt,
    [methodAttribute]: 'setisis',
    [peruSisEessNameAttributeTypeUuid]: 'Synthetic facility',
  });
});

it('blocks a new verification when the product catalog fails without losing the result', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  vi.mocked(useSisProductAnswers).mockReturnValue({ answers: [], error: new Error('synthetic'), isLoading: false });
  render(<VerificationForm onSave={onSave} />);
  expect(screen.getByText(/No se pueden cargar los productos SIS|SIS products cannot be loaded/i)).toBeVisible();
  await user.click(getActiveRadio());
  await user.click(save());
  await screen.findByText(/Seleccione un producto SIS|Select a SIS product/i);
  expect(onSave).not.toHaveBeenCalled();
  expect(getActiveRadio()).toBeChecked();
});

it('clears verification values and no longer requires a SIS product after changing the payer', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<VerificationForm onSave={onSave} />);
  await user.click(getActiveRadio());
  await user.click(screen.getByRole('button', { name: 'Cambiar financiador' }));
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(FormManager.getPatientAttributes(onSave.mock.calls[0][0])).toEqual([
    { attributeType: peruInsuranceTypeAttributeTypeUuid, value: peruInsuranceSelfFinancingConceptUuid },
  ]);
});

it('keeps a new offline verification pending until synchronization', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<VerificationForm isOffline onSave={onSave} />);
  expect(getActiveRadio()).toBeDisabled();
  expect(screen.getByRole('radio', { name: /^No vigente$|^Inactive$/i })).toBeDisabled();
  await selectProduct(user);
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes[statusAttribute]).toBe(peruInsuranceAccreditationPendingConceptUuid);
});

it('retains provider evidence when completing a successful automatic lookup', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  vi.mocked(useFeatureFlag).mockReturnValue(true);
  vi.mocked(lookupSisInsuranceByDni).mockResolvedValue({
    active: true,
    checkedAt,
    documentNumber: '12345678',
    insuranceCode: 'TEST-SIS-AUTO-401',
  });
  render(<VerificationForm onSave={onSave} />);
  await user.click(screen.getByRole('button', { name: /Consultar SIS|Lookup SIS/i }));
  await waitFor(() => expect(getActiveRadio()).toBeChecked());
  await selectProduct(user);
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes).toMatchObject({
    [dateAttribute]: checkedAt,
    [methodAttribute]: 'setisis',
    [peruInsuranceCodeAttributeTypeUuid]: 'TEST-SIS-AUTO-401',
  });
});

it('records manual evidence when the operator changes an automatic verification result', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  vi.mocked(useFeatureFlag).mockReturnValue(true);
  vi.mocked(lookupSisInsuranceByDni).mockResolvedValue({
    active: true,
    checkedAt,
    documentNumber: '12345678',
    insuranceCode: 'TEST-SIS-AUTO-401',
  });
  render(<VerificationForm onSave={onSave} />);
  await user.click(screen.getByRole('button', { name: /Consultar SIS|Lookup SIS/i }));
  await waitFor(() => expect(getActiveRadio()).toBeChecked());
  await user.click(screen.getByRole('radio', { name: /^No vigente$|^Inactive$/i }));
  await selectProduct(user);
  await user.click(save());
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0][0].attributes).toMatchObject({
    [statusAttribute]: peruInsuranceAccreditationInactiveConceptUuid,
    [dateAttribute]: now,
    [methodAttribute]: 'manual-web',
  });
});
