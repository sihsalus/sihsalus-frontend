import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';
import { FormManager } from '../../form-manager';
import { initialFormValues } from '../../patient-registration.component';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { getValidationSchema } from '../../validation/patient-registration-validation';

import { calcBirthdate, DobField } from './dob.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

describe('Dob', () => {
  it.each([
    ['30', '', 30, 0],
    ['', '6', 0, 6],
    ['2', '3', 2, 3],
    ['0', '0', 0, 0],
    ['', '', 0, 0],
  ])('submits estimated age %s years and %s months through Formik', async (years, months, expectedYears, expectedMonths) => {
    const config = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
    config.fieldConfigurations.dateOfBirth.useEstimatedDateOfBirth.enabled = false;
    mockUseConfig.mockReturnValue(config);
    const onSubmit = vi.fn();
    const { birthdate, yearsEstimated, monthsEstimated } = getValidationSchema(config, []).fields;
    render(
      <Formik
        initialValues={{
          ...initialFormValues,
          birthdate: '',
          birthdateEstimated: false,
          yearsEstimated: 0,
          monthsEstimated: 0,
        }}
        validationSchema={Yup.object({ birthdate, yearsEstimated, monthsEstimated })}
        onSubmit={onSubmit}
      >
        {(formik) => (
          <Form noValidate>
            <PatientRegistrationContext.Provider
              value={{
                identifierTypes: [],
                values: formik.values,
                validationSchema: null,
                inEditMode: false,
                setFieldValue: formik.setFieldValue,
                setFieldTouched: formik.setFieldTouched,
                setCapturePhotoProps: () => {},
                currentPhoto: '',
                isOffline: false,
                initialFormValues,
              }}
            >
              <DobField />
            </PatientRegistrationContext.Provider>
            <button type="submit">Submit age</button>
            <output data-testid="age-errors">{JSON.stringify(formik.errors)}</output>
          </Form>
        )}
      </Formik>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /no/i }));
    // Populate, then replace/clear both inputs to catch stale derived birthdates.
    const yearsInput = screen.getByRole('spinbutton', { name: /years/i });
    const monthsInput = screen.getByRole('spinbutton', { name: /months/i });
    fireEvent.change(yearsInput, { target: { value: '40' } });
    fireEvent.change(monthsInput, { target: { value: '9' } });
    fireEvent.change(yearsInput, { target: { value: years } });
    fireEvent.change(monthsInput, { target: { value: months } });
    fireEvent.blur(monthsInput);
    fireEvent.click(screen.getByRole('button', { name: 'Submit age' }));
    if (!years && !months) {
      await waitFor(() => expect(screen.getByTestId('age-errors')).toHaveTextContent('yearsEstimateRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
      return;
    }
    await waitFor(() => expect(screen.getByTestId('age-errors')).toHaveTextContent('{}'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        birthdateEstimated: true,
        birthdate: calcBirthdate(expectedYears, expectedMonths, config.fieldConfigurations.dateOfBirth),
      }),
    );
    const values = onSubmit.mock.calls[0][0];
    const patient = FormManager.getPatientToCreate(true, values, {}, {}, [], config);
    expect(patient.person.birthdateEstimated).toBe(true);
    const date = values.birthdate as Date;
    expect(patient.person.birthdate).toBe(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    );
  });
  it('does not invent a newborn age when both estimated fields are empty', () => {
    const config = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
    expect(calcBirthdate('', '', config.fieldConfigurations.dateOfBirth)).toBeNull();
  });
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

  it('starts estimated age empty and marks only years as required', () => {
    const setFieldValue = vi.fn();

    render(
      <Formik
        initialValues={{ birthdate: '', birthdateEstimated: false, yearsEstimated: 0, monthsEstimated: 0 }}
        onSubmit={() => {}}
      >
        <Form>
          <PatientRegistrationContext.Provider
            value={{
              identifierTypes: [],
              values: initialFormValues,
              validationSchema: null,
              inEditMode: false,
              setFieldValue,
              setCapturePhotoProps: (_value) => {},
              setFieldTouched: () => {},
              currentPhoto: '',
              isOffline: false,
              initialFormValues,
            }}
          >
            <DobField />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /no/i }));

    expect(setFieldValue).toHaveBeenCalledWith('yearsEstimated', '');
    expect(setFieldValue).toHaveBeenCalledWith('monthsEstimated', '');
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
