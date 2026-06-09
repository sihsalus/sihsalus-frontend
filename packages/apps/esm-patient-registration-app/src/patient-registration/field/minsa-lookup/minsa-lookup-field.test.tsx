import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import { peruDniPatientIdentifierTypeUuid } from '../../peru-registration-config';
import { MinsaLookupField } from './minsa-lookup-field.component';

function buildFormValues(identifierValue = '12345678') {
  return {
    additionalFamilyName: '',
    additionalFamilyName2: '',
    additionalGivenName: '',
    additionalMiddleName: '',
    addNameInLocalLanguage: false,
    address: {},
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

const baseValues = buildFormValues();

function renderMinsaLookup(values: FormValues = baseValues) {
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
        <PatientRegistrationContext.Provider value={contextValues}>
          <MinsaLookupField />
        </PatientRegistrationContext.Provider>
      </Form>
    </Formik>,
  );

  return { setFieldTouched, setFieldValue };
}

describe('MinsaLookupField', () => {
  it('loads mock MINSA data into the registration form', async () => {
    const user = userEvent.setup();
    const { setFieldTouched, setFieldValue } = renderMinsaLookup();

    await user.click(screen.getByRole('button', { name: /buscar en minsa/i }));

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Juan', false));

    expect(setFieldValue).toHaveBeenCalledWith('middleName', 'Carlos', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Perez', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName2', 'Garcia', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'male', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthdateEstimated', false, false);
    expect(setFieldValue).toHaveBeenCalledWith('yearsEstimated', 0, false);
    expect(setFieldValue).toHaveBeenCalledWith('monthsEstimated', '', false);
    expect(setFieldTouched).toHaveBeenCalledWith('givenName', true, false);
    expect(screen.getByText('Datos MINSA cargados')).toBeInTheDocument();

    const birthdateCall = setFieldValue.mock.calls.find(([fieldName]) => fieldName === 'birthdate');
    expect(birthdateCall?.[1]).toEqual(new Date(1990, 4, 14));
  });

  it('validates the DNI before searching', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderMinsaLookup(buildFormValues('123'));

    await user.click(screen.getByRole('button', { name: /buscar en minsa/i }));

    expect(screen.getByText('El DNI debe tener 8 dígitos')).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('does not modify the form when the mock has no matching DNI', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderMinsaLookup(buildFormValues('11111111'));

    await user.click(screen.getByRole('button', { name: /buscar en minsa/i }));

    await waitFor(() => expect(screen.getByText('No se encontraron datos MINSA')).toBeInTheDocument());
    expect(setFieldValue).not.toHaveBeenCalled();
  });
});
