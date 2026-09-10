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

  it('groups recurrence and relapse as active, remission and resolved as inactive, preserving their labels', async () => {
    const user = userEvent.setup();
    mockUseConditions.mockReturnValue({
      conditions: ['Recurrence', 'Relapse', 'Remission', 'Resolved'].map((clinicalStatus, index) => ({
        id: `synthetic-status-${index}`,
        clinicalStatus,
        conceptId: 'synthetic-concept',
        display: `Synthetic ${clinicalStatus} history`,
        source: {
          uuid: `synthetic-status-${index}`,
          patient: { uuid: mockPatient.id },
          condition: { coded: { uuid: 'synthetic-concept' } },
          clinicalStatus: clinicalStatus.toUpperCase(),
          voided: false,
        },
      })),
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(<ConditionsOverview patientUuid={mockPatient.id} />);
    const filter = screen.getByRole('combobox', { name: /show/i });
    await user.click(filter);
    await user.click(screen.getByRole('option', { name: /^active$/i }));
    expect(screen.getByRole('row', { name: /synthetic recurrence history.*recurrence/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /synthetic relapse history.*relapse/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /synthetic remission history/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /synthetic resolved history/i })).not.toBeInTheDocument();

    await user.click(filter);
    await user.click(screen.getByRole('option', { name: /^inactive$/i }));
    expect(screen.getByRole('row', { name: /synthetic remission history.*remission/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /synthetic resolved history.*resolved/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /synthetic recurrence history/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /synthetic relapse history/i })).not.toBeInTheDocument();
  });

  it('gives separate overview instances distinct accessible status filters', () => {
    mockUseConditions.mockReturnValue({
      conditions: [
        {
          id: 'synthetic-history',
          clinicalStatus: 'Active',
          conceptId: 'synthetic-concept',
          display: 'Synthetic antecedent',
          source: {
            uuid: 'synthetic-history',
            patient: { uuid: mockPatient.id },
            condition: { coded: { uuid: 'synthetic-concept', display: 'Synthetic antecedent' } },
            clinicalStatus: 'ACTIVE',
            voided: false,
          },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(
      <>
        <ConditionsOverview patientUuid={mockPatient.id} />
        <ConditionsOverview patientUuid={mockPatient.id} />
      </>,
    );
    const filters = screen.getAllByRole('combobox', { name: /show/i });
    expect(filters).toHaveLength(2);
    expect(new Set(filters.map((filter) => filter.id)).size).toBe(2);
    filters.forEach((filter) => {
      expect(filter.id).not.toBe('');
      expect(filter).toHaveAccessibleName(/show/i);
    });
  });

  it('renders an empty state view if antecedents data is unavailable', async () => {
    mockUseConditions.mockReturnValue({
      conditions: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /antecedents and problems/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no antecedents and problems to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/record antecedents and problems/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching antecedents', async () => {
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
    expect(screen.queryByText(/Error 401: Unauthorized/i)).not.toBeInTheDocument();
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
  });

  it("renders an overview of the patient's antecedents when present", async () => {
    const user = userEvent.setup();

    mockUseConditions.mockReturnValue({
      conditions: [
        {
          clinicalStatus: 'Active',
          antecedentType: 'pathological',
          conceptId: '138571AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'HIV Positive',
          id: 'cbffbb42-41b4-4c38-bc14-842ef675df85',
          onsetDateTime: '2021-05-15T21:00:00+00:00',
          recordedDate: '2021-05-17T07:07:43+00:00',
          source: {
            uuid: 'cbffbb42-41b4-4c38-bc14-842ef675df85',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '138571AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'HIV Positive' } },
            auditInfo: { dateCreated: '2021-05-17T07:07:43+00:00' },
            onsetDate: '2021-05-15T21:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '160148AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Malaria, confirmed',
          id: 'b648963a-8258-4131-a7fc-257f2a347435',
          onsetDateTime: '2021-05-04T21:00:00+00:00',
          recordedDate: '2021-05-05T10:09:33+00:00',
          source: {
            uuid: 'b648963a-8258-4131-a7fc-257f2a347435',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '160148AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Malaria, confirmed' } },
            auditInfo: { dateCreated: '2021-05-05T10:09:33+00:00' },
            onsetDate: '2021-05-04T21:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '160155AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Malaria sevère',
          id: '9479e872-c9ca-48cc-82ee-273d67c41187',
          onsetDateTime: '2021-01-27T00:00:00+00:00',
          recordedDate: '2021-01-28T09:09:27+00:00',
          source: {
            uuid: '9479e872-c9ca-48cc-82ee-273d67c41187',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '160155AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Malaria sevère' } },
            auditInfo: { dateCreated: '2021-01-28T09:09:27+00:00' },
            onsetDate: '2021-01-27T00:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '121629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Anaemia',
          id: 'c1006bd4-0b21-4305-9eba-c9c647534502',
          onsetDateTime: '2021-01-27T00:00:00+00:00',
          recordedDate: '2021-01-28T09:09:27+00:00',
          source: {
            uuid: 'c1006bd4-0b21-4305-9eba-c9c647534502',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '121629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Anaemia' } },
            auditInfo: { dateCreated: '2021-01-28T09:09:27+00:00' },
            onsetDate: '2021-01-27T00:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:34:48+00:00',
          source: {
            uuid: 'f4ee2cfe-3880-4ea2-a5a6-82aa8a0f6389',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Hypertension' } },
            auditInfo: { dateCreated: '2020-08-19T18:34:48+00:00' },
            onsetDate: '2020-08-19T00:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: 'e3a3f9e2-73fe-4793-a2eb-0b4fcd00b271',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:42:10+00:00',
          source: {
            uuid: 'e3a3f9e2-73fe-4793-a2eb-0b4fcd00b271',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Hypertension' } },
            auditInfo: { dateCreated: '2020-08-19T18:42:10+00:00' },
            onsetDate: '2020-08-19T00:00:00+00:00',
            voided: false,
          },
        },
        {
          clinicalStatus: 'Active',
          conceptId: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hypertension',
          id: '08c4dbcb-b474-4843-8e62-7096ff6dd6a2',
          onsetDateTime: '2020-08-19T00:00:00+00:00',
          recordedDate: '2020-08-19T18:42:25+00:00',
          source: {
            uuid: '08c4dbcb-b474-4843-8e62-7096ff6dd6a2',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'ACTIVE',
            condition: { coded: { uuid: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Hypertension' } },
            auditInfo: { dateCreated: '2020-08-19T18:42:25+00:00' },
            onsetDate: '2020-08-19T00:00:00+00:00',
            voided: false,
          },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    expect(screen.getByRole('heading', { name: /antecedents and problems/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^antecedent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /antecedent type/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date of onset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument();

    const expectedTableRows = [
      /hiv positive/,
      /patol|patholog/,
      /malaria, confirmed/,
      /malaria sevère/,
      /anaemia/,
      /hypertension/,
    ];
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row').length).toEqual(6);
    expect(screen.getByText(/1–5 of 7 items/i)).toBeInTheDocument();

    const nextPageButton = screen.getByRole('button', { name: /next page/i });

    await user.click(nextPageButton);

    expect(screen.getAllByRole('row').length).toEqual(3);
  });

  it('shows inactive records initially in antecedent and past-diagnosis widgets', () => {
    mockUseConditions.mockReturnValue({
      conditions: [
        {
          clinicalStatus: 'Inactive',
          antecedentType: 'family',
          conceptId: 'family-history-concept',
          display: 'Family history of diabetes',
          id: 'family-history-id',
          recordedDate: '2026-08-04T12:00:00.000Z',
          source: {
            uuid: 'family-history-id',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'INACTIVE',
            condition: { coded: { uuid: 'family-history-concept', display: 'Family history of diabetes' } },
            auditInfo: { dateCreated: '2026-08-04T12:00:00.000Z' },
            voided: false,
          },
        },
        {
          clinicalStatus: 'Inactive',
          antecedentType: 'definitive-diagnosis',
          conceptId: 'past-diagnosis-concept',
          display: 'Resolved pneumonia',
          id: 'past-diagnosis-id',
          recordedDate: '2026-08-04T12:00:00.000Z',
          source: {
            uuid: 'past-diagnosis-id',
            patient: { uuid: mockPatient.id },
            clinicalStatus: 'INACTIVE',
            condition: { coded: { uuid: 'past-diagnosis-concept', display: 'Resolved pneumonia' } },
            auditInfo: { dateCreated: '2026-08-04T12:00:00.000Z' },
            voided: false,
          },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { unmount } = render(<ConditionsOverview patientUuid={mockPatient.id} />);
    expect(screen.getByRole('row', { name: /family history of diabetes/i })).toBeInTheDocument();

    unmount();
    render(<ConditionsOverview patientUuid={mockPatient.id} section="past-diagnoses" />);
    expect(screen.getByRole('row', { name: /resolved pneumonia/i })).toBeInTheDocument();
  });

  it('clicking the Add button or Record Antecedents link launches the antecedents form', async () => {
    const user = userEvent.setup();

    mockUseConditions.mockReturnValue({
      conditions: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<ConditionsOverview patientUuid={mockPatient.id} />);

    const recordConditionsLink = screen.getByRole('button', { name: /record antecedents and problems/i });

    await user.click(recordConditionsLink);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledTimes(1);
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('conditions-form-workspace', {
      formContext: 'creating',
      workspaceTitle: 'Record antecedent',
    });
  });
});
