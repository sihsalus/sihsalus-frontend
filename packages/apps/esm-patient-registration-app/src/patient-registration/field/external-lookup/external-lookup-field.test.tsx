import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import type React from 'react';

import {
  identityVerificationSourceConceptUuids,
  identityVerificationStatusConceptUuids,
  personIdentityVerificationSourceAttributeTypeUuid,
  personIdentityVerificationStatusAttributeTypeUuid,
} from '../../identity/identity-documents';
import { fetchPersonForPromotion, searchLocalIdentityByDocument } from '../../identity/identity-search.resource';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruDniPatientIdentifierTypeUuid,
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
} from '../../peru-registration-config';
import { IdentityLookupField } from './identity-lookup-field.component';
import { SisLookupField } from './sis-lookup-field.component';

vi.mock('../../identity/identity-search.resource', () => ({
  searchLocalIdentityByDocument: vi.fn(),
  fetchPersonForPromotion: vi.fn(),
}));

const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);
const mockFetchPersonForPromotion = vi.mocked(fetchPersonForPromotion);

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

const lookupButtonName = /buscar en base local y reniec/i;

describe('IdentityLookupField', () => {
  beforeEach(() => {
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
  });

  it('warns and offers opening the patient when the document belongs to an existing patient', async () => {
    const user = userEvent.setup();
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'patient-uuid',
        display: 'Maria Quispe',
        identifier: '12345678',
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      },
    ]);
    const { setFieldValue } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    await waitFor(() =>
      expect(screen.getByText(/ya existe un paciente con este documento/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /abrir paciente existente/i })).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('offers promotion and hydrates the form when the document belongs to a non-patient person', async () => {
    const user = userEvent.setup();
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'person',
        uuid: 'person-uuid',
        display: 'Rosa Flores',
        documentNumber: '12345678',
      },
    ]);
    mockFetchPersonForPromotion.mockResolvedValue({
      uuid: 'person-uuid',
      display: 'Rosa Flores',
      gender: 'F',
      birthdate: '1986-01-01',
      birthdateEstimated: false,
      names: [{ uuid: 'name-uuid', preferred: true, givenName: 'Rosa', familyName: 'Flores' }],
      addresses: [],
      attributes: [],
    });
    const { setFieldValue } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    await waitFor(() =>
      expect(screen.getByText(/existe una persona registrada \(no paciente\)/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /registrar como paciente/i }));

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('patientUuid', 'person-uuid', false));
    expect(setFieldValue).toHaveBeenCalledWith('personUuidToPromote', 'person-uuid', false);
    expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Rosa', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Flores', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'female', false);
  });

  it('falls back to RENIEC and marks the identity as verified when there are no local matches', async () => {
    const user = userEvent.setup();
    const { setFieldTouched, setFieldValue } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Juan', false));

    expect(setFieldValue).toHaveBeenCalledWith('middleName', 'Carlos', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Perez', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName2', 'Garcia', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'male', false);
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${personIdentityVerificationStatusAttributeTypeUuid}`,
      identityVerificationStatusConceptUuids.verifiedByReniec,
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${personIdentityVerificationSourceAttributeTypeUuid}`,
      identityVerificationSourceConceptUuids.reniec,
      false,
    );
    expect(setFieldTouched).toHaveBeenCalledWith('givenName', true, false);
    expect(screen.getByText('Datos RENIEC cargados')).toBeInTheDocument();

    const birthdateCall = setFieldValue.mock.calls.find(([fieldName]) => fieldName === 'birthdate');
    expect(birthdateCall?.[1]).toEqual(new Date(1990, 4, 14));
  });

  it('validates the document number before searching', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderLookup(<IdentityLookupField />, buildFormValues('123'));

    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    expect(screen.getByText(/no tiene el formato esperado/i)).toBeInTheDocument();
    expect(mockSearchLocalIdentityByDocument).not.toHaveBeenCalled();
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('asks for manual registration when there are no local matches and RENIEC has no data', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderLookup(<IdentityLookupField />, buildFormValues('11111111'));

    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    await waitFor(() =>
      expect(screen.getByText(/sin coincidencias locales ni datos reniec/i)).toBeInTheDocument(),
    );
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
