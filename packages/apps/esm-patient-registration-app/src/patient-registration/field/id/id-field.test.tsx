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

import { Identifiers, setIdentifierSource } from './id-field.component';

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

const clinicalHistoryIdentifierType = {
  name: 'Nº de Historia Clínica',
  fieldName: 'numeroDeHistoriaClinica',
  required: true,
  uuid: 'clinical-history-identifier-type-uuid',
  format: null,
  isPrimary: true,
  uniquenessBehavior: 'UNIQUE' as const,
  identifierSources: [],
};

const peruIdentifierTypes = [
  clinicalHistoryIdentifierType,
  dniIdentifierType,
  carnetIdentifierType,
  passportIdentifierType,
  dieIdentifierType,
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
  identifierTypes: [],
  relationshipTypes: [],
} as Resources;

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

function renderIdentifiersWithState(initialIdentifiers = {}) {
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
      <ResourcesContext.Provider value={{ ...mockResourcesContextValue, identifierTypes: peruIdentifierTypes }}>
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
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      defaultPatientIdentifierTypes: ['OpenMRS ID'],
    });
  });

  it('should render loading skeleton when identifier types are loading', () => {
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

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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

  it('defaults new Peru registrations to DNI only', async () => {
    renderIdentifiersWithState();

    await waitFor(() => expect(screen.getByText('DNI')).toBeInTheDocument());

    expect(screen.queryByText('Carnet de Extranjeria')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasaporte')).not.toBeInTheDocument();
  });

  it('keeps DNI and Carnet de Extranjeria mutually exclusive in the identifier configuration panel', async () => {
    const user = userEvent.setup();
    renderIdentifiersWithState({
      dni: buildIdentifier(dniIdentifierType),
    });

    await user.click(screen.getByRole('button', { name: 'Configure' }));
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
