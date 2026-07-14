import { reportError, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';

import { useConceptAnswers } from '../field.resource';

const mockReportError = vi.mocked(reportError);
const mockUseSession = vi.mocked(useSession);

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
    vi.clearAllMocks();
    mockReportError.mockImplementation(() => undefined);
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [{ display: 'Get Concepts', name: 'Get Concepts' }],
      },
    } as ReturnType<typeof useSession>);
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

    expect(screen.getByLabelText('Referred by (optional)')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Select an option' })).toBeInTheDocument();
    expect(screen.getByText(/Option 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Option 2/i)).toBeInTheDocument();
  });

  it('does not select the first searchable answer by default', () => {
    render(
      <Formik initialValues={{ attributes: {} }} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="ethnicity"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label="Etnia"
            customConceptAnswers={[]}
            required={false}
            searchable
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('combobox', { name: /etnia/i })).toHaveValue('');
    expect(screen.queryByDisplayValue('Option 1')).not.toBeInTheDocument();
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

  it('renders coded answers as radios, preserves the current value, and allows clearing optional fields', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <Formik initialValues={{ attributes: { [personAttributeType.uuid]: 'B' } }} onSubmit={handleSubmit}>
        <Form>
          <CodedPersonAttributeField
            id="bloodGroup"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label="Grupo sanguíneo"
            customConceptAnswers={[
              { uuid: 'A', label: 'A' },
              { uuid: 'B', label: 'B' },
              { uuid: 'AB', label: 'AB' },
              { uuid: 'O', label: 'O' },
            ]}
            codedInputType="radio"
            required={false}
          />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Not specified' })).not.toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'A' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(handleSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ attributes: { [personAttributeType.uuid]: 'A' } }),
        expect.anything(),
      ),
    );

    await user.click(screen.getByRole('radio', { name: 'Not specified' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(handleSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ attributes: { [personAttributeType.uuid]: '' } }),
        expect.anything(),
      ),
    );
  });

  it('does not request remote answers and explains the unavailable optional field without Get Concepts', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { privileges: [] },
    } as ReturnType<typeof useSession>);

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

    expect(screen.queryByLabelText('Referred by (optional)')).not.toBeInTheDocument();
    expect(screen.getByText('No se pudo cargar Referred by')).toBeInTheDocument();
    expect(screen.getByText(/campo opcional no está disponible/i)).toBeInTheDocument();
    expect(mockUseConceptAnswers).toHaveBeenCalledWith('');
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('shows a blocking message when a required field cannot be loaded without Get Concepts', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { privileges: [] },
    } as ReturnType<typeof useSession>);

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText(/campo obligatorio no está disponible/i)).toBeInTheDocument();
    expect(mockUseConceptAnswers).toHaveBeenCalledWith('');
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('renders locally configured answers without Get Concepts', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { privileges: [] },
    } as ReturnType<typeof useSession>);

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[{ uuid: 'local-answer', label: 'Local answer' }]}
            required={false}
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('Local answer')).toBeInTheDocument();
    expect(mockUseConceptAnswers).toHaveBeenCalledWith('');
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('blocks values that are not members of the configured answer set when requested', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <Formik initialValues={{ attributes: { [personAttributeType.uuid]: 'PE' } }} onSubmit={handleSubmit}>
        <Form>
          <CodedPersonAttributeField
            id="attributeId"
            personAttributeType={personAttributeType}
            answerConceptSetUuid={answerConceptSetUuid}
            label={personAttributeType.display}
            customConceptAnswers={[]}
            required={false}
            enforceAnswerSetMembership
          />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(handleSubmit).not.toHaveBeenCalled());
    expect(screen.getByText('Select a valid option from the configured catalog')).toBeInTheDocument();
  });

  it('shows an inline warning without reporting a forbidden response as an invalid answer set', () => {
    mockUseConceptAnswers.mockReturnValue({
      data: [],
      isLoading: false,
      error: Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
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

    expect(screen.queryByLabelText('Referred by (optional)')).not.toBeInTheDocument();
    expect(screen.getByText('No se pudo cargar Referred by')).toBeInTheDocument();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('reports a missing concept as an invalid answer set', async () => {
    mockUseConceptAnswers.mockReturnValue({
      data: [],
      isLoading: false,
      error: Object.assign(new Error('Not found'), { response: { status: 404 } }),
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
    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(expect.stringMatching(/invalid answer concept set UUID/i));
    });
  });
});
