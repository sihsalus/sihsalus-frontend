import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import React from 'react';
import { mockIdentifierTypes, mockOpenmrsId, mockPatient, mockSession } from 'test-utils';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';
import { type Resources, ResourcesContext } from '../../../offline.resources';
import { type AddressTemplate, type IdentifierSource } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';

import { countIdentityDocumentIdentifiers, Identifiers, setIdentifierSource } from './id-field.component';
import { isEmergencyIdentifierContext } from './identifier-selection-overlay.component';

vi.mock('../person-attributes/nationality-field.component', () => ({
  NationalityField: ({ fieldDefinition }) => <div data-testid="nationality-field">{fieldDefinition.label}</div>,
}));

const dniIdentifierType = {
  name: 'DNI',
  fieldName: 'dni',
  required: false,
  uuid: '550e8400-e29b-41d4-a716-446655440001',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const carnetIdentifierType = {
  name: 'Carnet de Extranjeria',
  description: 'Documento para personas extranjeras',
  fieldName: 'carnetDeExtranjeria',
  required: false,
  uuid: '550e8400-e29b-41d4-a716-446655440002',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const passportIdentifierType = {
  name: 'Pasaporte',
  fieldName: 'pasaporte',
  required: false,
  uuid: '550e8400-e29b-41d4-a716-446655440003',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const dieIdentifierType = {
  name: 'Documento de Identidad Extranjero',
  fieldName: 'documentoDeIdentidadExtranjero',
  required: false,
  uuid: '8d793bee-c2cc-11de-8d13-0010c6dffd0f',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const cnvIdentifierType = {
  name: 'CNV',
  description: 'Certificado de Nacido Vivo',
  fieldName: 'cnv',
  required: false,
  uuid: '8d79403a-c2cc-11de-8d13-0010c6dffd0f',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const sisContractIdentifierType = {
  name: 'SIS Contrato',
  fieldName: 'sisContrato',
  required: false,
  uuid: 'sis-contract-identifier-type-uuid',
  format: null,
  isPrimary: false,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const sisTemporaryIdentifierType = {
  ...sisContractIdentifierType,
  name: 'SIS Afiliación RN/Temporal',
  fieldName: 'sisAfiliacionTemporal',
  uuid: 'sis-temporary-identifier-type-uuid',
};

const sisIdnumregIdentifierType = {
  ...sisContractIdentifierType,
  name: 'SIS Idnumreg',
  fieldName: 'sisIdnumreg',
  uuid: 'sis-idnumreg-identifier-type-uuid',
};

const clinicalHistoryIdentifierType = {
  name: 'Nº de Historia Clínica',
  fieldName: 'numeroDeHistoriaClinica',
  required: true,
  uuid: 'clinical-history-identifier-type-uuid',
  format: null,
  isPrimary: true,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [
    {
      uuid: 'clinical-history-generator-uuid',
      name: 'Generador SIHSALUS',
      autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: false },
    },
  ],
};

const otherIdentifierType = {
  name: 'OTROS',
  description: 'Documento de identidad no especificado anteriormente',
  fieldName: 'otros',
  required: false,
  uuid: '550e8400-e29b-41d4-a716-446655440004',
  format: '^[A-Za-z0-9][A-Za-z0-9 .-]{0,49}$',
  isPrimary: false,
  uniquenessBehavior: 'NON_UNIQUE' as const,
  identifierSources: [],
};

const peruIdentifierTypes = [
  clinicalHistoryIdentifierType,
  dniIdentifierType,
  carnetIdentifierType,
  passportIdentifierType,
  dieIdentifierType,
  cnvIdentifierType,
  otherIdentifierType,
  sisTemporaryIdentifierType,
  sisContractIdentifierType,
  sisIdnumregIdentifierType,
];

function buildIdentifier(identifierType, identifierValue = '') {
  return {
    identifierTypeUuid: identifierType.uuid,
    identifierName: identifierType.name,
    preferred: identifierType.isPrimary,
    initialValue: '',
    required: identifierType.required,
    identifierValue,
    selectedSource: undefined,
  };
}

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

const mockResourcesContextValue = {
  addressTemplate: null as unknown as AddressTemplate,
  currentSession: mockSession.data,
  identifierTypes: undefined,
  relationshipTypes: [],
} as unknown as Resources;

const mockInitialFormValues = {
  additionalFamilyName: '',
  additionalFamilyName2: '',
  additionalGivenName: '',
  additionalMiddleName: '',
  addNameInLocalLanguage: false,
  address: {},
  birthdate: null,
  birthdateEstimated: false,
  deathCause: '',
  deathDate: '',
  deathTime: '',
  deathTimeFormat: 'AM' as const,
  familyName: 'Doe',
  familyName2: '',
  gender: 'male',
  givenName: 'John',
  identifiers: mockOpenmrsId,
  isDead: false,
  middleName: 'Test',
  monthsEstimated: 0,
  nonCodedCauseOfDeath: '',
  patientUuid: mockPatient.uuid,
  relationships: [],
  telephoneNumber: '',
  yearsEstimated: 0,
};

const mockContextValues: PatientRegistrationContextProps = {
  currentPhoto: null,
  inEditMode: false,
  identifierTypes: [],
  initialFormValues: mockInitialFormValues,
  isOffline: false,
  setCapturePhotoProps: vi.fn(),
  setFieldValue: vi.fn(),
  setInitialFormValues: vi.fn(),
  validationSchema: null,
  values: mockInitialFormValues,
} as unknown as PatientRegistrationContextProps;

function renderIdentifiersWithState(
  initialIdentifiers = {},
  sessionLocation = mockResourcesContextValue.currentSession.sessionLocation,
) {
  function StatefulIdentifiers() {
    const [values, setValues] = React.useState({
      ...mockInitialFormValues,
      identifiers: initialIdentifiers,
    });

    const setFieldValue = vi.fn((fieldName, value) => {
      if (fieldName === 'identifiers') {
        setValues((previousValues) => ({
          ...previousValues,
          identifiers: value,
        }));
      }
    });

    return (
      <ResourcesContext.Provider
        value={{
          ...mockResourcesContextValue,
          currentSession: { ...mockResourcesContextValue.currentSession, sessionLocation },
          identifierTypes: peruIdentifierTypes,
        }}
      >
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider
              value={{
                ...mockContextValues,
                initialFormValues: {
                  ...mockInitialFormValues,
                  identifiers: initialIdentifiers,
                },
                setFieldValue,
                values,
              }}
            >
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>
    );
  }

  return render(<StatefulIdentifiers />);
}

describe('Identifiers', () => {
  beforeEach(() => {
    mockResourcesContextValue.identifierTypes = [];
    mockResourcesContextValue.identifierTypesError = undefined;
    mockResourcesContextValue.isLoadingIdentifierTypes = false;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      defaultPatientIdentifierTypes: ['OpenMRS ID'],
    });
  });

  it('should render loading skeleton when identifier types are loading', () => {
    render(
      <ResourcesContext.Provider value={{ ...mockResourcesContextValue, isLoadingIdentifierTypes: true }}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={mockContextValues}>
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render a non-loading message when identifier types are unavailable', () => {
    const contextValues = {
      ...mockContextValues,
      initialFormValues: { ...mockInitialFormValues, identifiers: {} },
      values: { ...mockInitialFormValues, identifiers: {} },
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={contextValues}>
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Identification data unavailable')).toBeInTheDocument();
  });

  it('shows existing identifiers in edit mode when identifier types are unavailable', () => {
    render(
      <ResourcesContext.Provider
        value={{ ...mockResourcesContextValue, identifierTypesError: new Error('identifier types unavailable') }}
      >
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider
              value={{
                ...mockContextValues,
                inEditMode: true,
                initialFormValues: { ...mockInitialFormValues, identifiers: mockOpenmrsId },
                values: { ...mockInitialFormValues, identifiers: mockOpenmrsId },
              }}
            >
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Identification data unavailable')).toBeInTheDocument();
    expect(screen.getByText('OpenMRS ID')).toBeInTheDocument();
    expect(screen.getByText('Auto-generated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
  });

  it('should render identifier inputs when identifier types are loaded', () => {
    mockResourcesContextValue.identifierTypes = mockIdentifierTypes;

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={mockContextValues}>
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByText('Identifiers')).toBeInTheDocument();
    const configureButton = screen.getByRole('button', { name: 'Configure' });
    expect(configureButton).toBeInTheDocument();
    expect(configureButton).toBeEnabled();
    expect(screen.queryByTestId('nationality-field')).not.toBeInTheDocument();
  });

  it('should open identifier selection overlay when "Configure" button is clicked', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue.identifierTypes = mockIdentifierTypes;
    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={mockContextValues}>
              <Identifiers />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    const configureButton = screen.getByRole('button', { name: 'Configure' });
    await user.click(configureButton);

    expect(screen.getByRole('button', { name: 'Close overlay' })).toBeInTheDocument();
  });

  it('renders a safe source selector for a new auto-generated clinical history identifier', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      numeroDeHistoriaClinica: {
        ...buildIdentifier(clinicalHistoryIdentifierType, 'auto-generated'),
        autoGeneration: true,
      },
      dni: buildIdentifier(dniIdentifierType),
    });

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.getByRole('radio', { name: 'Generador SIHSALUS' })).toBeInTheDocument();
  });

  it('defaults new Peru registrations to DNI only', async () => {
    renderIdentifiersWithState();

    await waitFor(() => expect(screen.getByText('DNI')).toBeInTheDocument());

    expect(screen.getByRole('textbox', { name: 'DNI' })).toHaveAttribute('aria-required', 'true');
    expect(screen.queryByText('Carnet de Extranjeria')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasaporte')).not.toBeInTheDocument();
  });

  it('shows auto-generated identifiers last', async () => {
    renderIdentifiersWithState({
      numeroDeHistoriaClinica: {
        ...buildIdentifier(clinicalHistoryIdentifierType, 'auto-generated'),
        autoGeneration: true,
      },
      dni: buildIdentifier(dniIdentifierType),
    });

    await waitFor(() => expect(screen.getByText('DNI')).toBeInTheDocument());

    expect(screen.getByRole('textbox', { name: 'DNI' })).toBeInTheDocument();
    expect(screen.getAllByTestId('identifier-label').map((label) => label.textContent)).toEqual([
      'Nº de Historia Clínica',
    ]);
  });

  it('keeps DNI and Carnet de Extranjeria mutually exclusive in the identifier configuration panel', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      dni: buildIdentifier(dniIdentifierType),
    });

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.getByText('Documento para personas extranjeras')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Configure identifiers' }));

    expect(screen.queryByText('DNI')).not.toBeInTheDocument();
    expect(screen.getByText('Carnet de Extranjeria')).toBeInTheDocument();
  });

  it('keeps DNI and DIE mutually exclusive in the identifier configuration panel', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      dni: buildIdentifier(dniIdentifierType),
    });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'Documento de Identidad Extranjero' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Documento de Identidad Extranjero' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Configure identifiers' }));

    expect(screen.queryByText('DNI')).not.toBeInTheDocument();
    expect(screen.getByText('Documento de Identidad Extranjero')).toBeInTheDocument();
  });

  it('keeps DNI and Pasaporte mutually exclusive in the identifier configuration panel', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      dni: buildIdentifier(dniIdentifierType),
    });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pasaporte' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pasaporte' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Configure identifiers' }));

    expect(screen.queryByText('DNI')).not.toBeInTheDocument();
    expect(screen.getByText('Pasaporte')).toBeInTheDocument();
  });

  it('allows switching from a foreign document back to DNI before confirming', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' }));
    await user.click(screen.getByRole('checkbox', { name: 'DNI' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' })).not.toBeChecked();
  });

  it('discards identifier selection changes when the overlay is cancelled', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: 'Close overlay' })).not.toBeInTheDocument();
    expect(screen.getByText('DNI')).toBeInTheDocument();
    expect(screen.queryByText('Carnet de Extranjeria')).not.toBeInTheDocument();
  });

  it('searches identifier names and descriptions ignoring surrounding spaces', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search identifier' }), '  PERSONAS EXTRANJERAS  ');

    expect(screen.getByRole('checkbox', { name: 'Carnet de Extranjeria' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'DNI' })).not.toBeInTheDocument();
  });

  it('shows an empty state when no identifier type matches the search', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search identifier' }), 'sin coincidencias');

    expect(screen.getByRole('status')).toHaveTextContent('No matching identification data found');
  });

  it('accepts CNV as the only civil identity document', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'CNV' }));
    await user.click(screen.getByRole('checkbox', { name: 'DNI' }));
    await user.click(screen.getByRole('button', { name: 'Configure identifiers' }));

    expect(screen.queryByText('DNI')).not.toBeInTheDocument();
    expect(screen.getByText('CNV')).toBeInTheDocument();
  });

  it('does not count a SIS code as a civil identity document', async () => {
    expect(
      countIdentityDocumentIdentifiers(
        { sisContrato: buildIdentifier(sisContractIdentifierType, 'SIS-001') },
        peruIdentifierTypes,
      ),
    ).toBe(0);

    const user = userEvent.setup();
    renderIdentifiersWithState({ dni: buildIdentifier(dniIdentifierType) });
    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('checkbox', { name: 'SIS Contrato' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).toBeDisabled();
  });

  it('deletes identifier inputs while keeping the configuration panel in sync', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      dni: buildIdentifier(dniIdentifierType),
      pasaporte: buildIdentifier(passportIdentifierType),
    });

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    expect(screen.getByText('DNI')).toBeInTheDocument();
    expect(screen.queryByText('Pasaporte')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.getByRole('checkbox', { name: 'DNI' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pasaporte' })).not.toBeChecked();
  });

  it('does not count the clinical history identifier toward the minimum identity document requirement', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      numeroDeHistoriaClinica: buildIdentifier(clinicalHistoryIdentifierType, 'auto-generated'),
      dni: buildIdentifier(dniIdentifierType),
    });

    expect(screen.getByText('Nº de Historia Clínica')).toBeInTheDocument();
    expect(screen.getByText('DNI')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.getByRole('checkbox', { name: 'Nº de Historia Clínica' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'DNI' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Documento de Identidad Extranjero' }));
    await user.click(screen.getByRole('button', { name: 'Configure identifiers' }));

    expect(screen.getByText('Nº de Historia Clínica')).toBeInTheDocument();
    expect(screen.queryByText('DNI')).not.toBeInTheDocument();
    expect(screen.getByText('Documento de Identidad Extranjero')).toBeInTheDocument();
  });

  it('hides the generic Otros identifier outside emergency registration', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState(
      { dni: buildIdentifier(dniIdentifierType) },
      {
        uuid: 'outpatient-location',
        display: 'UPSS - CONSULTA EXTERNA',
        links: [],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.queryByRole('checkbox', { name: 'OTROS' })).not.toBeInTheDocument();
  });

  it('offers Otros as a civil identity document in emergency registration', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState(
      { dni: buildIdentifier(dniIdentifierType) },
      {
        uuid: '35d2234e-129a-4c40-abb2-1ae0b2400003',
        display: 'UPSS - EMERGENCIA',
        links: [],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Configure' }));

    expect(screen.getByRole('checkbox', { name: 'OTROS' })).toBeInTheDocument();
    expect(countIdentityDocumentIdentifiers({ otros: buildIdentifier(otherIdentifierType) }, peruIdentifierTypes)).toBe(
      1,
    );
  });
});

