import {
  type FetchResponse,
  getUserFacingErrorMessage,
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactNode } from 'react';
import { BrowserRouter as Router, useParams } from 'react-router-dom';
import { mockedAddressTemplate, mockIdentifierTypes, mockOpenmrsId, mockPatient } from 'test-utils';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import { type Resources, ResourcesContext } from '../offline.resources';

import { FormManager, SavePatientTransactionManager } from './form-manager';
import { searchLocalIdentityByDocument } from './identity/identity-search.resource';
import {
  getPatientRegistrationFieldLabel,
  hasMedicalRecordArchivistRole,
  initialFormValues,
  PatientRegistration,
  preserveMedicalRecordAttributes,
} from './patient-registration.component';
import { generateIdentifier, saveEncounter, savePatient } from './patient-registration.resource';
import type { AddressTemplate, Encounter, FormValues } from './patient-registration.types';
import { useInitialFormValues } from './patient-registration-hooks';
import { peruDniPatientIdentifierTypeUuid, peruPassportPatientIdentifierTypeUuid } from './peru-registration-config';
import { RegistrationDomainError, registrationErrorCodes } from './registration-errors';

const mockSaveEncounter = vi.mocked(saveEncounter);
const mockGenerateIdentifier = vi.mocked(generateIdentifier);
const mockSavePatient = savePatient as vi.Mock;
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockUsePatient = vi.mocked(usePatient);
const mockUseParams = useParams as vi.Mock;
const mockUseInitialFormValues = vi.mocked(useInitialFormValues);
const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);

vi.mock('./field/field.resource', async () => ({
  useConcept: vi.fn().mockImplementation((uuid: string) => {
    let data;
    if (uuid === 'weight-uuid') {
      data = {
        uuid: 'weight-uuid',
        display: 'Weight (kg)',
        datatype: { display: 'Numeric', uuid: 'num' },
        answers: [],
        setMembers: [],
      };
    } else if (uuid === 'chief-complaint-uuid') {
      data = {
        uuid: 'chief-complaint-uuid',
        display: 'Chief Complaint',
        datatype: { display: 'Text', uuid: 'txt' },
        answers: [],
        setMembers: [],
      };
    } else if (uuid === 'nationality-uuid') {
      data = {
        uuid: 'nationality-uuid',
        display: 'Nationality',
        datatype: { display: 'Coded', uuid: 'cdd' },
        answers: [
          { display: 'USA', uuid: 'usa' },
          { display: 'Mexico', uuid: 'mex' },
        ],
        setMembers: [],
      };
    }
    return {
      data: data ?? null,
      isLoading: !data,
    };
  }),
  useConceptAnswers: vi.fn().mockImplementation((uuid: string) => {
    if (uuid === 'nationality-uuid') {
      return {
        data: [
          { display: 'USA', uuid: 'usa' },
          { display: 'Mexico', uuid: 'mex' },
        ],
        isLoading: false,
      };
    } else if (uuid === 'other-countries-uuid') {
      return {
        data: [
          { display: 'Kenya', uuid: 'ke' },
          { display: 'Uganda', uuid: 'ug' },
        ],
        isLoading: false,
      };
    }
  }),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useLocation: () => ({
    pathname: 'openmrs/spa/patient-registration',
  }),
  useHistory: () => [],
  useParams: vi.fn().mockReturnValue({ patientUuid: undefined }),
}));

vi.mock('./patient-registration.resource', async () => ({
  ...(await vi.importActual('./patient-registration.resource')),
  generateIdentifier: vi.fn(),
  saveEncounter: vi.fn(),
  savePatient: vi.fn(),
}));

vi.mock('./identity/identity-search.resource', async () => ({
  ...(await vi.importActual('./identity/identity-search.resource')),
  searchLocalIdentityByDocument: vi.fn(),
}));

vi.mock('./patient-registration-hooks', async () => ({
  ...(await vi.importActual('./patient-registration-hooks')),
  useInitialFormValues: vi.fn().mockReturnValue([{}, vi.fn()]),
  useInitialAddressFieldValues: vi.fn().mockReturnValue([{}, vi.fn()]),
  usePatientUuidMap: vi.fn().mockReturnValue([{}, vi.fn()]),
}));

const mockResourcesContextValue: Resources = {
  addressTemplate: mockedAddressTemplate as AddressTemplate,
  currentSession: {
    authenticated: true,
    sessionId: 'JSESSION',
    currentProvider: { uuid: 'provider-uuid', identifier: 'PRO-123' },
    sessionLocation: { uuid: 'location-uuid', display: 'Test location', links: [] },
  },
  relationshipTypes: [],
  identifierTypes: mockIdentifierTypes,
};

