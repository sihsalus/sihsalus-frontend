import { useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import { Form, Formik } from 'formik';

import { type FieldDefinition } from '../../../config-schema';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import { useConceptAnswers } from '../field.resource';

import { PersonAttributeField } from './person-attribute-field.component';
import { usePersonAttributeType } from './person-attributes.resource';

vi.mock('./person-attributes.resource', async () => ({
  ...(await vi.importActual('./person-attributes.resource')),
  usePersonAttributeType: vi.fn(),
}));

vi.mock('../field.resource', async () => ({
  ...(await vi.importActual('../field.resource')),
  useConceptAnswers: vi.fn(),
}));

const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseConceptAnswers = vi.mocked(useConceptAnswers);
const mockUseSession = vi.mocked(useSession);

const mockPersonAttributeType = {
  format: 'java.lang.String',
  display: 'Referred by',
  uuid: '4dd56a75-14ab-4148-8700-1f4f704dc5b0',
  name: 'Referred by',
  description: 'The person who referred the patient',
};

const baseFieldDefinition: FieldDefinition = {
  id: 'referredby',
  label: 'Referred by',
  type: 'person attribute',
  uuid: '4dd56a75-14ab-4148-8700-1f4f704dc5b0',
  answerConceptSetUuid: '6682d17f-0777-45e4-a39b-93f77eb3531c',
  validation: {
    matches: '',
    required: true,
  },
  showHeading: true,
};

let fieldDefinition: FieldDefinition = { ...baseFieldDefinition };

describe('PersonAttributeField', () => {
  beforeEach(() => {
    fieldDefinition = { ...baseFieldDefinition };
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [{ display: 'Get Concepts', name: 'Get Concepts' }],
      },
    } as ReturnType<typeof useSession>);
    mockUsePersonAttributeType.mockReturnValue({
      data: mockPersonAttributeType,
      isLoading: false,
      error: null,
    });
    mockUseConceptAnswers.mockReturnValue({
      data: [
        { uuid: '1', display: 'Option 1' },
        { uuid: '2', display: 'Option 2' },
      ],
      error: null,
      isLoading: false,
    });
  });

  it('renders the text input field for String format', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    const input = screen.getByLabelText(/Referred by/i) as HTMLInputElement;
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('text');
  });

  it('passes the configured placeholder to text inputs', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={{ ...fieldDefinition, placeholder: '012345678' }} />
        </Form>
      </Formik>,
    );

    expect(screen.getByPlaceholderText('012345678')).toBeInTheDocument();
  });

  it('should not show heading if showHeading is false', () => {
    fieldDefinition = {
      ...fieldDefinition,
      showHeading: false,
    };

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders the coded attribute field for Concept format', () => {
    fieldDefinition = {
      id: 'referredby',
      ...fieldDefinition,
      label: 'Referred by',
    };

    mockUsePersonAttributeType.mockReturnValue({
      data: { ...mockPersonAttributeType, format: 'org.openmrs.Concept' },
      isLoading: false,
      error: null,
    });

    mockUseConceptAnswers.mockReturnValueOnce({
      data: [
        { uuid: '1', display: 'Option 1' },
        { uuid: '2', display: 'Option 2' },
      ],
      error: null,
      isLoading: false,
    });

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    const input = screen.getByLabelText(/Referred by/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('select-one');
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('locks read-only-on-create coded attributes when creating a new patient', () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: { ...mockPersonAttributeType, format: 'org.openmrs.Concept' },
      isLoading: false,
      error: null,
    });

    render(
      <Formik initialValues={{ attributes: {} }} onSubmit={() => {}}>
        <Form>
          <PatientRegistrationContext.Provider
            value={
              {
                inEditMode: false,
                values: { attributes: {} },
              } as unknown as PatientRegistrationContextProps
            }
          >
            <PersonAttributeField
              fieldDefinition={{
                ...fieldDefinition,
                readOnlyOnCreate: true,
                customConceptAnswers: [{ uuid: 'active', label: 'Activa' }],
              }}
            />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    expect(screen.getByLabelText(/Referred by/i)).toBeDisabled();
  });

  it('keeps read-only-on-create coded attributes editable while editing an existing patient', () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: { ...mockPersonAttributeType, format: 'org.openmrs.Concept' },
      isLoading: false,
      error: null,
    });

    render(
      <Formik initialValues={{ attributes: {} }} onSubmit={() => {}}>
        <Form>
          <PatientRegistrationContext.Provider
            value={
              {
                inEditMode: true,
                values: { attributes: {} },
              } as unknown as PatientRegistrationContextProps
            }
          >
            <PersonAttributeField
              fieldDefinition={{
                ...fieldDefinition,
                readOnlyOnCreate: true,
                customConceptAnswers: [{ uuid: 'active', label: 'Activa' }],
              }}
            />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    expect(screen.getByLabelText(/Referred by/i)).not.toBeDisabled();
  });

  it('applies a configured default value for new registrations', async () => {
    const setFieldValue = vi.fn();

    render(
      <Formik initialValues={{ attributes: {} }} onSubmit={() => {}}>
        <Form>
          <PatientRegistrationContext.Provider
            value={
              {
                inEditMode: false,
                setFieldValue,
                values: { attributes: {} },
              } as unknown as PatientRegistrationContextProps
            }
          >
            <PersonAttributeField fieldDefinition={{ ...fieldDefinition, defaultValue: 'default-value' }} />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>,
    );

    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(`attributes.${mockPersonAttributeType.uuid}`, 'default-value', false),
    );
  });

  it('renders an error notification if attribute type has unknown format', () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: { ...mockPersonAttributeType, format: 'unknown' },
      isLoading: false,
      error: null,
    });

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Patient attribute type has unknown format/i)).toBeInTheDocument();
  });

  it('renders an error notification if unable to fetch attribute type', () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch attribute type'),
    });

    fieldDefinition = {
      id: 'referredBy',
      uuid: 'attribute-uuid',
      label: 'Attribute',
      showHeading: false,
      type: 'person attribute',
    };

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to fetch person attribute type/i)).toBeInTheDocument();
  });

  it('renders a skeleton if attribute type is loading', async () => {
    mockUsePersonAttributeType.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    fieldDefinition = {
      id: 'referredBy',
      uuid: 'attribute-uuid',
      label: 'Attribute',
      showHeading: true,
      type: 'person attribute',
    };

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <PersonAttributeField fieldDefinition={fieldDefinition} />
        </Form>
      </Formik>,
    );

    await screen.findByRole('heading', { name: /attribute/i });
    expect(screen.queryByLabelText(/referred by/i)).not.toBeInTheDocument();
  });
});
