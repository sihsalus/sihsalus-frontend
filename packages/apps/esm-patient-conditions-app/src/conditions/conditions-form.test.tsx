import { type FetchResponse, openmrsFetch, showSnackbar, useSession } from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  getByTextWithMarkup,
  mockFhirConditionsResponse,
  mockPatient,
  mockSessionDataResponse,
  searchedCondition,
} from 'test-utils';
import { createCondition, useConditionsSearch } from './conditions.resource';
import ConditionsForm, { type ConditionFormProps } from './conditions-form.workspace';

dayjs.extend(utc);

const defaultProps: PatientWorkspace2DefinitionProps<ConditionFormProps, object> = {
  closeWorkspace: vi.fn(),
  groupProps: {
    patientUuid: mockPatient.id,
    patient: mockPatient as unknown as fhir.Patient,
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
  render(<ConditionsForm {...props} />);
}

const mockCreateCondition = vi.mocked(createCondition);
const mockUseConditionsSearch = vi.mocked(useConditionsSearch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSession = vi.mocked(useSession);

vi.mock('./conditions.resource', async () => ({
  ...(await vi.importActual('./conditions.resource')),
  createCondition: vi.fn(),
  editCondition: vi.fn(),
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
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
  });

  it('renders the conditions form with all the relevant fields and values', () => {
    renderConditionsForm();

    expect(screen.getByRole('group', { name: /antecedent type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/onset date/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /clinical status/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /enter antecedent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /patol|patholog/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /surgical|quirúrgico/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear search input/i })).toBeInTheDocument();
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

    const conditionSearchInput = screen.getByRole('searchbox', { name: /enter antecedent/i });
    expect(screen.queryByRole('menuitem', { name: /Headache/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Headache')).not.toBeInTheDocument();

    await user.type(conditionSearchInput, 'Headache');
    expect(screen.getByDisplayValue(/headache/i)).toBeInTheDocument();
  });

  it('renders an error message when there are no conditions that match the search query', async () => {
    const user = userEvent.setup();
    renderConditionsForm();

    const conditionSearchInput = screen.getByRole('searchbox', { name: /enter antecedent/i });
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
    const conditionSearchInput = screen.getByRole('searchbox', { name: /enter antecedent/i });

    const onsetDateInput = screen.getByRole('textbox', { name: /onset date/i });
    expect(onsetDateInput).toBeInTheDocument();

    expect(cancelButton).toBeEnabled();

    await user.click(antecedentTypeInput);
    await user.type(conditionSearchInput, 'Headache');
    await user.click(screen.getByRole('button', { name: /headache/i }));
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
      subtitle: 'It is now visible on the Antecedents page',
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

  it('does not submit a FHIR Condition when the session has no clinical provider', async () => {
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
    await user.type(screen.getByRole('searchbox', { name: /enter antecedent/i }), 'Headache');
    await user.click(screen.getByRole('button', { name: /headache/i }));
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

    await user.type(screen.getByRole('searchbox', { name: /enter antecedent/i }), 'Headache');
    await user.click(screen.getByRole('button', { name: /headache/i }));
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
    const conditionSearchInput = screen.getByRole('searchbox', { name: /enter antecedent/i });
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
    await user.click(screen.getByRole('button', { name: /Headache/i }));
    await user.click(onsetDateInput);
    await user.paste('2020-05-05');
    await user.click(activeStatusInput);
    expect(activeStatusInput).toBeChecked();
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);
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

    const conditionSearchInput = screen.getByRole('searchbox', { name: /enter antecedent/i });
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
    await user.click(screen.getByRole('button', { name: /headache/i }));
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
      subtitle: 'It is now visible on the Antecedents page',
      title: 'Antecedent saved',
    });
  });

  it('launching the form with an existing condition prepopulates the form with the condition details', async () => {
    const user = userEvent.setup();

    const conditionToEdit = {
      clinicalStatus: 'Active',
      conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      display: 'Hypertension',
      abatementDateTime: undefined,
      onsetDateTime: '2020-08-19T00:00:00+00:00',
      recordedDate: '2020-08-19T18:34:48+00:00',
      id: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
    };

    mockOpenmrsFetch.mockResolvedValue({ data: mockFhirConditionsResponse } as FetchResponse);

    renderConditionsForm({ condition: conditionToEdit, formContext: 'editing' });

    expect(screen.queryByRole('searchbox', { name: /enter antecedent/i })).not.toBeInTheDocument();

    const inactiveStatusInput = screen.getByLabelText(/inactive/i);
    const antecedentTypeInput = screen.getByRole('radio', { name: /patol|patholog/i });
    const submitButton = screen.getByRole('button', { name: /save & close/i });

    await user.click(antecedentTypeInput);
    await user.click(inactiveStatusInput);
    await user.click(submitButton);
  });
});
