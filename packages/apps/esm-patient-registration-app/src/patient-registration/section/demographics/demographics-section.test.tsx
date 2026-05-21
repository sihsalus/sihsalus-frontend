import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { Form, Formik } from 'formik';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';
import { initialFormValues } from '../../patient-registration.component';
import { PatientRegistrationContext } from '../../patient-registration-context';

import { DemographicsSection } from './demographics-section.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

vi.mock('../../field/name/name-field.component', () => {
  return {
    NameField: () => (
      <div>
        <input type="text" name="name" />
      </div>
    ),
  };
});

vi.mock('../../field/gender/gender-field.component', () => {
  return {
    GenderField: () => (
      <div>
        <input type="text" name="name" />
      </div>
    ),
  };
});

vi.mock('../../field/id/id-field.component', () => {
  return {
    IdField: () => (
      <div>
        <input type="text" name="name" />
      </div>
    ),
  };
});

describe('Demographics section', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        dateOfBirth: {
          allowEstimatedDateOfBirth: true,
          useEstimatedDateOfBirth: { enabled: true, dayOfMonth: 0, month: 0 },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });
  });

  const setupSection = async (birthdateEstimated?: boolean, addNameInLocalLanguage?: boolean) => {
    render(
      <Formik initialValues={{ ...initialFormValues, birthdateEstimated, addNameInLocalLanguage }} onSubmit={null}>
        <Form>
          <PatientRegistrationContext.Provider
            value={{
              initialFormValues: null,
              identifierTypes: [],
              validationSchema: {},
              values: { ...initialFormValues, birthdateEstimated, addNameInLocalLanguage },
              inEditMode: false,
              setFieldValue: () => {},
              currentPhoto: 'TEST',
              isOffline: true,
              setCapturePhotoProps: (_value) => {},
              setFieldTouched: () => {},
            }}
          >
            <DemographicsSection fields={['name', 'gender', 'dob']} />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );
    const allInputs = screen.getAllByRole('textbox') as Array<HTMLInputElement>;
    return allInputs.map((input) => input.name);
  };

  it('renders demographics fields and date of birth inputs', async () => {
    const inputNames = await setupSection();
    expect(inputNames.length).toBe(3);

    expect(screen.getByText(/date of birth known\?/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /yes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /no/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /date of birth/i })).toBeInTheDocument();
  });
});
