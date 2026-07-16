import { useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Form, Formik, FormikProvider, useFormikContext } from 'formik';
import { useCallback } from 'react';

import type { FieldDefinition } from '../../../config-schema';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruCarnetExtranjeriaPatientIdentifierTypeUuid,
  peruDniPatientIdentifierTypeUuid,
  peruNationalityConceptSetUuid,
  peruNationalityConceptUuid,
} from '../../peru-registration-config';
import { useConceptAnswers } from '../field.resource';
import { NationalityField } from './nationality-field.component';
import { usePersonAttributeType } from './person-attributes.resource';

vi.mock('../field.resource', async () => ({
  ...(await vi.importActual('../field.resource')),
  useConceptAnswers: vi.fn(),
}));

vi.mock('./person-attributes.resource', () => ({
  usePersonAttributeType: vi.fn(),
}));

const mockUseConceptAnswers = vi.mocked(useConceptAnswers);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseSession = vi.mocked(useSession);
const nationalityAttributeTypeUuid = 'nationality-attribute-type-uuid';
const unitedStatesConceptUuid = 'cb760cd0-e4dd-49cb-86c3-c3d4bde3b230';

const nationalityFieldDefinition = {
  id: 'nationality',
  type: 'person attribute',
  uuid: nationalityAttributeTypeUuid,
  label: 'Nacionalidad',
  showHeading: false,
  answerConceptSetUuid: peruNationalityConceptSetUuid,
  searchable: true,
} as FieldDefinition;

function buildIdentifier(identifierTypeUuid: string, identifierValue: string) {
  return {
    identifierTypeUuid,
    identifierName: 'Documento',
    identifierValue,
    initialValue: '',
    preferred: false,
    required: false,
    selectedSource: undefined,
  } as FormValues['identifiers'][string];
}

const dniIdentifier = buildIdentifier(peruDniPatientIdentifierTypeUuid, '12345678');
const carnetExtranjeriaIdentifier = buildIdentifier(peruCarnetExtranjeriaPatientIdentifierTypeUuid, 'CE123456');

interface NationalityFieldTestHarnessProps {
  setFieldValue: PatientRegistrationContextProps['setFieldValue'];
  values: Partial<FormValues>;
}

function NationalityFieldTestHarness({ setFieldValue, values }: NationalityFieldTestHarnessProps) {
  const attributes = values.attributes ?? {};
  const identifiers = values.identifiers ?? {};

  return (
    <Formik initialValues={{ attributes }} onSubmit={() => {}}>
      <Form>
        <PatientRegistrationContext.Provider
          value={
            {
              inEditMode: false,
              setFieldValue,
              values: {
                attributes,
                identifiers,
              },
            } as unknown as PatientRegistrationContextProps
          }
        >
          <NationalityField fieldDefinition={nationalityFieldDefinition} />
        </PatientRegistrationContext.Provider>
      </Form>
    </Formik>
  );
}

function renderNationalityField(values: Partial<FormValues> = {}) {
  const setFieldValue = vi.fn();
  const renderResult = render(<NationalityFieldTestHarness setFieldValue={setFieldValue} values={values} />);

  return {
    ...renderResult,
    setFieldValue,
    rerenderWithValues: (nextValues: Partial<FormValues>) =>
      renderResult.rerender(<NationalityFieldTestHarness setFieldValue={setFieldValue} values={nextValues} />),
  };
}

function StatefulNationalityFieldTestHarness({ onSetFieldValue }: { onSetFieldValue: () => void }) {
  const formik = useFormikContext<FormValues>();
  const setFieldValue = useCallback(
    (field: string, value: unknown, shouldValidate?: boolean) => {
      onSetFieldValue();
      return formik.setFieldValue(field, value, shouldValidate);
    },
    [formik.setFieldValue, onSetFieldValue],
  );

  return (
    <FormikProvider value={{ ...formik, setFieldValue }}>
      <Form>
        <PatientRegistrationContext.Provider
          value={
            {
              inEditMode: false,
              setFieldValue,
              values: formik.values,
            } as unknown as PatientRegistrationContextProps
          }
        >
          <Field aria-label="DNI" name="identifiers.dni.identifierValue" />
          <NationalityField fieldDefinition={nationalityFieldDefinition} />
        </PatientRegistrationContext.Provider>
      </Form>
    </FormikProvider>
  );
}

