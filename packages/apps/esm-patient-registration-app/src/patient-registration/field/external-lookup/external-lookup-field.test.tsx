import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import type React from 'react';

import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruDniPatientIdentifierTypeUuid,
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
} from '../../peru-registration-config';
import { ReniecLookupField } from './reniec-lookup-field.component';
import { SisLookupField } from './sis-lookup-field.component';

function buildFormValues(identifierValue = '12345678') {
  return {
    additionalFamilyName: '',
    additionalFamilyName2: '',
    additionalGivenName: '',
    additionalMiddleName: '',
    addNameInLocalLanguage: false,
    address: {},
    attributes: {},
    birthdate: '',
    birthdateEstimated: false,
    deathCause: '',
    deathDate: '',
    deathTime: '',
    deathTimeFormat: 'AM',
    familyName: '',
    familyName2: '',
    gender: '',
    givenName: '',
    identifiers: {
      dni: {
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
        identifierName: 'DNI',
        identifierValue,
        initialValue: '',
        preferred: false,
        required: true,
        selectedSource: undefined,
      },
    },
    isDead: false,
    middleName: '',
    monthsEstimated: 0,
    nonCodedCauseOfDeath: '',
    patientUuid: '',
    relationships: [],
    telephoneNumber: '',
    yearsEstimated: 0,
  } as FormValues;
}

function renderLookup(component: React.ReactNode, values: FormValues = buildFormValues()) {
  const setFieldValue = vi.fn();
  const setFieldTouched = vi.fn();
  const contextValues = {
    currentPhoto: null,
    identifierTypes: [
      {
        fieldName: 'dni',
        name: 'DNI',
        uuid: peruDniPatientIdentifierTypeUuid,
      },
    ],
    inEditMode: false,
    initialFormValues: values,
    isOffline: false,
    setCapturePhotoProps: vi.fn(),
    setFieldTouched,
    setFieldValue,
    validationSchema: null,
    values,
  } as unknown as PatientRegistrationContextProps;

  render(
    <Formik initialValues={{}} onSubmit={vi.fn()}>
      <Form>
        <PatientRegistrationContext.Provider value={contextValues}>{component}</PatientRegistrationContext.Provider>
      </Form>
    </Formik>,
  );

  return { setFieldTouched, setFieldValue };
}

describe('ReniecLookupField', () => {
  it('loads mock RENIEC data into the registration form', async () => {
    const user = userEvent.setup();
    const { setFieldTouched, setFieldValue } = renderLookup(<ReniecLookupField />);

    await user.click(screen.getByRole('button', { name: /buscar en reniec/i }));

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Juan', false));

    expect(setFieldValue).toHaveBeenCalledWith('middleName', 'Carlos', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Perez', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName2', 'Garcia', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'male', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthdateEstimated', false, false);
    expect(setFieldValue).toHaveBeenCalledWith('yearsEstimated', 0, false);
    expect(setFieldValue).toHaveBeenCalledWith('monthsEstimated', '', false);
    expect(setFieldTouched).toHaveBeenCalledWith('givenName', true, false);
    expect(screen.getByText('Datos RENIEC cargados')).toBeInTheDocument();

    const birthdateCall = setFieldValue.mock.calls.find(([fieldName]) => fieldName === 'birthdate');
    expect(birthdateCall?.[1]).toEqual(new Date(1990, 4, 14));
  });

  it('validates the DNI before searching RENIEC', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderLookup(<ReniecLookupField />, buildFormValues('123'));

    await user.click(screen.getByRole('button', { name: /buscar en reniec/i }));

    expect(screen.getByText('El DNI debe tener 8 dígitos')).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('does not modify the form when the RENIEC mock has no matching DNI', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderLookup(<ReniecLookupField />, buildFormValues('11111111'));

    await user.click(screen.getByRole('button', { name: /buscar en reniec/i }));

    await waitFor(() => expect(screen.getByText('No se encontraron datos RENIEC')).toBeInTheDocument());
    expect(setFieldValue).not.toHaveBeenCalled();
  });
});

describe('SisLookupField', () => {
  it('loads mock SIS accreditation data into insurance fields', async () => {
    const user = userEvent.setup();
    const { setFieldTouched, setFieldValue } = renderLookup(<SisLookupField />);

    await user.click(screen.getByRole('button', { name: /consultar sis/i }));

    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(
        `attributes.${peruInsuranceCodeAttributeTypeUuid}`,
        'SIS-12345678',
        false,
      ),
    );

    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruInsuranceAccreditationStatusAttributeTypeUuid}`,
      peruInsuranceAccreditationActiveConceptUuid,
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`,
      '2026-06-10T09:30:00-05:00',
      false,
    );
    expect(setFieldTouched).toHaveBeenCalledWith(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, true, false);
    expect(screen.getByText('Acreditación SIS vigente cargada')).toBeInTheDocument();
  });

  it('validates the DNI before searching SIS', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderLookup(<SisLookupField />, buildFormValues('123'));

    await user.click(screen.getByRole('button', { name: /consultar sis/i }));

    expect(screen.getByText('El DNI debe tener 8 dígitos')).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
  });
});
