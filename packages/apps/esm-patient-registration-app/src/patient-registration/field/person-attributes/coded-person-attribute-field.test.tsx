import { reportError, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import type { MockInstance } from 'vitest';

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
  let consoleSpy: MockInstance;

  beforeEach(() => {
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
      error: null,
    });

    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders an error if there is no concept answer set provided', async () => {
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

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(
        expect.stringMatching(/has been defined without an answer concept set UUID/i),
      );
    });
  });

  it('renders an error if the concept answer set does not have any concept answers', async () => {
    mockUseConceptAnswers.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
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

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(expect.stringMatching(/does not have any concept answers/i));
    });
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
      error: null,
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

  it('does not request or render remote answers when the user lacks Get Concepts', () => {
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

  it('does not report a forbidden concept response as an invalid answer set', () => {
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

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(expect.stringMatching(/invalid answer concept set UUID/i));
    });
  });
});
