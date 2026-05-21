import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';

import { GenderField } from './gender-field.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

vi.mock('react', async () => ({
  ...((await vi.importActual('react')) as any),
  useContext: vi.fn(() => ({
    setFieldValue: vi.fn(),
    setFieldTouched: vi.fn(),
  })),
}));

vi.mock('formik', async () => ({
  ...((await vi.importActual('formik')) as any),
  useField: vi.fn(() => [{}, {}]),
}));

describe('GenderField', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        gender: [
          {
            value: 'male',
            label: 'Male',
          },
          {
            value: 'female',
            label: 'Female',
          },
        ],
        name: {
          displayMiddleName: false,
          allowUnidentifiedPatients: false,
          defaultUnknownGivenName: '',
          defaultUnknownFamilyName: '',
          displayCapturePhoto: false,
          displayReverseFieldOrder: false,
        },
      } as RegistrationConfig['fieldConfigurations'],
    });
  });
  it('has a label', () => {
    render(
      <Formik initialValues={{}} onSubmit={null}>
        <Form>
          <GenderField />
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('heading', { name: /sex/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^male/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/female/i)).toBeInTheDocument();
  });

  it('checks an option', async () => {
    const user = userEvent.setup();
    render(
      <Formik initialValues={{}} onSubmit={null}>
        <Form>
          <GenderField />
        </Form>
      </Formik>,
    );

    await user.click(screen.getByText(/female/i));
    expect(screen.getByLabelText(/female/i)).toBeChecked();
    expect(screen.getByLabelText(/^male/i)).not.toBeChecked();
  });
});
