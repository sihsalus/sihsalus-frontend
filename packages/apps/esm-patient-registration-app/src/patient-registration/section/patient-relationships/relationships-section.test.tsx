import { render, screen } from '@testing-library/react';
import { Form, Formik } from 'formik';

import { type Resources, ResourcesContext } from '../../../offline.resources';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';

import { RelationshipsSection } from './relationships-section.component';

vi.mock('../../patient-registration.resource', () => ({
  fetchPerson: vi.fn().mockResolvedValue({
    data: {
      results: [
        { uuid: '42ae5ce0-d64b-11ea-9064-5adc43bbdd24', display: 'Person 1' },
        { uuid: '691eed12-c0f1-11e2-94be-8c13b969e334', display: 'Person 2' },
      ],
    },
  }),
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

describe('RelationshipsSection', () => {
  beforeEach(() => {
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
          displayAIsToB: 'Father',
          aIsToB: 'Father',
          bIsToA: 'Child',
          displayBIsToA: 'Child',
          uuid: '52ae5ce0-d64b-11ea-9064-5adc43bbdd24',
        },
      ],
    };
    mockResourcesContextValue = {
      ...mockResourcesContextValue,
      relationshipTypes: relationshipTypes,
    };

    render(
      <ResourcesContext.Provider value={mockResourcesContextValue}>
        <Formik
          initialValues={{
            relationships: [{ action: 'ADD', relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a' }],
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
    expect(screen.getByRole('searchbox', { name: /full name/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mother/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /father/i })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /child/i }).length).toEqual(2);
  });
});
