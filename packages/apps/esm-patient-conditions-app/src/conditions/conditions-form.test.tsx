import { type FetchResponse, openmrsFetch, showSnackbar, usePatient, useSession } from '@openmrs/esm-framework';
import { type Condition, type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { TFunction } from 'i18next';
import {
  getByTextWithMarkup,
  mockFhirConditionsResponse,
  mockPatient,
  mockSessionDataResponse,
  searchedCondition,
} from 'test-utils';
import { createCondition, updateCondition, useConditions, useConditionsSearch } from './conditions.resource';
import ConditionsForm, { type ConditionFormProps, createSchema } from './conditions-form.workspace';

dayjs.extend(utc);

const defaultProps: PatientWorkspace2DefinitionProps<ConditionFormProps, object> = {
  closeWorkspace: vi.fn(),
  groupProps: {
    patientUuid: mockPatient.id,
    patient: { resourceType: 'Patient', id: mockPatient.id, birthDate: '1986-04-03' },
    visitContext: null,
    mutateVisitContext: null,
  },
  workspaceName: '',
  launchChildWorkspace: vi.fn(),
  workspaceProps: {
    condition: null,
    formContext: 'creating' as 'creating' | 'editing',
  },
  windowProps: {},
  windowName: '',
  isRootWorkspace: false,
  showActionMenu: true,
};

function renderConditionsForm(workspaceProps?: ConditionFormProps) {
  const props = {
    ...defaultProps,
    workspaceProps: {
      ...defaultProps.workspaceProps,
      ...workspaceProps,
    },
  };
  return render(<ConditionsForm {...props} />);
}

const mockCreateCondition = vi.mocked(createCondition);
const mockUseConditionsSearch = vi.mocked(useConditionsSearch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSession = vi.mocked(useSession);

vi.mock('./conditions.resource', async () => ({
  ...(await vi.importActual('./conditions.resource')),
  createCondition: vi.fn(),
  updateCondition: vi.fn(),
  useConditions: vi.fn(),
  useConditionsSearch: vi.fn(),
}));

mockOpenmrsFetch.mockResolvedValue({ data: [] } as FetchResponse);
mockUseConditionsSearch.mockReturnValue({
  searchResults: [],
  error: null,
  isSearching: false,
});

mockCreateCondition.mockResolvedValue({ status: 201, body: 'Condition created' } as unknown as FetchResponse);

describe('Conditions form', () => {
  beforeEach(() => {
    mockUseConditionsSearch.mockReturnValue({ searchResults: [], error: null, isSearching: false });
    vi.mocked(usePatient).mockReturnValue({
      patient: defaultProps.groupProps.patient,
      isLoading: false,
      error: null,
      patientUuid: mockPatient.id,
    });
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
    mockCreateCondition.mockResolvedValue({ data: undefined } as FetchResponse);
    vi.mocked(useConditions).mockReturnValue({
      conditions: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(updateCondition).mockResolvedValue(undefined);
  });

  it('renders the conditions form with all the relevant fields and values', () => {
    renderConditionsForm();

    expect(screen.getByRole('group', { name: /antecedent type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/onset date/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /clinical status/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /antecedent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /patol|patholog/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /surgical|quirúrgico/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^active/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^active/i)).not.toBeChecked();
    expect(screen.getByLabelText(/inactive/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inactive/i)).not.toBeChecked();

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    const submitButton = screen.getByRole('button', { name: /Save & close/i });
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toBeEnabled();
    expect(submitButton).toBeInTheDocument();
  });

  it('rejects an onset date earlier than the patient birth date with a descriptive error', () => {
    const t = ((_key: string, defaultValue: string) => defaultValue) as TFunction;
    const schema = createSchema('creating', t, '2019-09-25');

    const result = schema.safeParse({
      abatementDateTime: null,
      antecedentType: 'pathological',
      clinicalStatus: 'active',
      conditionName: 'Headache',
      onsetDateTime: new Date(2019, 8, 24),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['onsetDateTime'],
          message: "Onset date cannot be earlier than the patient's birth date",
        }),
      );
    }
  });

  it('allows a relative antecedent before the patient birth date while preserving its family category', async () => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    expect(
      createSchema('creating', t, '2019-09-25').safeParse({
        abatementDateTime: null,
        antecedentType: 'family',
        clinicalStatus: 'active',
        conditionName: 'Synthetic family antecedent',
        onsetDateTime: new Date(2018, 8, 24),
      }).success,
    ).toBe(true);

    mockUseConditionsSearch.mockReturnValue({ searchResults: searchedCondition, error: null, isSearching: false });
    const user = userEvent.setup();
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /family|familiar/i }));
    await user.type(screen.getByRole('combobox', { name: /antecedent/i }), 'Headache');
    await user.click(screen.getByRole('option', { name: /headache/i }));
    await user.click(screen.getByRole('textbox', { name: /onset date/i }));
    await user.paste(dayjs(mockPatient.birthdate).subtract(1, 'year').format('YYYY-MM-DD'));
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /save.*close/i }));
    expect(mockCreateCondition).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        antecedentType: 'family',
        clinicalStatus: 'active',
        onsetDateTime: expect.any(String),
      }),
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'It is now visible in Antecedents' }),
    );
  });

  it('limits new narrative descriptions before any write without truncating pasted text silently', () => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    const data = {
      abatementDateTime: null,
      antecedentType: 'family',
      clinicalStatus: 'active',
      conditionName: '',
      nonCodedText: 'x'.repeat(256),
      onsetDateTime: null,
    };
    expect(createSchema('creating', t).safeParse(data).success).toBe(false);
    expect(createSchema('creating', t).safeParse({ ...data, nonCodedText: 'x'.repeat(255) }).success).toBe(true);
  });

  it('closes the form and the workspace when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderConditionsForm();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('setting the status of a condition to "inactive" reveals the end date input field', async () => {
    const user = userEvent.setup();
    renderConditionsForm();

    await user.click(screen.getByRole('radio', { name: 'Active' }));
    expect(screen.queryByLabelText('End date')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/inactive/i));
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });

  it('renders a list of matching conditions when the user types a query into the searchbox', async () => {
    const user = userEvent.setup();
    renderConditionsForm();

    const conditionSearchInput = screen.getByRole('combobox', { name: /antecedent/i });
    expect(screen.queryByRole('menuitem', { name: /Headache/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Headache')).not.toBeInTheDocument();

    await user.type(conditionSearchInput, 'Headache');
    expect(screen.getByDisplayValue(/headache/i)).toBeInTheDocument();
  });

  it('renders an error message when there are no conditions that match the search query', async () => {
    const user = userEvent.setup();
    renderConditionsForm();

    const conditionSearchInput = screen.getByRole('combobox', { name: /antecedent/i });
    expect(screen.queryByRole('menuitem', { name: /Post-acute sequelae of COVID-19/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Post-acute sequelae of COVID-19/i)).not.toBeInTheDocument();

    await user.type(conditionSearchInput, 'Post-acute sequelae of COVID-19');
    expect(getByTextWithMarkup('No results for "Post-acute sequelae of COVID-19"')).toBeInTheDocument();
  });

  it('renders a success notification upon successfully recording a condition', async () => {
    const user = userEvent.setup();

    mockUseConditionsSearch.mockReturnValue({
      searchResults: searchedCondition,
      error: null,
      isSearching: false,
    });
    mockOpenmrsFetch.mockResolvedValue({
      data: mockFhirConditionsResponse,
      mutate: Promise.resolve(undefined),
    } as unknown as FetchResponse);

    renderConditionsForm();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const submitButton = screen.getByRole('button', { name: /save & close/i });
    const activeStatusInput = screen.getByRole('radio', { name: 'Active' });
    const antecedentTypeInput = screen.getByRole('radio', { name: /patol|patholog/i });
    const conditionSearchInput = screen.getByRole('combobox', { name: /antecedent/i });

    const onsetDateInput = screen.getByRole('textbox', { name: /onset date/i });
    expect(onsetDateInput).toBeInTheDocument();

    expect(cancelButton).toBeEnabled();

    await user.click(antecedentTypeInput);
    await user.type(conditionSearchInput, 'Headache');
    await user.click(screen.getByRole('option', { name: /headache/i }));
    await user.click(activeStatusInput);
    await user.click(onsetDateInput);
    await user.paste('2020-05-05');
    expect(onsetDateInput).toHaveDisplayValue(/05\/05\/2020/i);
    expect(submitButton).toBeEnabled();
    const form = submitButton.closest('form');
    if (!form) {
      throw new Error('Expected save & close button to be inside a form');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalled();
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      subtitle: 'It is now visible in Active problems',
      title: 'Antecedent saved',
    });
    expect(mockCreateCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        antecedentType: 'pathological',
        clinicalStatus: 'active',
        providerUuid: mockSessionDataResponse.data.currentProvider.uuid,
      }),
    );
  });

  it('does not submit an antecedent when the session has no clinical provider', async () => {
    const user = userEvent.setup();

    mockUseSession.mockReturnValue({
      ...mockSessionDataResponse.data,
      currentProvider: undefined,
    });
    mockUseConditionsSearch.mockReturnValue({
      searchResults: searchedCondition,
      error: null,
      isSearching: false,
    });

    renderConditionsForm();

    await user.click(screen.getByRole('radio', { name: /patol|patholog/i }));
    await user.type(screen.getByRole('combobox', { name: /antecedent/i }), 'Headache');
    await user.click(screen.getByRole('option', { name: /headache/i }));
    await user.click(screen.getByLabelText(/^active/i));
    await user.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/session is not linked to a clinical provider/i)).toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
  });

  it('preconfigures procedure and surgery workspaces before posting to the backend resource', async () => {
    const user = userEvent.setup();

    mockUseConditionsSearch.mockReturnValue({
      searchResults: searchedCondition,
      error: null,
      isSearching: false,
    });
    mockOpenmrsFetch.mockResolvedValue({
      data: mockFhirConditionsResponse,
      mutate: Promise.resolve(undefined),
    } as unknown as FetchResponse);
    mockCreateCondition.mockResolvedValue({ status: 201, body: 'Condition created' } as unknown as FetchResponse);

    renderConditionsForm({
      defaultAntecedentType: 'surgical',
      defaultClinicalStatus: 'inactive',
      formContext: 'creating',
      lockedAntecedentType: true,
      workspaceTitle: 'Record procedure or surgery',
    });

    expect(screen.getByRole('radio', { name: /surgical|quirúrgico/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /surgical|quirúrgico/i })).toBeDisabled();
    expect(screen.getByLabelText(/inactive/i)).toBeChecked();

    await user.type(screen.getByRole('combobox', { name: /antecedent/i }), 'Headache');
    await user.click(screen.getByRole('option', { name: /headache/i }));
    await user.click(screen.getByRole('textbox', { name: /onset date/i }));
    await user.paste('2020-05-05');
    await user.click(screen.getByRole('button', { name: /save & close/i }));

    await waitFor(() =>
      expect(mockCreateCondition).toHaveBeenCalledWith(
        expect.objectContaining({
          antecedentType: 'surgical',
          clinicalStatus: 'inactive',
        }),
      ),
    );
  });

  it('renders an error notification if there was a problem recording a condition', async () => {
    const user = userEvent.setup();

    mockUseConditionsSearch.mockReturnValue({
      searchResults: searchedCondition,
      error: null,
      isSearching: false,
    });

    renderConditionsForm();

    const submitButton = screen.getByRole('button', { name: /save & close/i });
    const activeStatusInput = screen.getByRole('radio', { name: 'Active' });
    const antecedentTypeInput = screen.getByRole('radio', { name: /patol|patholog/i });
    const conditionSearchInput = screen.getByRole('combobox', { name: /antecedent/i });
    const onsetDateInput = screen.getByRole('textbox', { name: /onset date/i });

    const error = {
      message: 'Internal Server Error',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mockCreateCondition.mockRejectedValue(error);
    await user.click(antecedentTypeInput);
    await user.type(conditionSearchInput, 'Headache');
    await user.click(screen.getByRole('option', { name: /Headache/i }));
    await user.click(onsetDateInput);
    await user.paste('2020-05-05');
    await user.click(activeStatusInput);
    expect(activeStatusInput).toBeChecked();
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);
    expect(await screen.findByText('The antecedent could not be saved. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Internal Server Error')).not.toBeInTheDocument();
    expect(submitButton).toBeEnabled();
  });

  it('waits for the verified patient before allowing creation', async () => {
    vi.mocked(usePatient).mockReturnValue({ patient: null, isLoading: true, error: null, patientUuid: mockPatient.id });
    const props = { ...defaultProps, groupProps: { ...defaultProps.groupProps, patient: undefined } };
    const view = render(<ConditionsForm {...props} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save.*close/i })).not.toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
    vi.mocked(usePatient).mockReturnValue({
      patient: defaultProps.groupProps.patient,
      isLoading: false,
      error: null,
      patientUuid: mockPatient.id,
    });
    view.rerender(<ConditionsForm {...props} />);
    expect(await screen.findByRole('button', { name: /save.*close/i })).toBeEnabled();
  });

  it('blocks creation when patient verification fails', () => {
    vi.mocked(usePatient).mockReturnValue({
      patient: null,
      isLoading: false,
      error: new Error('Synthetic patient lookup failed'),
      patientUuid: mockPatient.id,
    });
    render(<ConditionsForm {...defaultProps} groupProps={{ ...defaultProps.groupProps, patient: undefined }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save.*close/i })).not.toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
  });

  it('shows a safe read-only explanation for an unsupported historical status', () => {
    const condition: Condition = {
      id: 'synthetic-historical-condition',
      conceptId: 'synthetic-concept',
      display: 'Synthetic historical antecedent',
      clinicalStatus: 'History_of',
      antecedentType: 'pathological',
      source: {
        uuid: 'synthetic-historical-condition',
        patient: { uuid: mockPatient.id },
        condition: { coded: { uuid: 'synthetic-concept', display: 'Synthetic historical antecedent' } },
        clinicalStatus: 'HISTORY_OF',
        voided: false,
      },
    };
    vi.mocked(useConditions).mockReturnValue({
      conditions: [condition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderConditionsForm({ condition, formContext: 'editing' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This historical clinical status cannot be edited from this form.',
    );
    expect(screen.queryByRole('button', { name: /save.*close/i })).not.toBeInTheDocument();
    expect(updateCondition).not.toHaveBeenCalled();
  });

  it('keeps historical date precision and the original clinical status on an untouched edit', async () => {
    const condition: Condition = {
      id: 'synthetic-historical-condition',
      conceptId: 'synthetic-concept',
      display: 'Synthetic historical antecedent',
      clinicalStatus: 'Remission',
      antecedentType: 'pathological',
      onsetDateTime: '2020',
      abatementDateTime: '2021-02',
      source: {
        uuid: 'synthetic-historical-condition',
        patient: { uuid: mockPatient.id },
        condition: { coded: { uuid: 'synthetic-concept', display: 'Synthetic historical antecedent' }, nonCoded: null },
        clinicalStatus: 'REMISSION',
        onsetDate: '2020',
        endDate: '2021-02',
        additionalDetail: null,
        voided: false,
      },
    };
    vi.mocked(useConditions).mockReturnValue({
      conditions: [condition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderConditionsForm({ condition, formContext: 'editing' });
    expect(screen.getByText(/2020.*2021-02/)).toBeInTheDocument();
    expect(screen.getByText('Recorded clinical status: Remission')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Save.*close/i }));
    expect(updateCondition).toHaveBeenCalledExactlyOnceWith(
      condition.id,
      expect.objectContaining({
        originalCondition: condition.source,
        clinicalStatus: 'remission',
        onsetDateTime: undefined,
        abatementDateTime: undefined,
      }),
    );
  });

  it('validates the form against the provided zod schema before submitting it', async () => {
    const user = userEvent.setup();

    mockUseConditionsSearch.mockReturnValue({
      searchResults: searchedCondition,
      error: null,
      isSearching: false,
    });

    mockCreateCondition.mockResolvedValue({ status: 201, body: 'Condition created' } as unknown as FetchResponse);

    renderConditionsForm();

    const conditionSearchInput = screen.getByRole('combobox', { name: /antecedent/i });
    const antecedentTypeInput = screen.getByRole('radio', { name: /patol|patholog/i });
    const submitButton = screen.getByRole('button', { name: /save & close/i });
    const form = submitButton.closest('form');
    if (!form) {
      throw new Error('Expected save & close button to be inside a form');
    }
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/an antecedent is required/i)).toBeInTheDocument());
    expect(screen.getByText(/an antecedent type is required/i)).toBeInTheDocument();
    expect(screen.getByText(/a clinical status is required/i)).toBeInTheDocument();

    await user.type(conditionSearchInput, 'Headache');
    await user.click(screen.getByRole('option', { name: /headache/i }));
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/a clinical status is required/i)).toBeInTheDocument());
    expect(screen.getByText(/an antecedent type is required/i)).toBeInTheDocument();

    await user.click(antecedentTypeInput);
    await user.click(screen.getByLabelText(/^active/i));
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByText(/an antecedent is required/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/an antecedent type is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/a clinical status is required/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalled();
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      subtitle: 'It is now visible in Active problems',
      title: 'Antecedent saved',
    });
  });

  it('launching the form with an existing condition prepopulates the form with the condition details', async () => {
    const user = userEvent.setup();

    const conditionToEdit = {
      source: {
        uuid: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
        patient: { uuid: mockPatient.id },
        condition: { coded: { uuid: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Hypertension' }, nonCoded: null },
        clinicalStatus: 'ACTIVE',
        onsetDate: '2020-08-19T00:00:00+00:00',
        endDate: null,
        additionalDetail: null,
        auditInfo: { dateCreated: '2020-08-19T18:34:48+00:00' },
        voided: false,
      },
      clinicalStatus: 'Active',
      conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      display: 'Hypertension',
      abatementDateTime: undefined,
      onsetDateTime: '2020-08-19T00:00:00+00:00',
      recordedDate: '2020-08-19T18:34:48+00:00',
      id: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
    };

    mockOpenmrsFetch.mockResolvedValue({ data: mockFhirConditionsResponse } as FetchResponse);

    vi.mocked(useConditions).mockReturnValue({
      conditions: [conditionToEdit],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn().mockResolvedValue(undefined),
    });
    renderConditionsForm({ condition: conditionToEdit, formContext: 'editing' });

    expect(screen.queryByRole('searchbox', { name: /enter antecedent/i })).not.toBeInTheDocument();

    const inactiveStatusInput = screen.getByLabelText(/inactive/i);
    const antecedentTypeInput = screen.getByRole('radio', { name: /patol|patholog/i });
    const submitButton = screen.getByRole('button', { name: /save & close/i });

    await user.click(antecedentTypeInput);
    await user.click(inactiveStatusInput);
    await user.click(submitButton);
    expect(updateCondition).toHaveBeenCalledExactlyOnceWith(
      conditionToEdit.id,
      expect.objectContaining({
        originalCondition: conditionToEdit.source,
        clinicalStatus: 'inactive',
        onsetDateTime: undefined,
      }),
    );
  });
  it.each([
    { label: /other|otro/i, type: 'other' },
    { label: /family|familiar/i, type: 'family' },
    { label: /surgical|quirúrgico/i, type: 'surgical' },
  ])('creates a $type narrative antecedent without a fabricated concept UUID', async ({ label, type }) => {
    const user = userEvent.setup();
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: label }));
    expect(screen.getByRole('textbox', { name: 'Non-coded antecedent' })).toHaveAttribute('maxlength', '255');
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic narrative antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    expect(createCondition).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        nonCodedText: 'Synthetic narrative antecedent',
        conceptId: '',
        antecedentType: type,
      }),
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'It is now visible in Antecedents' }),
    );
  });

  it.each([
    'family',
    'surgical',
  ] as const)('keeps the %s destination in the confirmation when its category was not edited', async (antecedentType) => {
    const condition: Condition = {
      id: 'synthetic-existing-narrative',
      conceptId: '',
      display: 'Synthetic narrative antecedent',
      nonCodedText: 'Synthetic narrative antecedent',
      clinicalStatus: 'Active',
      antecedentType,
      source: {
        uuid: 'synthetic-existing-narrative',
        patient: { uuid: mockPatient.id },
        condition: { coded: null, nonCoded: 'Synthetic narrative antecedent' },
        clinicalStatus: 'ACTIVE',
        onsetDate: null,
        endDate: null,
        additionalDetail: `__sihsalus_antecedent_type:${antecedentType}`,
        voided: false,
      },
    };
    vi.mocked(useConditions).mockReturnValue({
      conditions: [condition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderConditionsForm({ condition, formContext: 'editing' });
    await userEvent.setup().click(screen.getByRole('button', { name: /save & close/i }));
    expect(updateCondition).toHaveBeenCalledExactlyOnceWith(
      condition.id,
      expect.objectContaining({ antecedentType: undefined, originalCondition: condition.source }),
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: 'It is now visible in Antecedents' }),
    );
  });

  it('submits once and freezes the form while a write is pending', async () => {
    const user = userEvent.setup();
    let finishWrite: (response: Awaited<ReturnType<typeof createCondition>>) => void;
    mockCreateCondition.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    );
    const view = renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /otro|other/i }));
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic pending antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    const form = screen.getByRole('button', { name: /save & close/i }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(createCondition).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Non-coded antecedent' })).toBeDisabled();
    view.rerender(<ConditionsForm {...defaultProps} />);
    expect(createCondition).toHaveBeenCalledTimes(1);
    await act(async () => finishWrite({ data: undefined } as FetchResponse));
    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('reports a confirmed save when refreshing fails and prevents another POST', async () => {
    const user = userEvent.setup();
    vi.mocked(useConditions).mockReturnValue({
      conditions: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn().mockRejectedValue(new Error('Synthetic refresh error')),
    });
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /otro|other/i }));
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic saved antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    const form = screen.getByRole('button', { name: /save & close/i }).closest('form');
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Antecedent saved',
        subtitle: expect.stringMatching(/Saved.*Reload/),
      }),
    );
    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
    fireEvent.submit(form);
    await waitFor(() => expect(createCondition).toHaveBeenCalledTimes(1));
  });

  it('locks an uncertain write without announcing success and lets the clinician close the form', async () => {
    mockCreateCondition.mockRejectedValueOnce(
      Object.assign(new Error('Synthetic unconfirmed response'), { code: 'CONDITION_WRITE_UNCONFIRMED' }),
    );
    const user = userEvent.setup();
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /other|otro/i }));
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic uncertain antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    const form = screen.getByRole('button', { name: /save & close/i }).closest('form');
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    expect(screen.getByRole('button', { name: 'Save unconfirmed' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Non-coded antecedent' })).toBeDisabled();
    expect(screen.getByText(/The save could not be confirmed.*reload the history/)).toBeInTheDocument();
    expect(screen.queryByText('Antecedent saved')).not.toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(createCondition).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('allows correcting and retrying a request explicitly rejected by the server', async () => {
    mockCreateCondition.mockRejectedValueOnce({ response: { status: 400 }, message: 'Synthetic rejected detail' });
    const user = userEvent.setup();
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /other|otro/i }));
    const narrative = screen.getByRole('textbox', { name: 'Non-coded antecedent' });
    await user.type(narrative, 'Synthetic rejected antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    expect(screen.getByRole('button', { name: /save & close/i })).toBeEnabled();
    expect(screen.queryByText('Synthetic rejected detail')).not.toBeInTheDocument();
    await user.clear(narrative);
    await user.type(narrative, 'Synthetic corrected antecedent');
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    expect(createCondition).toHaveBeenCalledTimes(2);
    expect(createCondition).toHaveBeenLastCalledWith(
      expect.objectContaining({ nonCodedText: 'Synthetic corrected antecedent' }),
    );
    expect(defaultProps.closeWorkspace).toHaveBeenCalledOnce();
  });

  it('does not close a replacement form when a previous patient write completes', async () => {
    const user = userEvent.setup();
    let finishWrite: (response: Awaited<ReturnType<typeof createCondition>>) => void;
    mockCreateCondition.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    );
    const view = renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /otro|other/i }));
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic pending antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /save & close/i }));
    view.unmount();
    await act(async () => finishWrite({ data: undefined } as FetchResponse));
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    'throws',
    'rejects',
  ] as const)('keeps a confirmed save locked if closing the workspace %s', async (failure) => {
    if (failure === 'throws') {
      vi.mocked(defaultProps.closeWorkspace).mockImplementationOnce(() => {
        throw new Error('Synthetic workspace close error');
      });
    } else {
      vi.mocked(defaultProps.closeWorkspace).mockRejectedValueOnce(new Error('Synthetic workspace close rejection'));
    }
    const user = userEvent.setup();
    renderConditionsForm();
    await user.click(screen.getByRole('radio', { name: /other|otro/i }));
    await user.type(screen.getByRole('textbox', { name: 'Non-coded antecedent' }), 'Synthetic saved antecedent');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    const form = screen.getByRole('button', { name: /save.*close/i }).closest('form');
    await user.click(screen.getByRole('button', { name: /save.*close/i }));
    expect(createCondition).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Antecedent saved' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    fireEvent.submit(form);
    await waitFor(() => expect(createCondition).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Error creating antecedent')).not.toBeInTheDocument();
  });

  it.each([
    { clinicalStatus: '' },
    { abatementDateTime: new Date('2999-01-01') },
    { abatementDateTime: new Date('2025-01-01') },
    { antecedentType: 'synthetic-unsupported-type' },
  ])('rejects invalid clinical values: %j', (invalid) => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    expect(
      createSchema('editing', t).safeParse({
        conditionName: '',
        antecedentType: 'family',
        clinicalStatus: 'inactive',
        onsetDateTime: new Date('2026-01-01'),
        abatementDateTime: null,
        ...invalid,
      }).success,
    ).toBe(false);
  });
  it('shows a safe search error instead of claiming there are no matching concepts', async () => {
    mockUseConditionsSearch.mockReturnValue({
      searchResults: [],
      error: new Error('Synthetic private search detail'),
      isSearching: false,
    });
    renderConditionsForm();
    await userEvent.setup().type(screen.getByRole('combobox', { name: /antecedent/i }), 'Synthetic query');
    expect(screen.getByRole('alert')).toHaveTextContent('Antecedent search is unavailable. Please try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Synthetic private search detail');
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
  });
});

