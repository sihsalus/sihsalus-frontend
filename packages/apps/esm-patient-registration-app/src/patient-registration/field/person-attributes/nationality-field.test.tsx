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

function renderNationalityField(values: Partial<FormValues> = {}) {
  const setFieldValue = vi.fn();

  render(
    <Formik initialValues={{ attributes: values.attributes ?? {} }} onSubmit={null}>
      <Form>
        <PatientRegistrationContext.Provider
          value={
            {
              inEditMode: false,
              setFieldValue,
              values: {
                attributes: values.attributes ?? {},
              },
            } as unknown as PatientRegistrationContextProps
          }
        >
          <NationalityField fieldDefinition={nationalityFieldDefinition} />
        </PatientRegistrationContext.Provider>
      </Form>
    </Formik>,
  );

  return { setFieldValue };
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

  it('renders a country dropdown and defaults to Peru', async () => {
    const { setFieldValue } = renderNationalityField();

    const nationality = screen.getByLabelText('Nacionalidad') as HTMLSelectElement;

    expect(nationality).toHaveValue(defaultNationalityCountryCode);
    expect(screen.getByRole('option', { name: /Per/u })).toHaveValue(defaultNationalityCountryCode);
    expect(screen.getByRole('option', { name: /United States|Estados Unidos/u })).toHaveValue('US');
    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        'attributes.nationality-attribute-type-uuid',
        defaultNationalityCountryCode,
      ),
    );
  }, 10000);
});