const mockOpenmrsConfig: RegistrationConfig = {
  sections: ['demographics', 'contact'],
  sectionDefinitions: [
    { id: 'demographics', name: 'Demographics', fields: ['name', 'gender', 'dob'] },
    { id: 'contact', name: 'Contact Info', fields: ['address'] },
    { id: 'relationships', name: 'Relationships', fields: ['relationship'] },
  ],
  fieldDefinitions: [],
  fieldConfigurations: {
    phone: {
      personAttributeUuid: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
    },
    dateOfBirth: {
      allowEstimatedDateOfBirth: true,
      useEstimatedDateOfBirth: {
        enabled: true,
        dayOfMonth: new Date().getDay(),
        month: new Date().getMonth(),
      },
    },
    name: {
      displayMiddleName: true,
      allowUnidentifiedPatients: true,
      defaultUnknownGivenName: 'UNKNOWN',
      defaultUnknownFamilyName: 'UNKNOWN',
      defaultUnknownFamilyName2: 'UNKNOWN',
      unidentifiedPatientAttributeTypeUuid: 'unidentified-patient-attribute-type-uuid',
      displayReverseFieldOrder: false,
      displayCapturePhoto: true,
      requireFamilyName2: false,
    },
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
    address: {
      useAddressHierarchy: {
        enabled: true,
        useQuickSearch: true,
        searchAddressByLevel: true,
      },
    },
    causeOfDeath: {
      conceptUuid: 'cause-of-death-concept-uuid',
    },
  },
  links: {
    submitButton: '#',
  },
  defaultPatientIdentifierTypes: [],
  hiddenPatientIdentifierTypeUuids: [],
  registrationObs: {
    encounterTypeUuid: null,
    encounterProviderRoleUuid: 'asdf',
    registrationFormUuid: null,
  },
  freeTextFieldConceptUuid: '',
};
const configWithObs = JSON.parse(JSON.stringify(mockOpenmrsConfig));

configWithObs.fieldDefinitions = [
  {
    id: 'weight',
    type: 'obs',
    label: null,
    uuid: 'weight-uuid',
    placeholder: '',
    validation: { required: false, matches: null },
    answerConceptSetUuid: null,
    customConceptAnswers: [],
  },
  {
    id: 'chief complaint',
    type: 'obs',
    label: null,
    uuid: 'chief-complaint-uuid',
    placeholder: '',
    validation: { required: false, matches: null },
    answerConceptSetUuid: null,
    customConceptAnswers: [],
  },
  {
    // NB: must not be 'nationality' — that field id is special-cased in
    // custom-field.component.tsx to render the Peru person-attribute field.
    id: 'nationalityObs',
    type: 'obs',
    label: null,
    uuid: 'nationality-uuid',
    placeholder: '',
    validation: { required: false, matches: null },
    answerConceptSetUuid: null,
    customConceptAnswers: [],
  },
];
configWithObs.sectionDefinitions?.push({
  id: 'custom',
  name: 'Custom',
  fields: ['weight', 'chief complaint', 'nationalityObs'],
});
configWithObs.sections.push('custom');
configWithObs.registrationObs.encounterTypeUuid = 'reg-enc-uuid';
configWithObs.registrationObs.registrationFormUuid = 'reg-form-uuid';

const fillRequiredFields = async () => {
  const user = userEvent.setup();

  const demographicsSection = await screen.findByLabelText('Demographics Section');
  const givenNameInput = within(demographicsSection).getByLabelText(/first name/i) as HTMLInputElement;
  const familyNameInput = within(demographicsSection).getByLabelText(/^family name$/i) as HTMLInputElement;
  const familyName2Input = within(demographicsSection).getByLabelText(/second family name/i) as HTMLInputElement;
  const dateInput = within(demographicsSection).getByRole('textbox', { name: /date of birth/i }) as HTMLInputElement;
  const genderInput = within(demographicsSection).getByRole('radio', { name: /^male$/i }) as HTMLInputElement;
  await user.type(givenNameInput, 'Paul');
  await user.type(familyNameInput, 'Gaihre');
  await user.type(familyName2Input, 'Materno');
  fireEvent.change(dateInput, { target: { value: '1993-08-02' } });
  await user.click(genderInput);
};

const Wrapper = ({ children }) => (
  <ResourcesContext.Provider value={mockResourcesContextValue}>
    <Router>{children}</Router>
  </ResourcesContext.Provider>
);

const getReactText = (node: ReactNode): string => {
  if (!node) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return `${node}`;
  }

  if (Array.isArray(node)) {
    return node.map(getReactText).join(' ');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getReactText(node.props.children);
  }

  return '';
};

