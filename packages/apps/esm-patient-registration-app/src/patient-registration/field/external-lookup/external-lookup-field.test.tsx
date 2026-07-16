import { navigate, useFeatureFlag } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import type React from 'react';

import {
  identityVerificationSourceConceptUuids,
  identityVerificationStatusConceptUuids,
  personIdentityVerificationSourceAttributeTypeUuid,
  personIdentityVerificationStatusAttributeTypeUuid,
} from '../../identity/identity-documents';
import {
  fetchPersonForPromotion,
  type LocalPatientIdentityMatch,
  type LocalPersonIdentityMatch,
  searchLocalIdentityByDocument,
} from '../../identity/identity-search.resource';
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
import { lookupReniecIdentityByDni } from './reniec-lookup.resource';
import { lookupSisInsuranceByDni } from './sis-lookup.resource';
import { SisLookupField } from './sis-lookup-field.component';

vi.mock('../../identity/identity-search.resource', () => ({
  searchLocalIdentityByDocument: vi.fn(),
  fetchPersonForPromotion: vi.fn(),
}));

const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);
const mockFetchPersonForPromotion = vi.mocked(fetchPersonForPromotion);
const mockNavigate = vi.mocked(navigate);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
  const renderTree = (currentValues: FormValues) => {
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
      values: currentValues,
    } as unknown as PatientRegistrationContextProps;

    return (
      <Formik initialValues={{}} onSubmit={vi.fn()}>
        <Form>
          <PatientRegistrationContext.Provider value={contextValues}>{component}</PatientRegistrationContext.Provider>
        </Form>
      </Formik>
    );
  };

  const rendered = render(renderTree(values));

  return {
    rerenderValues: (nextValues: FormValues) => rendered.rerender(renderTree(nextValues)),
    setFieldTouched,
    setFieldValue,
  };
}

const lookupButtonName = /buscar en base local y reniec/i;

