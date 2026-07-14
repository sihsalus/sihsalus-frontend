import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { Form, Formik } from 'formik';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';
import { initialFormValues } from '../../patient-registration.component';
import { PatientRegistrationContext } from '../../patient-registration-context';

import { calcBirthdate, DobField } from './dob.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

describe('Dob', () => {
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

  it('keeps configured estimated dates inside the OpenMRS calendar boundary', () => {
    const referenceDate = new Date(2026, 6, 13, 12);
    const fixedJanuaryDateConfig = {
      allowEstimatedDateOfBirth: true,
      useEstimatedDateOfBirth: { enabled: true, dayOfMonth: 1, month: 0 },
    };
    const estimatedBirthdate = calcBirthdate(140, 0, fixedJanuaryDateConfig, referenceDate);

    expect(estimatedBirthdate).not.toBeNull();
    expect(
      estimatedBirthdate &&
        `${estimatedBirthdate.getFullYear()}-${String(estimatedBirthdate.getMonth() + 1).padStart(2, '0')}-${String(estimatedBirthdate.getDate()).padStart(2, '0')}`,
    ).toBe('1886-07-13');
  });

  it('renders the fields in the birth section of the registration form', () => {
    render(
      <Formik initialValues={{ birthdate: '' }} onSubmit={() => {}}>
        <Form>
          <PatientRegistrationContext.Provider
            value={{
              identifierTypes: [],
              values: initialFormValues,
              validationSchema: null,
              inEditMode: false,
              setFieldValue: () => {},
              setCapturePhotoProps: (_value) => {},
              setFieldTouched: () => {},
              currentPhoto: '',
              isOffline: false,
              initialFormValues: initialFormValues,
            }}
          >
            <DobField />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('heading', { name: /birth/i })).toBeInTheDocument();
    expect(screen.getByText(/date of birth known?/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /no/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /yes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /yes/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /no/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('textbox', { name: /date of birth/i })).toBeInTheDocument();
  });

  it('renders the date picker input for date of birth', () => {
    render(
      <Formik initialValues={{ birthdate: '' }} onSubmit={() => {}}>
        <Form>
          <PatientRegistrationContext.Provider
            value={{
              identifierTypes: [],
              values: initialFormValues,
              validationSchema: null,
              inEditMode: false,
              setFieldValue: () => {},
              setCapturePhotoProps: (_value) => {},
              setFieldTouched: () => {},
              currentPhoto: '',
              isOffline: false,
              initialFormValues: initialFormValues,
            }}
          >
            <DobField />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    const dateOfBirthInput = screen.getByRole('textbox', { name: /date of birth/i });
    expect(dateOfBirthInput).toBeInTheDocument();
  });

  it('prevents and ignores invalid estimated age values', () => {
    const setFieldValue = vi.fn();

    render(
      <Formik
        initialValues={{ birthdate: '', birthdateEstimated: true, yearsEstimated: 0, monthsEstimated: '' }}
        onSubmit={() => {}}
      >
        <Form>
          <PatientRegistrationContext.Provider
            value={{
              identifierTypes: [],
              values: { ...initialFormValues, birthdateEstimated: true },
              validationSchema: null,
              inEditMode: false,
              setFieldValue,
              setCapturePhotoProps: (_value) => {},
              setFieldTouched: () => {},
              currentPhoto: '',
              isOffline: false,
              initialFormValues: initialFormValues,
            }}
          >
            <DobField />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    const yearsInput = screen.getByRole('spinbutton', { name: /estimated age in years/i });
    expect(yearsInput).toHaveAttribute('max', '140');
    for (const key of ['e', 'E', '+', '-', '.', ',']) {
      expect(fireEvent.keyDown(yearsInput, { key })).toBe(false);
    }
    expect(
      fireEvent.paste(yearsInput, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);

    fireEvent.change(yearsInput, { target: { value: '1e2' } });
    expect(setFieldValue).not.toHaveBeenCalledWith('yearsEstimated', expect.any(Number));

    fireEvent.change(yearsInput, { target: { value: '12' } });
    expect(setFieldValue).toHaveBeenCalledWith('yearsEstimated', 12);

    fireEvent.change(yearsInput, { target: { value: '140' } });
    expect(setFieldValue).toHaveBeenCalledWith('yearsEstimated', 140);

    setFieldValue.mockClear();
    fireEvent.change(yearsInput, { target: { value: '141' } });
    expect(setFieldValue).not.toHaveBeenCalledWith('yearsEstimated', expect.any(Number));

    const monthsInput = screen.getByRole('spinbutton', { name: /estimated age in months/i });
    expect(monthsInput).toHaveAttribute('max', '11');
    fireEvent.change(monthsInput, { target: { value: '11' } });
    expect(setFieldValue).toHaveBeenCalledWith('monthsEstimated', 11);

    setFieldValue.mockClear();
    fireEvent.change(monthsInput, { target: { value: '12' } });
    expect(setFieldValue).not.toHaveBeenCalledWith('monthsEstimated', expect.any(Number));
  });
});
