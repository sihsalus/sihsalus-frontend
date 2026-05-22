import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { type ConfigObject, configSchema } from '../config-schema';
import { useConditions } from './conditions.resource';
import ConditionsOverview from './conditions-overview.component';

vi.mock('./conditions.resource', async () => {
  const actual = await vi.importActual('./conditions.resource');

  return {
    ...actual,
    useConditions: vi.fn(),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseConditions = vi.mocked(useConditions);

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  conditionPageSize: 5,
});

describe('ConditionsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an empty state view if conditions data is unavailable', async () => {
    mockUseConditions.mockReturnValue({
      conditions: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /conditions/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no conditions to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/record conditions/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching conditions', async () => {
    const error = {
      name: 'UnauthorizedError',
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };

    mockUseConditions.mockReturnValue({
      conditions: null,
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/Error 401: Unauthorized/i)).toBeInTheDocument();
    expect(screen.getByText(/Sorry, there was a problem displaying this information./i)).toBeInTheDocument();
  });

  it("renders an overview of the patient's conditions when present", async () => {
    const user = userEvent.setup();

    mockUseConditions.mockReturnValue({
      conditions: [
        {
          clinicalStatus: 'Active',
          conceptId: '138571AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'HIV Positive',
          id: 'cbffbb42-41b4-4c38-bc14-842ef675df85',
          onsetDateTime: '2021-05-15T21:00:00+00:00',
          recordedDate: '2021-05-17T07:07:43+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '160148AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Malaria, confirmed',
          id: 'b648963a-8258-4131-a7fc-257f2a347435',
          onsetDateTime: '2021-05-04T21:00:00+00:00',
          recordedDate: '2021-05-05T10:09:33+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '160155AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Malaria sevère',
          id: '9479e872-c9ca-48cc-82ee-273d67c41187',
          onsetDateTime: '2021-01-27T00:00:00+00:00',
          recordedDate: '2021-01-28T09:09:27+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '121629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Anaemia',
          id: 'c1006bd4-0b21-4305-9eba-c9c647534502',
          onsetDateTime: '2021-01-27T00:00:00+00:00',
          recordedDate: '2021-01-28T09:09:27+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:34:48+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: 'e3a3f9e2-73fe-4793-a2eb-0b4fcd00b271',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:42:10+00:00',
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: '08c4dbcb-b474-4843-8e62-7096ff6dd6a2',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:42:25+00:00',
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    expect(screen.getByRole('heading', { name: /conditions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();

    const expectedColumnHeaders = [/condition/, /date of onset/, /status/];
    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    const expectedTableRows = [/hiv positive/, /malaria, confirmed/, /malaria sevère/, /anaemia/, /hypertension/];
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row').length).toEqual(6);
    expect(screen.getByText(/1–5 of 7 items/i)).toBeInTheDocument();

    const nextPageButton = screen.getByRole('button', { name: /next page/i });

    await user.click(nextPageButton);

    expect(screen.getAllByRole('row').length).toEqual(3);
  });

  it('clicking the Add button or Record Conditions link launches the conditions form', async () => {
    const user = userEvent.setup();

    mockUseConditions.mockReturnValue({
      conditions: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    const recordConditionsLink = screen.getByRole('button', { name: /record conditions/i });

    await user.click(recordConditionsLink);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledTimes(1);
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('conditions-form-workspace', { formContext: 'creating' });
  });
});