it('reports a clinical-status error when a new active antecedent retains an end date', () => {
  const t = ((_key: string, fallback: string) => fallback) as TFunction;
  const result = createSchema('creating', t).safeParse({
    conditionName: 'Synthetic antecedent',
    antecedentType: 'pathological',
    antecedentScope: 'personal',
    personalCategory: 'pathological',
    clinicalStatus: 'active',
    onsetDateTime: new Date('2020-01-01'),
    abatementDateTime: new Date('2021-01-01'),
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ['clinicalStatus'],
        message: 'An active antecedent cannot have an end date. Review its clinical status and end date.',
      }),
    );
  }
});

it('blocks reclassifying a narrative antecedent as a definitive diagnosis without changing historical records', () => {
  const t = ((_key: string, fallback: string) => fallback) as TFunction;
  const originalCondition: Condition = {
    id: 'synthetic-narrative',
    display: 'Synthetic narrative',
    conceptId: '',
    nonCodedText: 'Synthetic narrative',
    antecedentType: 'family',
    clinicalStatus: 'Inactive',
    source: {
      uuid: 'synthetic-narrative',
      patient: { uuid: mockPatient.id },
      condition: { nonCoded: 'Synthetic narrative' },
      clinicalStatus: 'INACTIVE',
      additionalDetail: '__sihsalus_antecedent_type:family',
      voided: false,
    },
  };
  const data = {
    conditionName: '',
    antecedentType: 'definitive-diagnosis',
    clinicalStatus: 'inactive',
    onsetDateTime: null,
    abatementDateTime: null,
  };
  const result = createSchema('editing', t, undefined, originalCondition).safeParse(data);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ['antecedentType'],
        message: 'A definitive diagnosis requires a coded concept.',
      }),
    );
  }
  expect(
    createSchema('editing', t, undefined, { ...originalCondition, antecedentType: 'definitive-diagnosis' }).safeParse(
      data,
    ).success,
  ).toBe(true);
});