beforeEach(() => {
  globalThis.spaEnv = 'development';
  mockUseFeatureFlag.mockReturnValue(true);
});

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

    await waitFor(() => expect(screen.getByText(/ya existe un paciente con este documento/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /abrir paciente existente/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: `\${openmrsSpaBase}/patient/patient-uuid/chart`,
      }),
    );
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2);
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

    await waitFor(() => expect(screen.getByText(/existe una persona registrada \(no paciente\)/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /registrar como paciente/i }));

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('patientUuid', 'person-uuid', false));
    expect(setFieldValue).toHaveBeenCalledWith('personUuidToPromote', 'person-uuid', false);
    expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Rosa', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Flores', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'female', false);
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2);
  });

  it('keeps every lookup action busy while promotion is being revalidated', async () => {
    const user = userEvent.setup();
    const promotionRevalidation = deferred<Array<LocalPatientIdentityMatch | LocalPersonIdentityMatch>>();
    const personMatch: LocalPersonIdentityMatch = {
      kind: 'person',
      uuid: 'person-uuid',
      display: 'Rosa Flores',
      documentNumber: '12345678',
    };
    mockSearchLocalIdentityByDocument
      .mockResolvedValueOnce([personMatch])
      .mockImplementationOnce(() => promotionRevalidation.promise);
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
    const promoteButton = await screen.findByRole('button', { name: /registrar como paciente/i });
    await user.click(promoteButton);

    const lookupButton = screen.getByRole('button', { name: lookupButtonName });
    expect(lookupButton).toBeDisabled();
    expect(promoteButton).toBeDisabled();
    expect(screen.getByText(/cargando persona/i)).toBeInTheDocument();

    await user.click(lookupButton);
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2);
    const activePromotionRequest = mockSearchLocalIdentityByDocument.mock.calls[1][1];
    expect(activePromotionRequest?.signal.aborted).toBe(false);

    await act(async () => {
      promotionRevalidation.resolve([personMatch]);
      await promotionRevalidation.promise;
    });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('personUuidToPromote', 'person-uuid', false));
    expect(lookupButton).toBeEnabled();
    expect(screen.queryByText(/cargando persona/i)).not.toBeInTheDocument();
  });

  it('invalidates a match when the normalized document key changes', async () => {
    const user = userEvent.setup();
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'patient-a',
        display: 'Paciente A',
        identifier: '12345678',
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      },
    ]);
    const { rerenderValues } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));
    await waitFor(() => expect(screen.getByText('Paciente A')).toBeInTheDocument());

    rerenderValues(buildFormValues('87654321'));

    await waitFor(() => expect(screen.queryByText('Paciente A')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /abrir paciente existente/i })).not.toBeInTheDocument();
  });

  it('warns when the document changes while a promotion selection is active', async () => {
    const promotionValues = { ...buildFormValues('12345678'), personUuidToPromote: 'person-uuid' } as FormValues;
    const { rerenderValues } = renderLookup(<IdentityLookupField />, promotionValues);

    rerenderValues({ ...buildFormValues('87654321'), personUuidToPromote: 'person-uuid' } as FormValues);

    await waitFor(() =>
      expect(
        screen.getByText(/el documento cambió después de seleccionar una persona para promover/i),
      ).toBeInTheDocument(),
    );
  });

  it('ignores an older lookup response that resolves after the current document lookup', async () => {
    const user = userEvent.setup();
    const firstLookup = deferred<Array<LocalPatientIdentityMatch>>();
    const secondLookup = deferred<Array<LocalPatientIdentityMatch>>();
    mockSearchLocalIdentityByDocument.mockImplementation((documentNumber) =>
      documentNumber === '12345678' ? firstLookup.promise : secondLookup.promise,
    );
    const { rerenderValues } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));
    rerenderValues(buildFormValues('87654321'));
    await waitFor(() => expect(screen.getByRole('button', { name: lookupButtonName })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: lookupButtonName }));

    await act(async () => {
      secondLookup.resolve([
        {
          kind: 'patient',
          uuid: 'patient-b',
          display: 'Paciente B',
          identifier: '87654321',
          identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
        },
      ]);
      await secondLookup.promise;
    });
    await waitFor(() => expect(screen.getByText('Paciente B')).toBeInTheDocument());

    await act(async () => {
      firstLookup.resolve([
        {
          kind: 'patient',
          uuid: 'patient-a',
          display: 'Paciente A',
          identifier: '12345678',
          identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
        },
      ]);
      await firstLookup.promise;
    });

    expect(screen.getByText('Paciente B')).toBeInTheDocument();
    expect(screen.queryByText('Paciente A')).not.toBeInTheDocument();
  });

  it('revalidates a person and stops promotion when the document now belongs to a patient', async () => {
    const user = userEvent.setup();
    mockSearchLocalIdentityByDocument
      .mockResolvedValueOnce([
        {
          kind: 'person',
          uuid: 'person-uuid',
          display: 'Rosa Flores',
          documentNumber: '12345678',
        },
      ])
      .mockResolvedValueOnce([
        {
          kind: 'patient',
          uuid: 'person-uuid',
          display: 'Rosa Flores',
          identifier: '12345678',
          identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
        },
      ]);
    const { setFieldValue } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: lookupButtonName }));
    await user.click(await screen.findByRole('button', { name: /registrar como paciente/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /abrir paciente existente/i })).toBeInTheDocument());
    expect(mockFetchPersonForPromotion).not.toHaveBeenCalled();
    expect(setFieldValue).not.toHaveBeenCalledWith('personUuidToPromote', expect.anything(), false);
  });

  it('keeps local identity search available while RENIEC is disabled', async () => {
    const user = userEvent.setup();
    mockUseFeatureFlag.mockReturnValue(false);
    const { setFieldValue } = renderLookup(<IdentityLookupField />);

    await user.click(screen.getByRole('button', { name: /buscar en base local$/i }));

    await waitFor(() =>
      expect(screen.getByText(/^sin coincidencias locales\. registre los datos manualmente\.$/i)).toBeInTheDocument(),
    );
    expect(setFieldValue).not.toHaveBeenCalled();
    expect(screen.queryByText(/datos reniec cargados/i)).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText(/sin coincidencias locales ni datos reniec/i)).toBeInTheDocument());
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

describe('synthetic external lookup data', () => {
  it('never returns demo identities or insurance data outside local development', async () => {
    globalThis.spaEnv = 'production';

    await expect(lookupReniecIdentityByDni('12345678')).resolves.toBeNull();
    await expect(lookupSisInsuranceByDni('12345678')).resolves.toBeNull();
  });
});
