import { render, screen, waitFor } from '@testing-library/react';
import { Form, Formik } from 'formik';

import type { FieldDefinition } from '../../../config-schema';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import { defaultNationalityCountryCode } from './country-options';
import { NationalityField } from './nationality-field.component';
import { usePersonAttributeType } from './person-attributes.resource';

vi.mock('./person-attributes.resource', () => ({
  usePersonAttributeType: vi.fn(),
}));

const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);

const nationalityFieldDefinition = {
  id: 'nationality',
  type: 'person attribute',
  uuid: 'nationality-attribute-type-uuid',
  label: 'Nacionalidad',
  showHeading: false,
} as FieldDefinition;

const dniIdentifier = {
  identifierTypeUuid: '550e8400-e29b-41d4-a716-446655440001',
  identifierName: 'DNI',
  identifierValue: '12345678',
  initialValue: '',
  preferred: false,
  required: false,
  selectedSource: undefined,
} as FormValues['identifiers'][string];

const carnetExtranjeriaIdentifier = {
  identifierTypeUuid: '550e8400-e29b-41d4-a716-446655440002',
  identifierName: 'Carné de Extranjería',
  identifierValue: 'CE123456',
  initialValue: '',
  preferred: false,
  required: false,
  selectedSource: undefined,
} as FormValues['identifiers'][string];

interface NationalityFieldTestHarnessProps {
  setFieldValue: PatientRegistrationContextProps['setFieldValue'];
  values: Partial<FormValues>;
}

function NationalityFieldTestHarness({ setFieldValue, values }: NationalityFieldTestHarnessProps) {
  const attributes = values.attributes ?? {};
  const identifiers = values.identifiers ?? {};

  return (
    <Formik initialValues={{ attributes }} onSubmit={null}>
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
    rerenderWithValues: (values: Partial<FormValues>) =>
      renderResult.rerender(<NationalityFieldTestHarness setFieldValue={setFieldValue} values={values} />),
  };
}

describe('NationalityField', () => {
  beforeEach(() => {
    mockUsePersonAttributeType.mockReturnValue({
      data: {
        uuid: 'nationality-attribute-type-uuid',
        display: 'Nationality',
        name: 'Nationality',
        description: 'Nationality',
        format: 'java.lang.String',
      },
      isLoading: false,
      error: null,
    });
  });

  it('sets missing nationality to Peru when DNI is selected', async () => {
    const { setFieldValue } = renderNationalityField({
      identifiers: {
        dni: dniIdentifier,
      },
    });

    expect(screen.getByRole('option', { name: /Per/u })).toHaveValue(defaultNationalityCountryCode);
    expect(screen.getByRole('option', { name: /United States|Estados Unidos/u })).toHaveValue('US');
    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        'attributes.nationality-attribute-type-uuid',
        defaultNationalityCountryCode,
      ),
    );
  }, 10000);

  it('locks nationality to Peru when DNI is selected', () => {
    renderNationalityField({
      attributes: {
        'nationality-attribute-type-uuid': defaultNationalityCountryCode,
      },
      identifiers: {
        dni: dniIdentifier,
      },
    });

    const nationality = screen.getByLabelText('Nacionalidad') as HTMLSelectElement;

    expect(nationality).toHaveValue(defaultNationalityCountryCode);
    expect(nationality).toBeDisabled();
  });

  it('does not default nationality to Peru for foreign identity documents', () => {
    const { setFieldValue } = renderNationalityField({
      identifiers: {
        ce: carnetExtranjeriaIdentifier,
      },
    });

    const nationality = screen.getByLabelText('Nacionalidad') as HTMLSelectElement;

    expect(nationality).toHaveValue('');
    expect(nationality).not.toBeDisabled();
    expect(setFieldValue).not.toHaveBeenCalledWith(
      'attributes.nationality-attribute-type-uuid',
      defaultNationalityCountryCode,
    );
  });

  it('clears an automatic Peru nationality when switching to a foreign identity document', async () => {
    const { setFieldValue } = renderNationalityField({
      attributes: {
        'nationality-attribute-type-uuid': defaultNationalityCountryCode,
      },
      identifiers: {
        ce: carnetExtranjeriaIdentifier,
      },
    });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('attributes.nationality-attribute-type-uuid', ''));
  });

  it('preserves an explicitly selected foreign nationality when a foreign identity document is selected', () => {
    const { setFieldValue } = renderNationalityField({
      attributes: {
        'nationality-attribute-type-uuid': 'US',
      },
      identifiers: {
        ce: carnetExtranjeriaIdentifier,
      },
    });

    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('updates nationality rules when the identity document changes after render', async () => {
    const { rerenderWithValues, setFieldValue } = renderNationalityField({
      identifiers: {
        ce: carnetExtranjeriaIdentifier,
      },
    });

    expect(screen.getByLabelText('Nacionalidad')).toHaveValue('');
    expect(screen.getByLabelText('Nacionalidad')).not.toBeDisabled();
    setFieldValue.mockClear();

    rerenderWithValues({
      identifiers: {
        dni: dniIdentifier,
      },
    });

    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        'attributes.nationality-attribute-type-uuid',
        defaultNationalityCountryCode,
      ),
    );
    setFieldValue.mockClear();

    rerenderWithValues({
      attributes: {
        'nationality-attribute-type-uuid': defaultNationalityCountryCode,
      },
      identifiers: {
        ce: carnetExtranjeriaIdentifier,
      },
    });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('attributes.nationality-attribute-type-uuid', ''));
  });
});
