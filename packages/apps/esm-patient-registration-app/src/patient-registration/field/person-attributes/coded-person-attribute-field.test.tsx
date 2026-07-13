import { render, screen } from '@testing-library/react';
import { Form, Formik } from 'formik';

import { useConceptAnswers } from '../field.resource';

import { CodedPersonAttributeField } from './coded-person-attribute-field.component';

const mockUseConceptAnswers = vi.mocked(useConceptAnswers);

vi.mock('../field.resource', async () => ({
  ...(await vi.importActual('../field.resource')),
  useConceptAnswers: vi.fn(),
}));

describe('CodedPersonAttributeField', () => {
  const conceptAnswers = [
    { uuid: '1', display: 'Option 1' },
    { uuid: '2', display: 'Option 2' },
  ];

  const personAttributeType = {
    format: 'org.openmrs.Concept',
    display: 'Referred by',
    uuid: '4dd56a75-14ab-4148-8700-1f4f704dc5b0',
    name: '',
    description: '',
  };

  const answerConceptSetUuid = '6682d17f-0777-45e4-a39b-93f77eb3531c';
  beforeEach(() => {
    mockUseConceptAnswers.mockReturnValue({
      data: conceptAnswers,
      isLoading: false,
      error: undefined,
    });
  });

  it('renders a non-fatal inline warning if there is no concept answer set provided', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            answerConceptSetUuid={null}
            customConceptAnswers={[]}
            id="attributeId"
            label={personAttributeType.display}
            personAttributeType={personAttributeType}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('No se pudo cargar Referred by')).toBeInTheDocument();
    expect(screen.getByText(/campo opcional no está disponible/i)).toBeInTheDocument();
  });

  it('renders a non-fatal inline warning if the concept answer set has no answers', () => {
    mockUseConceptAnswers.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('No se pudo cargar Referred by')).toBeInTheDocument();
    expect(screen.queryByLabelText('Referred by (optional)')).not.toBeInTheDocument();
  });

  it('renders a non-fatal inline warning when the concept request fails', () => {
    mockUseConceptAnswers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('403'),
    });

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('No se pudo cargar Referred by')).toBeInTheDocument();
  });

  it('renders the conceptAnswers as select options', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByLabelText('Referred by (optional)')).toBeInTheDocument();
    expect(screen.getByText(/Option 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Option 2/i)).toBeInTheDocument();
  });

  it('renders set members as select options when the answer concept set is configured as a concept set', () => {
    mockUseConceptAnswers.mockReturnValue({
      data: [
        { uuid: 'set-member-1', display: 'Civil status option' },
        { uuid: 'set-member-2', display: 'Another civil status option' },
      ],
      isLoading: false,
      error: undefined,
    });

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('Civil status option')).toBeInTheDocument();
    expect(screen.getByText('Another civil status option')).toBeInTheDocument();
  });

  it('renders customConceptAnswers as select options when they are provided', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[
              {
                uuid: 'A',
                label: 'Special Option A',
              },
              {
                uuid: 'B',
                label: 'Special Option B',
              },
            ]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByLabelText('Referred by (optional)')).toBeInTheDocument();
    expect(screen.getByText(/Special Option A/i)).toBeInTheDocument();
    expect(screen.getByText(/Special Option B/i)).toBeInTheDocument();
    expect(screen.queryByText(/Option 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Option 2/i)).not.toBeInTheDocument();
  });
});