describe('isEmergencyIdentifierContext', () => {
  it('detects emergency by location UUID, display name or explicit source', () => {
    expect(isEmergencyIdentifierContext({ uuid: '35d2234e-129a-4c40-abb2-1ae0b2400003' }, '')).toBe(true);
    expect(isEmergencyIdentifierContext({ display: 'UPSS - EMERGENCIA' }, '')).toBe(true);
    expect(isEmergencyIdentifierContext(null, '?source=emergency')).toBe(true);
    expect(isEmergencyIdentifierContext({ display: 'UPSS - CONSULTA EXTERNA' }, '')).toBe(false);
  });
});

describe('setIdentifierSource', () => {
  describe('auto-generation', () => {
    it('should return auto-generated as the identifier value', () => {
      const identifierSource = { autoGenerationOption: { automaticGenerationEnabled: true } } as IdentifierSource;
      const { identifierValue } = setIdentifierSource(identifierSource, '', '');
      expect(identifierValue).toBe('auto-generated');
    });

    it('should return the identifier value when manual entry enabled', () => {
      const identifierSource = {
        autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: true },
      } as IdentifierSource;
      const { identifierValue } = setIdentifierSource(identifierSource, '10001V', '');
      expect(identifierValue).toBe('10001V');
    });
  });
});