beforeEach(() => {
  mockResourcesContextValue.addressTemplate = mockedAddressTemplate as AddressTemplate;
  mockResourcesContextValue.addressTemplateError = undefined;
  mockResourcesContextValue.isLoadingAddressTemplate = false;
  mockResourcesContextValue.identifierTypes = mockIdentifierTypes;
  mockResourcesContextValue.identifierTypesError = undefined;
  mockResourcesContextValue.isLoadingIdentifierTypes = false;
  mockResourcesContextValue.relationshipTypes = [];
  mockResourcesContextValue.relationshipTypesError = undefined;
  mockResourcesContextValue.isLoadingRelationshipTypes = false;
  mockResourcesContextValue.currentSession.sessionLocation = {
    uuid: 'location-uuid',
    display: 'Test location',
    links: [],
  };
  mockResourcesContextValue.currentSession.user = undefined;
  mockGetUserFacingErrorMessage.mockImplementation((error, fallback, options) => {
    const errorRecord = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : undefined;
    const code = errorRecord?.code;
    const status = errorRecord?.status;

    if ((typeof code === 'string' || typeof code === 'number') && options?.codeMessages?.[code]) {
      return options.codeMessages[code];
    }
    if ((typeof status === 'string' || typeof status === 'number') && options?.statusMessages?.[status]) {
      return options.statusMessages[status];
    }
    return fallback;
  });
});

describe('medical record access', () => {
  it('recognizes the temporary archivist role regardless of accents and casing', () => {
    expect(hasMedicalRecordArchivistRole({ roles: [{ name: 'Archivador de Historias Clínicas' }] })).toBe(true);
    expect(hasMedicalRecordArchivistRole({ roles: [{ display: 'ARCHIVADOR DE HISTORIAS CLINICAS' }] })).toBe(true);
    expect(hasMedicalRecordArchivistRole({ roles: [{ name: 'Admisión' }] })).toBe(false);
    expect(hasMedicalRecordArchivistRole()).toBe(false);
  });

  it('preserves existing protected attributes and removes injected values without access', () => {
    expect(
      preserveMedicalRecordAttributes(
        { status: 'changed', archiveType: 'injected', other: 'updated' },
        { status: 'original', other: 'original' },
        ['status', 'archiveType'],
        false,
      ),
    ).toEqual({ status: 'original', other: 'updated' });
  });

  it('allows protected attributes to change with access', () => {
    expect(preserveMedicalRecordAttributes({ status: 'changed' }, { status: 'original' }, ['status'], true)).toEqual({
      status: 'changed',
    });
  });
});

