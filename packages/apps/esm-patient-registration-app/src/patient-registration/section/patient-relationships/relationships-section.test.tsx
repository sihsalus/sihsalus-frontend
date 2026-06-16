import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';

import { type Resources, ResourcesContext } from '../../../offline.resources';
import { savePerson } from '../../patient-registration.resource';
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

const mockSavePerson = vi.mocked(savePerson);

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

describe('RelationshipsSection', () => {
  beforeEach(() => {
    mockSavePerson.mockReset();
    mockSavePerson.mockResolvedValue({
      data: { uuid: 'created-person-uuid', display: 'María Quispe' },
    } as Awaited<ReturnType<typeof savePerson>>);
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
    expect(screen.queryByText(/add relationship/i)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/add relationship/i)).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /add relationship/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: /relationship/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add relationship/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mother/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /guardian/i })).toBeInTheDocument();
    expect(screen.getByText(/register new person/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^family name$/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sex/i })).toBeInTheDocument();
  });

  it('keeps the existing person search flow available', async () => {
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

    await user.click(screen.getByText(/search existing person/i));

    expect(screen.getByRole('searchbox', { name: /full name/i })).toBeInTheDocument();
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
            relationships: [],
          }}
          onSubmit={null}
        >
          <Form>
            <PatientRegistrationContext.Provider
              value={{ ...initialContextValues, setFieldValue, values: { relationships: [] } as FormValues }}
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

  it('creates a new OpenMRS person and assigns it to the relationship row', async () => {
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

    await user.selectOptions(
      screen.getByRole('combobox', { name: /relationship/i }),
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    await user.type(screen.getByRole('textbox', { name: /first name/i }), 'María');
    await user.type(screen.getByRole('textbox', { name: /^family name/i }), 'Quispe');
    await user.selectOptions(screen.getByRole('combobox', { name: /sex/i }), 'female');
    await user.type(screen.getByRole('textbox', { name: /approximate age/i }), '35');
    await user.click(screen.getByRole('button', { name: /register person and use as responsible party/i }));

    await waitFor(() => expect(mockSavePerson).toHaveBeenCalledTimes(1));

    expect(mockSavePerson).toHaveBeenCalledWith({
      names: [
        {
          givenName: 'María',
          middleName: undefined,
          familyName: 'Quispe',
          familyName2: undefined,
          preferred: true,
        },
      ],
      gender: 'F',
      birthdate: `${new Date().getFullYear() - 35}-01-01`,
      birthdateEstimated: true,
    });
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonUuid', 'created-person-uuid');
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].relatedPersonName', 'María Quispe');
    expect(setFieldValue).toHaveBeenCalledWith(
      'relationships[0].relationshipType',
      '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    );
    expect(setFieldValue).toHaveBeenCalledWith('relationships[0].action', 'ADD');
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

    await user.click(screen.getByRole('button', { name: /register person and use as responsible party/i }));

    expect(mockSavePerson).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /relationship/i })).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByRole('textbox', { name: /first name/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: /^family name$/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: /sex/i })).toHaveAttribute('aria-invalid', 'true');
  });
});