describe('NationalityField', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { privileges: [{ display: 'Get Concepts', name: 'Get Concepts' }] },
    } as ReturnType<typeof useSession>);
    mockUseConceptAnswers.mockReturnValue({
      data: [
        { uuid: peruNationalityConceptUuid, display: 'Perú' },
        { uuid: unitedStatesConceptUuid, display: 'Estados Unidos de América' },
      ],
      isLoading: false,
      error: null,
    });
    mockUsePersonAttributeType.mockReturnValue({
      data: {
        uuid: nationalityAttributeTypeUuid,
        display: 'Nacionalidad',
        name: 'Nacionalidad',
        description: 'País correspondiente a la nacionalidad declarada',
        format: 'org.openmrs.Concept',
      },
      isLoading: false,
      error: null,
    });
  });

  it('loads nationalities from the configured OpenMRS concept set', async () => {
    const user = userEvent.setup();
    renderNationalityField();

    expect(mockUseConceptAnswers).toHaveBeenCalledWith(peruNationalityConceptSetUuid);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Perú')).toBeInTheDocument();
    expect(await screen.findByText('Estados Unidos de América')).toBeInTheDocument();
  });

  it('sets and locks the Peru concept when a completed DNI is present', async () => {
    const { setFieldValue } = renderNationalityField({ identifiers: { dni: dniIdentifier } });

    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).toBeDisabled();
    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        `attributes.${nationalityAttributeTypeUuid}`,
        peruNationalityConceptUuid,
      ),
    );
  });

  it('assigns Peru once without recursively rewriting Formik when the DNI is completed', async () => {
    const user = userEvent.setup();
    const onSetFieldValue = vi.fn();
    const initialValues = {
      attributes: {},
      identifiers: {
        dni: buildIdentifier(peruDniPatientIdentifierTypeUuid, '1234567'),
      },
    } as unknown as FormValues;

    render(
      <Formik initialValues={initialValues} onSubmit={() => {}}>
        <StatefulNationalityFieldTestHarness onSetFieldValue={onSetFieldValue} />
      </Formik>,
    );

    await user.type(screen.getByRole('textbox', { name: 'DNI' }), '8');

    await waitFor(() => expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).toHaveValue('Perú'));
    await waitFor(() => expect(onSetFieldValue).toHaveBeenCalledTimes(1));
  });

  it('clears and reassigns automatic nationality exactly once as DNI completeness changes', async () => {
    const user = userEvent.setup();
    const onSetFieldValue = vi.fn();
    const initialValues = {
      attributes: {},
      identifiers: {
        dni: buildIdentifier(peruDniPatientIdentifierTypeUuid, '1234567'),
      },
    } as unknown as FormValues;

    render(
      <Formik initialValues={initialValues} onSubmit={() => {}}>
        <StatefulNationalityFieldTestHarness onSetFieldValue={onSetFieldValue} />
      </Formik>,
    );

    const dni = screen.getByRole('textbox', { name: 'DNI' });
    const nationality = screen.getByRole('combobox', { name: /Nacionalidad/u });

    await user.type(dni, '8');
    await waitFor(() => expect(nationality).toHaveValue('Perú'));
    expect(nationality).toBeDisabled();
    await waitFor(() => expect(onSetFieldValue).toHaveBeenCalledTimes(1));

    await user.type(dni, '{Backspace}');
    await waitFor(() => expect(nationality).toHaveValue(''));
    expect(nationality).toBeEnabled();
    await waitFor(() => expect(onSetFieldValue).toHaveBeenCalledTimes(2));

    await user.type(dni, '8');
    await waitFor(() => expect(nationality).toHaveValue('Perú'));
    expect(nationality).toBeDisabled();
    await waitFor(() => expect(onSetFieldValue).toHaveBeenCalledTimes(3));
  });

  it('does not infer nationality from an empty DNI field', () => {
    const { setFieldValue } = renderNationalityField({
      identifiers: { dni: buildIdentifier(peruDniPatientIdentifierTypeUuid, '') },
    });

    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).not.toBeDisabled();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('does not infer nationality from an incomplete or malformed DNI', () => {
    const { setFieldValue } = renderNationalityField({
      identifiers: { dni: buildIdentifier(peruDniPatientIdentifierTypeUuid, '1234567A') },
    });

    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).not.toBeDisabled();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('does not infer nationality from a foreign identity document', () => {
    const { setFieldValue } = renderNationalityField({ identifiers: { ce: carnetExtranjeriaIdentifier } });

    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).not.toBeDisabled();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('does not overwrite an explicitly recorded nationality when a DNI is added', () => {
    const { setFieldValue } = renderNationalityField({
      attributes: { [nationalityAttributeTypeUuid]: unitedStatesConceptUuid },
      identifiers: { dni: dniIdentifier },
    });

    expect(setFieldValue).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).not.toBeDisabled();
    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).toHaveValue('Estados Unidos de América');
  });

  it('preserves an explicitly recorded nationality when a foreign document is present', () => {
    const { setFieldValue } = renderNationalityField({
      attributes: { [nationalityAttributeTypeUuid]: peruNationalityConceptUuid },
      identifiers: { ce: carnetExtranjeriaIdentifier },
    });

    expect(setFieldValue).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Nacionalidad/u })).toHaveValue('Perú');
  });

  it('clears only a Peru nationality automatically assigned during the current edit', async () => {
    const { rerenderWithValues, setFieldValue } = renderNationalityField({ identifiers: { dni: dniIdentifier } });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith(expect.any(String), peruNationalityConceptUuid));
    setFieldValue.mockClear();

    rerenderWithValues({
      attributes: { [nationalityAttributeTypeUuid]: peruNationalityConceptUuid },
      identifiers: { ce: carnetExtranjeriaIdentifier },
    });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith(`attributes.${nationalityAttributeTypeUuid}`, ''));
  });

  it('does not clear an existing Peru nationality after editing a patient with DNI', () => {
    const { rerenderWithValues, setFieldValue } = renderNationalityField({
      attributes: { [nationalityAttributeTypeUuid]: peruNationalityConceptUuid },
      identifiers: { dni: dniIdentifier },
    });

    expect(setFieldValue).not.toHaveBeenCalled();
    rerenderWithValues({
      attributes: { [nationalityAttributeTypeUuid]: peruNationalityConceptUuid },
      identifiers: { ce: carnetExtranjeriaIdentifier },
    });
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('shows a configuration error instead of treating nationality as text', () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: {
        uuid: nationalityAttributeTypeUuid,
        display: 'Nacionalidad',
        name: 'Nacionalidad',
        description: 'Nacionalidad',
        format: 'java.lang.String',
      },
      isLoading: false,
      error: null,
    });

    renderNationalityField();

    expect(screen.getByText(/must use the org\.openmrs\.Concept format/u)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Nacionalidad/u })).not.toBeInTheDocument();
  });
});