describe('Registering a new patient', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      ...mockOpenmrsConfig,
    });
    mockUseInitialFormValues.mockReturnValue([
      {
        patientUuid: 'new-patient-uuid',
        givenName: '',
        middleName: '',
        familyName: '',
        familyName2: '',
        additionalGivenName: '',
        additionalMiddleName: '',
        additionalFamilyName: '',
        additionalFamilyName2: '',
        addNameInLocalLanguage: false,
        gender: '',
        birthdate: null,
        yearsEstimated: 0,
        monthsEstimated: 0,
        birthdateEstimated: false,
        telephoneNumber: '',
        isDead: false,
        deathDate: undefined,
        deathTime: undefined,
        deathTimeFormat: 'AM',
        deathCause: '',
        nonCodedCauseOfDeath: '',
        relationships: [],
        identifiers: {},
        address: {},
      } as unknown as FormValues,
      vi.fn(),
      { isLoading: false },
    ]);
    mockGenerateIdentifier.mockResolvedValue({ data: { identifier: '100NEW' }, ok: true } as unknown as FetchResponse);
    mockSavePatient.mockReturnValue({ data: { uuid: 'new-pt-uuid' }, ok: true });
  });

  it('should render all the required fields and sections', async () => {
    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByRole('heading', { name: /create new patient/i });

    const demographicSection = screen.getByRole('region', { name: /demographics section/i });
    const contactSection = screen.getByRole('region', { name: /contact info section/i });

    expect(demographicSection).toBeInTheDocument();
    expect(contactSection).toBeInTheDocument();
    expect(screen.getByText(/jump to/i)).toBeInTheDocument();
    expect(within(demographicSection).getByLabelText(/first name/i)).toBeInTheDocument();
    expect(within(demographicSection).getByLabelText(/first name/i)).not.toHaveAttribute('required');
    expect(within(demographicSection).getByLabelText(/first name/i)).toHaveAttribute('aria-required', 'true');
    expect(within(demographicSection).getByLabelText(/middle name \(optional\)/i)).toBeInTheDocument();
    expect(within(demographicSection).getByLabelText(/^family name$/i)).toBeInTheDocument();
    expect(within(demographicSection).getByRole('textbox', { name: /date of birth/i })).toBeInTheDocument();
    expect(within(demographicSection).getByRole('radio', { name: /^male$/i })).toBeInTheDocument();
    expect(within(demographicSection).getByRole('radio', { name: /^female$/i })).toBeInTheDocument();
    expect(within(demographicSection).getByText(/date of birth known\?/i)).toBeInTheDocument();

    expect(within(contactSection).getByRole('heading', { name: /address/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /register patient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register patient/i })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(document.querySelector('form')).toHaveAttribute('novalidate');
  });

  it('blocks registration before data entry when the session has no location', async () => {
    mockResourcesContextValue.currentSession.sessionLocation = undefined;

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    expect(await screen.findByText(/select a session location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register patient/i })).toBeDisabled();
  });

  it('does not show the medical record section while creating a patient, even for an archivist', async () => {
    mockResourcesContextValue.currentSession.user = {
      roles: [{ name: 'Archivador de Historias Clínicas' }],
    } as never;

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByRole('heading', { name: /create new patient/i });
    expect(screen.queryByText(/medical record|historia clínica/i)).not.toBeInTheDocument();
  });

  it('saves the patient without extra info', async () => {
    const user = userEvent.setup();

    render(<PatientRegistration isOffline={false} savePatientForm={FormManager.savePatientFormOnline} />, {
      wrapper: Wrapper,
    });

    await fillRequiredFields();
    await user.click(await screen.findByText(/Register Patient/i));
    await waitFor(() => expect(mockSavePatient).toHaveBeenCalled());
    expect(mockSavePatient).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: expect.arrayContaining([
          expect.objectContaining({
            identifier: '100NEW',
            identifierType: '05a29f94-c0ed-11e2-94be-8c13b969e334',
            preferred: true,
          }),
        ]),
        person: {
          addresses: expect.arrayContaining([expect.any(Object)]),
          attributes: [],
          birthdate: '1993-08-02',
          birthdateEstimated: false,
          gender: expect.stringMatching(/^M$/),
          names: [
            {
              givenName: 'Paul',
              middleName: '',
              familyName: 'Gaihre',
              familyName2: 'Materno',
              preferred: true,
              uuid: undefined,
            },
          ],
          dead: false,
          uuid: expect.anything(),
        },
        uuid: expect.anything(),
      }),
      undefined,
      expect.anything(),
    );
  });

  it('does not rerun duplicate detection after a patient was partially saved', async () => {
    const user = userEvent.setup();
    const dniType = {
      fieldName: 'dni',
      format: '^[0-9]{8}$',
      isPrimary: false,
      name: 'DNI',
      required: false,
      uniquenessBehavior: 'UNIQUE' as const,
      uuid: peruDniPatientIdentifierTypeUuid,
      identifierSources: [],
    };
    mockResourcesContextValue.identifierTypes = [...mockIdentifierTypes, dniType];
    mockUseInitialFormValues.mockReturnValue([
      {
        patientUuid: 'new-patient-uuid',
        givenName: '',
        middleName: '',
        familyName: '',
        familyName2: '',
        additionalGivenName: '',
        additionalMiddleName: '',
        additionalFamilyName: '',
        additionalFamilyName2: '',
        addNameInLocalLanguage: false,
        gender: '',
        birthdate: null,
        yearsEstimated: 0,
        monthsEstimated: 0,
        birthdateEstimated: false,
        telephoneNumber: '',
        isDead: false,
        deathDate: undefined,
        deathTime: undefined,
        deathTimeFormat: 'AM',
        deathCause: '',
        nonCodedCauseOfDeath: '',
        relationships: [],
        identifiers: {
          dni: {
            autoGeneration: false,
            identifierName: 'DNI',
            identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
            identifierValue: '12345678',
            initialValue: '',
            preferred: false,
            required: false,
            selectedSource: null,
          },
        },
        address: {},
      } as unknown as FormValues,
      vi.fn(),
      { isLoading: false },
    ]);
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
    const savePatientForm = vi.fn(async (...args) => {
      const transaction = args[9] as SavePatientTransactionManager;
      if (savePatientForm.mock.calls.length === 1) {
        transaction.patientSaved = true;
        throw { responseBody: { error: { message: 'relationship failed' } } };
      }
      return 'new-patient-uuid';
    });

    render(<PatientRegistration isOffline={false} savePatientForm={savePatientForm} />, { wrapper: Wrapper });
    await fillRequiredFields();
    const registerButton = screen.getByRole('button', { name: /register patient/i });

    await user.click(registerButton);
    await waitFor(() => expect(savePatientForm).toHaveBeenCalledTimes(1));
    await user.click(registerButton);
    await waitFor(() => expect(savePatientForm).toHaveBeenCalledTimes(2));

    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(1);
  });

  it('checks every civil document and offers the existing patient when any document is duplicated', async () => {
    const user = userEvent.setup();
    const passportType = {
      fieldName: 'passport',
      format: '^[A-Za-z0-9-]{6,20}$',
      identifierSources: [],
      isPrimary: false,
      name: 'Passport',
      required: false,
      uniquenessBehavior: 'UNIQUE' as const,
      uuid: peruPassportPatientIdentifierTypeUuid,
    };
    const dniType = {
      ...passportType,
      fieldName: 'dni',
      format: '^[0-9]{8}$',
      name: 'DNI',
      uuid: peruDniPatientIdentifierTypeUuid,
    };
    mockResourcesContextValue.identifierTypes = [...mockIdentifierTypes, dniType, passportType];
    mockUseInitialFormValues.mockReturnValue([
      {
        ...initialFormValues,
        patientUuid: 'new-patient-uuid',
        identifiers: {
          dni: {
            identifierName: 'DNI',
            identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
            identifierValue: '12345678',
            preferred: false,
            required: true,
          },
          passport: {
            identifierName: 'Passport',
            identifierTypeUuid: peruPassportPatientIdentifierTypeUuid,
            identifierValue: 'PA123456',
            preferred: false,
            required: false,
          },
        },
      } as unknown as FormValues,
      vi.fn(),
      { isLoading: false },
    ]);
    mockSearchLocalIdentityByDocument
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ kind: 'patient', uuid: 'existing-patient', display: 'Existing Patient' }]);
    const savePatientForm = vi.fn();

    render(<PatientRegistration isOffline={false} savePatientForm={savePatientForm} />, { wrapper: Wrapper });
    await fillRequiredFields();
    await user.click(screen.getByRole('button', { name: /register patient/i }));

    await waitFor(() => expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2));
    expect(mockSearchLocalIdentityByDocument).toHaveBeenNthCalledWith(
      1,
      '12345678',
      expect.any(AbortController),
      expect.objectContaining({ patientIdentifierTypeUuid: peruDniPatientIdentifierTypeUuid }),
    );
    expect(mockSearchLocalIdentityByDocument).toHaveBeenNthCalledWith(
      2,
      'PA123456',
      expect.any(AbortController),
      expect.objectContaining({ patientIdentifierTypeUuid: peruPassportPatientIdentifierTypeUuid }),
    );
    expect(savePatientForm).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        actionButtonLabel: 'Open existing patient',
        kind: 'error',
        onActionButtonClick: expect.any(Function),
        subtitle: 'A patient already exists with this document. Find the existing patient before registering a new one.',
      }),
    );
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        code: registrationErrorCodes.duplicatePatientDocument,
        existingPatientUuid: 'existing-patient',
      }),
      'The patient could not be saved. Please try again.',
      expect.objectContaining({
        codeMessages: expect.objectContaining({
          [registrationErrorCodes.duplicatePatientDocument]:
            'A patient already exists with this document. Find the existing patient before registering a new one.',
        }),
      }),
    );
  });

  it('maps a domain error through the central normalizer without exposing identity verification details', async () => {
    const user = userEvent.setup();
    const technicalObservation = 'RENIEC: apellido materno no coincide (valor recibido: SECRETO)';
    const domainError = new RegistrationDomainError(
      registrationErrorCodes.identityVerificationMismatch,
      technicalObservation,
      { technicalDetails: { observation: technicalObservation } },
    );
    const savePatientForm = vi.fn().mockRejectedValue(domainError);

    render(<PatientRegistration isOffline={false} savePatientForm={savePatientForm} />, { wrapper: Wrapper });
    await fillRequiredFields();
    await user.click(screen.getByRole('button', { name: /register patient/i }));

    await waitFor(() => expect(savePatientForm).toHaveBeenCalled());
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          "The person's information does not match the identity verification source. Resolve the discrepancy before promoting them.",
      }),
    );
    const errorSnackbar = mockShowSnackbar.mock.calls.find(([snackbar]) => snackbar.kind === 'error')?.[0];
    expect(errorSnackbar?.subtitle).not.toContain('SECRETO');
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      domainError,
      'The patient could not be saved. Please try again.',
      expect.objectContaining({
        codeMessages: expect.objectContaining({
          [registrationErrorCodes.identityVerificationMismatch]:
            "The person's information does not match the identity verification source. Resolve the discrepancy before promoting them.",
        }),
        logContext: 'Patient registration submission failed',
      }),
    );
  });

  it('should not save the patient if validation fails', async () => {
    const user = userEvent.setup();
    const mockSavePatientForm = vi.fn();
    mockResourcesContextValue.identifierTypes = [
      ...mockIdentifierTypes,
      {
        fieldName: 'dni',
        format: '^[0-9]{8}$',
        identifierSources: [],
        isPrimary: false,
        name: 'DNI',
        required: false,
        uniquenessBehavior: 'UNIQUE',
        uuid: peruDniPatientIdentifierTypeUuid,
      },
    ];

    render(<PatientRegistration isOffline={false} savePatientForm={mockSavePatientForm} />, { wrapper: Wrapper });

    await screen.findByRole('heading', { name: /create new patient/i });
    await screen.findByRole('textbox', { name: 'DNI' });
    await user.click(screen.getByRole('button', { name: /register patient/i }));

    expect(mockSavePatientForm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          title: 'The following fields have errors:',
        }),
      );
    });
    const warningSnackbar = mockShowSnackbar.mock.calls.find(([snackbar]) => snackbar.kind === 'warning')?.[0];
    const warningText = getReactText(warningSnackbar?.subtitle);

    expect(warningText).toContain('DNI: Identifier value is required');
    expect(warningText).toContain('Date of birth: Birthday is required');
    expect(warningText).toContain('First name: First name is required');
    expect(warningText).not.toContain('birthdate:');
    expect(warningText).not.toContain('relationships');
  });

  it('translates technical address and birthdate paths in the validation summary', () => {
    const spanishLabels: Record<string, string> = {
      addressLabelText: 'Dirección',
      dateOfBirthLabelText: 'Fecha de nacimiento',
      relationshipToPatient: 'Vínculo con el paciente',
    };
    const translate = (key: string, defaultValue: string) => spanishLabels[key] ?? defaultValue;

    expect(getPatientRegistrationFieldLabel(['address'], translate)).toBe('Dirección');
    expect(getPatientRegistrationFieldLabel(['address', 'address'], translate)).toBe('Dirección');
    expect(getPatientRegistrationFieldLabel(['birthdate'], translate)).toBe('Fecha de nacimiento');
    expect(
      getPatientRegistrationFieldLabel(['attributes', 'email-attribute-uuid'], translate, {
        'email-attribute-uuid': 'Correo electrónico',
      }),
    ).toBe('Correo electrónico');
    expect(getPatientRegistrationFieldLabel(['identifiers', 'dni', 'identifierValue'], translate)).toBe('DNI');
    expect(getPatientRegistrationFieldLabel(['relationships', '0', 'relationshipType'], translate)).toBe(
      'Vínculo con el paciente',
    );
  });

  it('renders and saves registration obs', async () => {
    const user = userEvent.setup();

    mockSaveEncounter.mockResolvedValue({} as unknown as FetchResponse);
    mockUseConfig.mockReturnValue(configWithObs);

    render(<PatientRegistration isOffline={false} savePatientForm={FormManager.savePatientFormOnline} />, {
      wrapper: Wrapper,
    });

    await fillRequiredFields();
    const customSection = screen.getByLabelText('Custom Section');
    const weight = within(customSection).getByLabelText('Weight (kg) (optional)');
    await user.type(weight, '50');
    const complaint = within(customSection).getByLabelText('Chief Complaint (optional)');
    await user.type(complaint, 'sad');
    const nationality = within(customSection).getByLabelText('Nationality');
    await user.selectOptions(nationality, 'USA');

    await user.click(screen.getByText(/Register Patient/i));

    await waitFor(() => expect(mockSavePatient).toHaveBeenCalled());

    expect(mockSaveEncounter).toHaveBeenCalledWith(
      expect.objectContaining<Partial<Encounter>>({
        encounterType: 'reg-enc-uuid',
        patient: 'new-pt-uuid',
        obs: [
          { concept: 'weight-uuid', value: 50 },
          { concept: 'chief-complaint-uuid', value: 'sad' },
          { concept: 'nationality-uuid', value: 'usa' },
        ],
      }),
      expect.anything(),
    );
  });

  it('retries saving registration obs after a failed attempt', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue(configWithObs);

    render(<PatientRegistration isOffline={false} savePatientForm={FormManager.savePatientFormOnline} />, {
      wrapper: Wrapper,
    });

    await fillRequiredFields();
    const customSection = screen.getByLabelText('Custom Section');
    const weight = within(customSection).getByLabelText('Weight (kg) (optional)');
    await user.type(weight, '-999');

    mockSaveEncounter.mockRejectedValue({ status: 400, responseBody: { error: { message: 'an error message' } } });
    mockGetUserFacingErrorMessage.mockReturnValueOnce(
      'Some information is invalid. Review the form and try again.',
    );

    const registerPatientButton = screen.getByText(/Register Patient/i);

    await user.click(registerPatientButton);

    await waitFor(() => expect(mockSavePatient).toHaveBeenCalledTimes(1));
    expect(mockSaveEncounter).toHaveBeenCalledTimes(1);

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'Some information is invalid. Review the form and try again.' }),
    );
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400 }),
      'The patient could not be saved. Please try again.',
      expect.objectContaining({
        statusMessages: expect.objectContaining({
          400: 'Some information is invalid. Review the form and try again.',
        }),
      }),
    );
    mockSaveEncounter.mockResolvedValue({} as FetchResponse);

    await user.click(registerPatientButton);
    await waitFor(() => expect(mockSaveEncounter).toHaveBeenCalledTimes(2));
    expect(mockSavePatient).toHaveBeenCalledTimes(1);
    expect(mockSaveEncounter).toHaveBeenCalledTimes(2);

    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });
});

