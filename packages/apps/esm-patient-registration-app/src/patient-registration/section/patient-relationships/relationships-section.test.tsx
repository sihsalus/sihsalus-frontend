import { useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';

import { type RegistrationConfig } from '../../../config-schema';
import { type Resources, ResourcesContext } from '../../../offline.resources';
import { fetchPerson, savePerson } from '../../patient-registration.resource';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';

import { RelationshipsSection } from './relationships-section.component';

vi.mock('../../patient-registration.resource', () => ({
  fetchPerson: vi.fn().mockResolvedValue([
    { uuid: '42ae5ce0-d64b-11ea-9064-5adc43bbdd24', display: 'Person 1' },
    { uuid: '691eed12-c0f1-11e2-94be-8c13b969e334', display: 'Person 2' },
  ]),
  savePerson: vi.fn(),
}));

let mockResourcesContextValue = {
  addressTemplate: null,
  currentSession: {
    authenticated: true,
    sessionId: 'JSESSION',
    currentProvider: { uuid: '45ce6c2e-dd5a-11e6-9d9c-0242ac150002', identifier: 'PRO-123' },
  },
  identifierTypes: [],
  relationshipTypes: null,
} as Resources;

const initialContextValues = {
  currentPhoto: 'data:image/png;base64,1234567890',
  identifierTypes: [],
  inEditMode: false,
  initialFormValues: {} as FormValues,
  isOffline: false,
  setCapturePhotoProps: vi.fn(),
  setFieldValue: vi.fn(),
  setFieldTouched: vi.fn(),
  setInitialFormValues: vi.fn(),
  validationSchema: null,
  values: {} as FormValues,
};

const mockFetchPerson = vi.mocked(fetchPerson);
const mockSavePerson = vi.mocked(savePerson);
const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

const minorPatientValues = {
  birthdateEstimated: true,
  yearsEstimated: 12,
  relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
} as FormValues;

const relationshipTypes = {
  results: [
    {
      displayAIsToB: 'Mother',
      aIsToB: 'Mother',
      bIsToA: 'Child',
      displayBIsToA: 'Child',
      uuid: '42ae5ce0-d64b-11ea-9064-5adc43bbdd34',
    },
    {
      displayAIsToB: 'Guardian',
      aIsToB: 'Guardian',
      bIsToA: 'Ward',
      displayBIsToA: 'Ward',
      uuid: '057de23f-3d9c-4314-9391-4452970739c6',
    },
  ],
};

const duplicateSpanishRelationshipTypes = {
  results: [
    {
      displayAIsToB: 'Padre',
      aIsToB: 'Padre',
      bIsToA: 'Hijo',
      displayBIsToA: 'Hijo',
      uuid: 'parent-child-relationship-type',
    },
    {
      displayAIsToB: 'Abuelo',
      aIsToB: 'Abuelo',
      bIsToA: 'Nieto',
      displayBIsToA: 'Nieto',
      uuid: 'grandparent-grandchild-relationship-type',
    },
    {
      displayAIsToB: 'Sobrino',
      aIsToB: 'Sobrino',
      bIsToA: 'Tío',
      displayBIsToA: 'Tío',
      uuid: 'uncle-nephew-relationship-type',
    },
    {
      displayAIsToB: 'Sobrino',
      aIsToB: 'Sobrino',
      bIsToA: 'Tío',
      displayBIsToA: 'Tío',
      uuid: 'duplicate-uncle-nephew-relationship-type',
    },
    {
      displayAIsToB: 'Niece/Nephew',
      aIsToB: 'Niece/Nephew',
      bIsToA: 'Aunt/Uncle',
      displayBIsToA: 'Aunt/Uncle',
      uuid: 'english-uncle-nephew-relationship-type',
    },
  ],
};

describe('RelationshipsSection', () => {
  beforeEach(() => {
    mockFetchPerson.mockReset();
    mockFetchPerson.mockResolvedValue([
      { uuid: '42ae5ce0-d64b-11ea-9064-5adc43bbdd24', display: 'Person 1', age: 35 },
      { uuid: '691eed12-c0f1-11e2-94be-8c13b969e334', display: 'Person 2', age: 40 },
    ]);
    mockSavePerson.mockReset();
    mockSavePerson.mockResolvedValue({
      data: { uuid: 'created-person-uuid', display: 'María Quispe' },
    } as Awaited<ReturnType<typeof savePerson>>);
    mockUseConfig.mockReturnValue({
      fieldConfigurations: {
        phone: {
          personAttributeUuid: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
        },
      },
      relationshipOptions: {
        minorResponsibleRelationshipTypes: ['057de23f-3d9c-4314-9391-4452970739c6/aIsToB'],
      },
    } as RegistrationConfig);
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: null,
      relationshipTypesError: undefined,
      isLoadingRelationshipTypes: false,
    };
  });

  it('renders a loader when relationshipTypes are not available', () => {
    render(
      <ResourcesContext.Provider value={{ ...mockResourcesContextValue, isLoadingRelationshipTypes: true }}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <RelationshipsSection />
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByLabelText(/loading relationships section/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/add family member or companion/i)).not.toBeInTheDocument();
  });

  it('renders a non-loading message when relationshipTypes are unavailable', () => {
    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{}} onSubmit={null}>
          <Form>
            <RelationshipsSection />
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Relationship types unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/add family member or companion/i)).not.toBeInTheDocument();
  });

  it('does not show relationship controls in edit mode until relationshipTypes are available', () => {
    render(
      <ResourcesContext.Provider
        value={{ ...mockResourcesContextValue, relationshipTypesError: new Error('relationship types unavailable') }}
      >
        <Formik
          initialValues={{
            relationships: [
              {
                action: undefined,
                relatedPersonName: 'Jane Doe',
                relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
                relationshipType: '42ae5ce0-d64b-11ea-9064-5adc43bbdd34/aIsToB',
                uuid: 'relationship-uuid',
              },
            ],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider
              value={{
                ...initialContextValues,
                inEditMode: true,
                values: {
                  ...initialContextValues.values,
                  relationships: [
                    {
                      action: undefined,
                      relatedPersonName: 'Jane Doe',
                      relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
                      relationshipType: '42ae5ce0-d64b-11ea-9064-5adc43bbdd34/aIsToB',
                      uuid: 'relationship-uuid',
                    },
                  ],
                },
              }}
            >
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Relationship types unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add family member or companion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /relationship/i })).not.toBeInTheDocument();
  });

  it('renders relationships when relationshipTypes are available', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByLabelText(/relationships section/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /family link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add family link/i })).toBeDisabled();
    expect(screen.getByRole('option', { name: /mother/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /guardian/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Search existing person',
      'Register new person',
    ]);
    expect(screen.getByRole('tab', { name: /search existing person/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /register new person/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('searchbox', { name: /full name/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /first name/i })).not.toBeInTheDocument();
  });

  it('warns when a family link is incomplete and prevents adding another row', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes,
    };
    const formValues = {
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '',
          relationshipType: '42ae5ce0-d64b-11ea-9064-5adc43bbdd34/aIsToB',
        },
      ],
    } as FormValues;

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={formValues} onSubmit={vi.fn()}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: formValues }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByText('Complete the pending family link')).toBeInTheDocument();
    expect(
      screen.getByText('Select the relationship and the related person before adding another family link.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add family link/i })).toBeDisabled();
  });

  it('orders family links by weight, hides operational roles, and keeps Other last', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: {
        results: [
          { displayAIsToB: 'Other', displayBIsToA: 'Other', uuid: 'other', weight: 999 },
          { displayAIsToB: 'Mother', displayBIsToA: 'Mother', uuid: 'mother', weight: 20 },
          { displayAIsToB: 'Doctor', displayBIsToA: 'Patient', uuid: 'doctor', weight: 1 },
          { displayAIsToB: 'Aunt/Uncle', displayBIsToA: 'Aunt/Uncle', uuid: 'aunt-uncle' },
          { displayAIsToB: 'Father', displayBIsToA: 'Father', uuid: 'father', weight: 10 },
        ],
      },
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{ relationships: [{ action: 'ADD', relatedPersonUuid: '' }] }} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    const optionLabels = screen
      .getAllByRole('option')
      .filter((option) => !option.hasAttribute('disabled'))
      .map((option) => option.textContent);

    expect(optionLabels).toEqual(['Father', 'Mother', 'Aunt/Uncle', 'Other']);
    expect(screen.queryByRole('option', { name: /doctor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /patient/i })).not.toBeInTheDocument();
  });

  it('allows adding another relationship after the current one is complete', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes,
    };
    const formValues = {
      relationships: [
        {
          action: 'ADD',
          relatedPersonName: 'Jane Doe',
          relatedPersonUuid: 'related-person-uuid',
          relationshipType: '42ae5ce0-d64b-11ea-9064-5adc43bbdd34/aIsToB',
        },
      ],
    } as FormValues;

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={formValues} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: formValues }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /add family link/i })).toBeEnabled();
  });

  it('moves the primary responsible flag and marks existing relationships for update', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    const relationships = [
      {
        isCompanion: true,
        relatedPersonName: 'Maria Quispe',
        relatedPersonUuid: 'person-one',
        relation: 'Madre',
        relationshipType: 'mother/aIsToB',
        uuid: 'relationship-one',
      },
      {
        relatedPersonName: 'Juan Quispe',
        relatedPersonUuid: 'person-two',
        relation: 'Padre',
        relationshipType: 'father/aIsToB',
        uuid: 'relationship-two',
      },
    ] as FormValues['relationships'];
    mockResourcesContextValue = { ...mockResourcesContextValue, relationshipTypes };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{ relationships }} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider
              value={{ ...initialContextValues, setFieldValue, values: { relationships } as FormValues }}
            >
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('checkbox', { name: /Juan Quispe.*Padre/i }));

    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].isCompanion', false);
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].action', 'UPDATE');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[1].isCompanion', true);
    expect(setFieldValue).toHaveBeenCalledWith('relationships[1].action', 'UPDATE');
  });

  it('deduplicates relationship options and hides child/grandchild options for minor patients', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: duplicateSpanishRelationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={minorPatientValues} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: minorPatientValues }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByRole('option', { name: /padre/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /abuelo/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /hijo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /nieto/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /sobrino/i })).toHaveLength(1);
    expect(screen.getAllByRole('option', { name: /tío/i })).toHaveLength(1);
  });

  it('keeps the existing person search flow as the default', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByRole('searchbox', { name: /full name/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /register new person/i }));
    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /search existing person/i }));
    expect(screen.getByRole('searchbox', { name: /full name/i })).toBeInTheDocument();
  });

  it('shows an inline error when an existing person is required but none is selected', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };
    const formValues = {
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '',
          relationshipType: '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
        },
      ],
    } as FormValues;

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={formValues} onSubmit={vi.fn()}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: formValues }}>
              <RelationshipsSection />
              <button type="submit">Register patient</button>
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: /register patient/i }));

    expect(await screen.findByText('Select an existing person')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /search existing person/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /register new person/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows the required responsible person error after the seeded relationship row is touched', () => {
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };
    const formValues = {
      ...minorPatientValues,
      relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
    } as FormValues;

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={formValues}
          initialErrors={{
            relationships: [{ relationshipType: 'relationshipTypeRequired' }],
          }}
          initialTouched={{ relationships: [{ relationshipType: true }] }}
          onSubmit={vi.fn()}
        >
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: formValues }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'For minors, record a responsible family member, guardian, or legal representative.',
    );
    expect(screen.getByRole('combobox', { name: /relationship/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Select an existing person')).toBeInTheDocument();
  });

  it('limits responsible person name inputs when creating a new person', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('tab', { name: /register new person/i }));

    expect(screen.getByRole('textbox', { name: /first name/i })).toHaveAttribute('maxLength', '150');
    expect(screen.getByRole('textbox', { name: /middle name/i })).toHaveAttribute('maxLength', '150');
    expect(screen.getByRole('textbox', { name: /^family name$/i })).toHaveAttribute('maxLength', '100');
    expect(screen.getByRole('textbox', { name: /second family name/i })).toHaveAttribute('maxLength', '100');
    expect(screen.getByRole('spinbutton', { name: /approximate age/i })).toHaveAttribute('min', '0');
    expect(screen.getByRole('spinbutton', { name: /approximate age/i })).toHaveAttribute('max', '140');
  });

  it('keeps the selected existing person name after search selection', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, setFieldValue }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.type(screen.getByRole('searchbox', { name: /full name/i }), 'Person');
    await user.click(await screen.findByText('Person 1'));

    expect(setFieldValue).toHaveBeenCalledWith(
      'relationships[0].relatedPersonUuid',
      '42ae5ce0-d64b-11ea-9064-5adc43bbdd24',
    );
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonName', 'Person 1');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonAge', 35);
  });

  it('rejects selecting an underage existing person as the responsible person for a minor patient', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    mockFetchPerson.mockResolvedValue([{ uuid: 'minor-person-uuid', display: 'Minor Person', age: 16 }]);
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={minorPatientValues} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider
              value={{ ...initialContextValues, setFieldValue, values: minorPatientValues }}
            >
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /relationship/i }),
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    await user.type(screen.getByRole('searchbox', { name: /full name/i }), 'Minor');
    await user.click(await screen.findByText('Minor Person'));

    expect(screen.getByText('Responsible person must be an adult')).toBeInTheDocument();
    expect(setFieldValue).not.toHaveBeenCalledWith('relationships[0].relatedPersonUuid', 'minor-person-uuid');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonUuid', '');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonName', '');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonAge', undefined);
  });

  it('seeds one empty relationship row for sections that request a default responsible person form', async () => {
    const setFieldValue = vi.fn();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            birthdateEstimated: true,
            yearsEstimated: 12,
            relationships: [],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider
              value={{
                ...initialContextValues,
                setFieldValue,
                values: { birthdateEstimated: true, yearsEstimated: 12, relationships: [] } as FormValues,
              }}
            >
              <RelationshipsSection defaultNewRelationship />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('relationships', expect.any(Array)));
    expect(setFieldValue.mock.calls[0][1]).toMatchObject([{ relatedPersonUuid: '', action: 'ADD' }]);
  });

  it('removes an untouched automatic relationship when the patient changes from minor to adult', async () => {
    const setFieldValue = vi.fn();
    const emptyRelationship = {
      clientId: 'automatic-relationship',
      action: 'ADD' as const,
      relatedPersonUuid: '',
    };
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes,
    };

    const renderSection = (values: FormValues) => (
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={{ relationships: values.relationships }} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, setFieldValue, values }}>
              <RelationshipsSection defaultNewRelationship />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>
    );

    const { rerender } = render(
      renderSection({
        birthdateEstimated: true,
        yearsEstimated: 12,
        relationships: [emptyRelationship],
      } as FormValues),
    );

    setFieldValue.mockClear();
    rerender(
      renderSection({
        birthdateEstimated: true,
        yearsEstimated: 40,
        relationships: [emptyRelationship],
      } as FormValues),
    );

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('relationships', [], true));
  });

  it('stores the new responsible person on the relationship row without creating it before submit', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, setFieldValue }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('tab', { name: /register new person/i }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: /relationship/i }),
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    await user.type(screen.getByRole('textbox', { name: /first name/i }), 'María');
    await user.type(screen.getByRole('textbox', { name: /^family name/i }), 'Quispe');
    await user.selectOptions(screen.getByRole('combobox', { name: /sex/i }), 'female');
    await user.type(screen.getByRole('spinbutton', { name: /approximate age/i }), '35');
    await user.type(screen.getByRole('textbox', { name: /phone or mobile phone/i }), '987 654-321');
    await user.type(screen.getByRole('textbox', { name: /address/i }), 'Av. Peru 123');
    await user.click(screen.getByRole('button', { name: /save companion or responsible person/i }));

    // The person must NOT be created here: it is persisted at form submit, right before
    // its relationship, so abandoning the registration leaves no orphaned person.
    expect(mockSavePerson).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith('relationships[0].newPerson', {
        givenName: 'María',
        middleName: '',
        familyName: 'Quispe',
        familyName2: '',
        gender: 'female',
        estimatedAge: '35',
        phone: '987654321',
        address: 'Av. Peru 123',
        relationshipType: '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
      }),
    );
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonName', 'María Quispe');
    expect(setFieldValue).toHaveBeenCalledWith(
      'relationships[0].relationshipType',
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].action', 'ADD');
  });

  it('does not create an underage responsible person for a minor patient', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik initialValues={minorPatientValues} onSubmit={null}>
          <Form>
            <PatientRegistrationContext.Provider value={{ ...initialContextValues, values: minorPatientValues }}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('tab', { name: /register new person/i }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: /relationship/i }),
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    await user.type(screen.getByRole('textbox', { name: /first name/i }), 'Luis');
    await user.type(screen.getByRole('textbox', { name: /^family name/i }), 'Quispe');
    await user.selectOptions(screen.getByRole('combobox', { name: /sex/i }), 'male');
    const estimatedAgeInput = screen.getByRole('spinbutton', { name: /^approximate age$/i });
    expect(estimatedAgeInput).toHaveAttribute('min', '18');
    await user.type(estimatedAgeInput, '16');
    await user.click(screen.getByRole('button', { name: /save companion or responsible person/i }));

    expect(mockSavePerson).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('spinbutton', { name: /^approximate age$/i })).toHaveAttribute('aria-invalid', 'true'),
    );
  });

  it('filters non-numeric characters from the new responsible person approximate age', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('tab', { name: /register new person/i }));
    await user.type(screen.getByRole('spinbutton', { name: /approximate age/i }), 'abc12');

    expect(screen.getByRole('spinbutton', { name: /approximate age/i })).toHaveValue(12);
  });

  it('does not create a person until the minimum responsible person data is valid', async () => {
    const user = userEvent.setup();
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '' }],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider value={initialContextValues}>
              <RelationshipsSection />
            </PatientRegistrationContext.Provider>
          </Form>
        </Formik>
      </ResourcesContext.Provider>,
    );

    await user.click(screen.getByRole('tab', { name: /register new person/i }));
    await user.click(screen.getByRole('button', { name: /save companion or responsible person/i }));

    expect(mockSavePerson).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /relationship/i })).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByRole('textbox', { name: /first name/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: /^family name$/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: /sex/i })).toHaveAttribute('aria-invalid', 'true');
  });
});