describe('Updating an existing patient record', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      ...mockOpenmrsConfig,
    });
    mockUsePatient.mockImplementation(() => {
      return {
        error: null,
        isLoading: false,
        patient: mockPatient,
        patientUuid: mockPatient.uuid,
      } as unknown as ReturnType<typeof usePatient>;
    });
    mockSavePatient.mockReturnValue({ data: { uuid: 'new-pt-uuid' }, ok: true });
    mockUseParams.mockReturnValue({ patientUuid: mockPatient.uuid });
  });

  it('does not show the medical record section without the archivist role', async () => {
    mockUseInitialFormValues.mockReturnValue([
      { ...initialFormValues, patientUuid: mockPatient.uuid },
      vi.fn(),
      { isLoading: false },
    ]);

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByRole('button', { name: /update patient/i });
    expect(screen.queryByText(/medical record|historia clínica/i)).not.toBeInTheDocument();
  });

  it('shows the medical record section to an archivist while editing', async () => {
    mockResourcesContextValue.currentSession.user = {
      roles: [{ name: 'Archivador de Historias Clínicas' }],
    } as never;
    mockUseInitialFormValues.mockReturnValue([
      { ...initialFormValues, patientUuid: mockPatient.uuid },
      vi.fn(),
      { isLoading: false },
    ]);

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    await screen.findByRole('button', { name: /update patient/i });
    expect(screen.getAllByText(/medical record|historia clínica/i).length).toBeGreaterThan(0);
  });

  it('does not mount an editable form before all initial patient data is hydrated', () => {
    mockUseInitialFormValues.mockReturnValue([{} as FormValues, vi.fn(), { isLoading: true }]);

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('Cargando datos del paciente...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update patient/i })).not.toBeInTheDocument();
  });

  it('does not render values hydrated for a different patient UUID', () => {
    mockUseInitialFormValues.mockReturnValue([
      {} as FormValues,
      vi.fn(),
      { hydratedPatientUuid: 'previous-patient-uuid', isLoading: false },
    ]);

    render(<PatientRegistration isOffline={false} savePatientForm={vi.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('Cargando datos del paciente...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update patient/i })).not.toBeInTheDocument();
  });

  it('reopens a queued offline registration as a pending creation', async () => {
    const user = userEvent.setup();
    const mockSavePatientForm = vi.fn().mockResolvedValue(null);
    const queuedValues = {
      additionalFamilyName: '',
      additionalFamilyName2: '',
      additionalGivenName: '',
      additionalMiddleName: '',
      addNameInLocalLanguage: false,
      address: {},
      attributes: {},
      birthdate: new Date(1990, 0, 1),
      birthdateEstimated: false,
      deathCause: '',
      deathDate: undefined,
      deathTime: undefined,
      deathTimeFormat: 'AM',
      familyName: 'Quispe',
      familyName2: 'Flores',
      gender: 'female',
      givenName: 'Maria',
      identifiers: mockOpenmrsId,
      isDead: false,
      middleName: '',
      monthsEstimated: 0,
      nonCodedCauseOfDeath: '',
      obs: {},
      patientUuid: mockPatient.uuid,
      relationships: [],
      telephoneNumber: '',
      yearsEstimated: 0,
    } as FormValues;
    const queuedTransaction = new SavePatientTransactionManager();
    queuedTransaction.generatedIdentifiers = { openMrsId: '100QUEUED' };

    mockUsePatient.mockReturnValue({ isLoading: true, patient: null } as ReturnType<typeof usePatient>);
    mockUseInitialFormValues.mockReturnValue([
      queuedValues,
      vi.fn(),
      {
        isLoading: false,
        isNewPatient: true,
        queuedRegistration: {
          _patientRegistrationData: {
            capturePhotoProps: null,
            savePatientTransactionManager: queuedTransaction,
          },
        } as never,
      },
    ]);

    render(<PatientRegistration isOffline savePatientForm={mockSavePatientForm} />, { wrapper: Wrapper });

    expect(await screen.findByRole('heading', { name: /create new patient/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /register patient/i }));

    await waitFor(() => expect(mockSavePatientForm).toHaveBeenCalled());
    expect(mockSavePatientForm.mock.calls[0][0]).toBe(true);
    expect(mockSavePatientForm.mock.calls[0][9]).toMatchObject({
      generatedIdentifiers: { openMrsId: '100QUEUED' },
    });
  });

  it('edits patient demographics', async () => {
    const user = userEvent.setup();
    const mockSavePatientForm = vi.fn();

    mockUseInitialFormValues.mockReturnValue([
      {
        additionalFamilyName: '',
        additionalFamilyName2: '',
        additionalGivenName: '',
        additionalMiddleName: '',
        addNameInLocalLanguage: false,
        address: {},
        birthdate: new Date(1972, 3, 4),
        birthdateEstimated: false,
        deathCause: '',
        deathDate: undefined,
        deathTime: undefined,
        deathTimeFormat: 'AM',
        familyName: mockPatient.name.split(' ')[1],
        familyName2: 'Materno',
        gender: 'male',
        givenName: mockPatient.name.split(' ')[0],
        identifiers: {
          openMrsId: {
            autoGeneration: false,
            identifierName: 'OpenMRS ID',
            identifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
            identifierUuid: '1f0ad7a1-430f-4397-b571-59ea654a52db',
            identifierValue: '100GEJ',
            initialValue: '100GEJ',
            preferred: true,
            required: true,
            selectedSource: null,
          },
          idCard: {
            autoGeneration: false,
            identifierName: 'ID Card',
            identifierTypeUuid: 'b4143563-16cd-4439-b288-f83d61670fc8',
            identifierUuid: '346d09b1-8509-43c6-9697-3b4d1ce06ad6',
            identifierValue: '1234567890',
            initialValue: '1234567890',
            preferred: false,
            required: false,
            selectedSource: null,
          },
        },
        isDead: false,
        middleName: '',
        monthsEstimated: 0,
        nonCodedCauseOfDeath: '',
        patientUuid: mockPatient.uuid,
        relationships: [],
        telephoneNumber: '',
        yearsEstimated: 0,
      } as FormValues,
      vi.fn(),
      { isLoading: false },
    ]);

    render(<PatientRegistration isOffline={false} savePatientForm={mockSavePatientForm} />, { wrapper: Wrapper });

    await screen.findByRole('heading', { name: /update patient/i });

    expect(screen.queryByRole('button', { name: /register patient/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update patient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/first name/i)).toHaveValue(mockPatient.name.split(' ')[0]);
    expect(screen.getByLabelText(/^family name$/i)).toHaveValue(mockPatient.name.split(' ')[1]);
    expect((screen.getByRole('textbox', { name: /date of birth/i }) as HTMLInputElement).value).toContain('04/04/1972');
    expect(
      screen.getByRole('radio', {
        name: /^male$/i,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: /^female$/i,
      }),
    ).not.toBeChecked();
    expect(screen.getAllByRole('tab', { name: /yes/i })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /update patient/i }));

    expect(mockSavePatientForm).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        addNameInLocalLanguage: false,
        additionalFamilyName: '',
        additionalFamilyName2: '',
        additionalGivenName: '',
        additionalMiddleName: '',
        address: {
          country: 'កម្ពុជា (Cambodia)',
        },
        birthdate: new Date(1972, 3, 4),
        birthdateEstimated: false,
        deathCause: '',
        nonCodedCauseOfDeath: '',
        deathDate: undefined,
        deathTime: undefined,
        deathTimeFormat: 'AM',
        familyName: 'Wilson',
        familyName2: 'Materno',
        gender: 'male',
        givenName: 'John',
        identifiers: expect.objectContaining({
          idCard: expect.objectContaining({
            autoGeneration: false,
            identifierName: 'ID Card',
            identifierTypeUuid: 'b4143563-16cd-4439-b288-f83d61670fc8',
            identifierUuid: '346d09b1-8509-43c6-9697-3b4d1ce06ad6',
            identifierValue: '1234567890',
            initialValue: '1234567890',
            preferred: false,
            required: false,
            selectedSource: null,
          }),
          openMrsId: expect.objectContaining({
            autoGeneration: false,
            identifierName: 'OpenMRS ID',
            identifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
            identifierUuid: '1f0ad7a1-430f-4397-b571-59ea654a52db',
            identifierValue: '100GEJ',
            initialValue: '100GEJ',
            preferred: true,
            required: true,
            selectedSource: null,
          }),
        }),
        isDead: false,
        middleName: '',
        monthsEstimated: 0,
        patientUuid: '8673ee4f-e2ab-4077-ba55-4980f408773e',
        relationships: [],
        telephoneNumber: '',
        yearsEstimated: 0,
      }),
      expect.anything(),
      expect.anything(),
      null,
      'location-uuid',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ patientSaved: false }),
      expect.anything(),
    );
  });

  it('allows updating an existing patient while identifier types are temporarily unavailable', async () => {
    const user = userEvent.setup();
    const mockSavePatientForm = vi.fn();
    const editFormValues = {
      additionalFamilyName: '',
      additionalFamilyName2: '',
      additionalGivenName: '',
      additionalMiddleName: '',
      addNameInLocalLanguage: false,
      address: {},
      birthdate: new Date(1972, 3, 4),
      birthdateEstimated: false,
      deathCause: '',
      deathDate: undefined,
      deathTime: undefined,
      deathTimeFormat: 'AM',
      familyName: 'Wilson',
      familyName2: 'Materno',
      gender: 'male',
      givenName: 'John',
      identifiers: mockOpenmrsId,
      isDead: false,
      middleName: '',
      monthsEstimated: 0,
      nonCodedCauseOfDeath: '',
      patientUuid: mockPatient.uuid,
      relationships: [],
      telephoneNumber: '',
      yearsEstimated: 0,
    } as FormValues;

    mockResourcesContextValue.identifierTypes = [];
    mockResourcesContextValue.identifierTypesError = new Error('identifier types unavailable');
    mockUseInitialFormValues.mockReturnValue([editFormValues, vi.fn(), { isLoading: false }]);

    render(<PatientRegistration isOffline={false} savePatientForm={mockSavePatientForm} />, { wrapper: Wrapper });

    const updateButton = await screen.findByRole('button', { name: /update patient/i });
    expect(updateButton).toBeEnabled();

    await user.click(updateButton);

    expect(mockSavePatientForm).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        identifiers: mockOpenmrsId,
      }),
      expect.anything(),
      expect.anything(),
      null,
      'location-uuid',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ patientSaved: false }),
      expect.anything(),
    );
  });
});
