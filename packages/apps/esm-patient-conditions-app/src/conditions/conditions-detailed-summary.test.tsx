import { useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { type Condition, useConditions } from './conditions.resource';
import ConditionsDetailedSummary from './conditions-detailed-summary.component';

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

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseConditions = vi.mocked(useConditions);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);
const fhirMockPatient = mockPatient as unknown as fhir.Patient;

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');

  return {
    ...actual,
    useLayoutType: vi.fn(),
    useSession: vi.fn(),
    userHasAccess: vi.fn(),
  };
});

beforeEach(() => {
  mockUseLayoutType.mockReturnValue('small-desktop');
  mockUseSession.mockReturnValue({
    user: {
      uuid: 'mock-user-uuid',
      display: 'Mock User',
    },
  } as never);
  mockUserHasAccess.mockReturnValue(true);
  vi.clearAllMocks();
});

it('renders an empty state view if antecedents data is unavailable', async () => {
  mockUseConditions.mockReturnValue({
    conditions: [],
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<ConditionsDetailedSummary patient={fhirMockPatient} />);

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /active problems/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /past diagnoses/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /antecedents/i })).toBeInTheDocument();
  expect(screen.getAllByTitle(/Empty data illustration/i)).toHaveLength(3);
  expect(screen.getByText(/There are no active problems to display for this patient/i)).toBeInTheDocument();
  expect(screen.getByText(/There are no past diagnoses to display for this patient/i)).toBeInTheDocument();
  expect(screen.getByText(/There are no antecedents to display for this patient/i)).toBeInTheDocument();
  expect(screen.getByText(/Record active problems/i)).toBeInTheDocument();
  expect(screen.getByText(/Record past diagnoses/i)).toBeInTheDocument();
  expect(screen.getByText(/Record antecedents/i)).toBeInTheDocument();
});

it('renders an error state view if there is a problem fetching antecedents data', async () => {
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

  render(<ConditionsDetailedSummary patient={fhirMockPatient} />);

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryAllByText(/Error 401: Unauthorized/i)).toHaveLength(0);
  expect(screen.getAllByText(/there was a problem displaying this information/i).length).toBeGreaterThan(0);
});

it("renders a detailed summary of the patient's antecedents when present", async () => {
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

  render(<ConditionsDetailedSummary patient={mockPatient as unknown as fhir.Patient} />);

  expect(screen.getByRole('heading', { name: /active problems/i })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /add/i }).length).toBeGreaterThan(0);

  expect(screen.getAllByRole('button', { name: /^antecedent$/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: /antecedent type/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: /date of onset/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: /status/i }).length).toBeGreaterThan(0);

  const expectedTableRows = [/hiv positive/, /patol|patholog/, /malaria, confirmed/, /Malaria sevère/, /anaemia/];
  expectedTableRows.forEach((row) => {
    expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
  });
  expect(screen.getAllByRole('row').length).toEqual(10);
});

it('keeps three accessible filters independent while showing inactive history by default', async () => {
  const user = userEvent.setup();
  mockUseConditions.mockReturnValue({
    conditions: [
      {
        clinicalStatus: 'Active',
        antecedentType: 'pathological',
        conceptId: 'active-problem-concept',
        display: 'Hypertension',
        id: 'active-problem-id',
        recordedDate: '2026-08-04T12:00:00.000Z',
        source: {
          uuid: 'active-problem-id',
          patient: { uuid: mockPatient.id },
          clinicalStatus: 'ACTIVE',
          condition: { coded: { uuid: 'active-problem-concept', display: 'Hypertension' } },
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
    ],
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<ConditionsDetailedSummary patient={fhirMockPatient} />);

  expect(screen.getByRole('row', { name: /hypertension/i })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: /resolved pneumonia/i })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: /family history of diabetes/i })).toBeInTheDocument();

  const filters = screen.getAllByRole('combobox');
  expect(filters).toHaveLength(3);
  expect(new Set(filters.map((filter) => filter.id)).size).toBe(3);
  for (const filter of filters) {
    expect(filter.id).not.toBe('');
    expect(filter).toHaveAccessibleName(/show/i);
    const labelIds = filter.getAttribute('aria-labelledby')?.split(' ') ?? [];
    expect(labelIds.length).toBeGreaterThan(0);
    for (const labelId of labelIds) {
      expect(document.querySelectorAll(`[id="${labelId}"]`)).toHaveLength(1);
    }
  }

  await user.click(filters[2]);
  await user.click(screen.getByRole('option', { name: /^active$/i }));
  expect(screen.queryByRole('row', { name: /family history of diabetes/i })).not.toBeInTheDocument();
  expect(screen.getByRole('row', { name: /hypertension/i })).toBeInTheDocument();
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

  render(<ConditionsDetailedSummary patient={mockPatient as unknown as fhir.Patient} />);

  const recordConditionsLink = screen.getByText(/record antecedents/i);

  await user.click(recordConditionsLink);

  expect(mockLaunchPatientWorkspace).toHaveBeenCalledTimes(1);
  expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('conditions-form-workspace', {
    formContext: 'creating',
    workspaceTitle: 'Record antecedent',
  });
});

it('keeps family and social history out of active disease and shows surgical history with exact FHIR status', async () => {
  const user = userEvent.setup();
  const entries: Array<Pick<Condition, 'antecedentType' | 'clinicalStatus' | 'display'>> = [
    { antecedentType: 'pathological', clinicalStatus: 'Relapse', display: 'Synthetic personal relapse' },
    { antecedentType: 'pathological', clinicalStatus: 'Recurrence', display: 'Synthetic personal recurrence' },
    { antecedentType: 'family', clinicalStatus: 'Active', display: 'Synthetic family history' },
    { antecedentType: 'social', clinicalStatus: 'Active', display: 'Synthetic social history' },
    { antecedentType: 'surgical', clinicalStatus: 'Resolved', display: 'Synthetic surgical history' },
    {
      antecedentType: 'previous-hospitalization',
      clinicalStatus: 'Active',
      display: 'Synthetic hospitalization history',
    },
    { antecedentType: 'other', clinicalStatus: 'Active', display: 'Synthetic other history' },
    { antecedentType: 'definitive-diagnosis', clinicalStatus: 'Resolved', display: 'Synthetic past diagnosis' },
  ];
  mockUseConditions.mockReturnValue({
    conditions: entries.map((entry, index) => ({
      ...entry,
      id: `synthetic-history-${index}`,
      conceptId: 'synthetic-concept',
      source: {
        uuid: `synthetic-history-${index}`,
        patient: { uuid: mockPatient.id },
        clinicalStatus: entry.clinicalStatus.toUpperCase(),
        condition: { coded: { uuid: 'synthetic-concept', display: entry.display } },
        voided: false,
      },
    })),
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<ConditionsDetailedSummary patient={fhirMockPatient} />);
  const activeProblems = screen.getByRole('table', { name: 'Active problems summary' });
  const antecedents = screen.getByRole('table', { name: 'Antecedents summary' });
  expect(within(activeProblems).getAllByRole('row')).toHaveLength(3);
  expect(within(activeProblems).getByRole('row', { name: /synthetic personal relapse.*relapse/i })).toBeInTheDocument();
  expect(
    within(activeProblems).getByRole('row', { name: /synthetic personal recurrence.*recurrence/i }),
  ).toBeInTheDocument();
  for (const history of ['family', 'social', 'surgical', 'hospitalization', 'other']) {
    expect(
      within(antecedents).getByRole('row', { name: new RegExp(`synthetic ${history} history`, 'i') }),
    ).toBeInTheDocument();
    expect(
      within(activeProblems).queryByRole('row', { name: new RegExp(`synthetic ${history} history`, 'i') }),
    ).not.toBeInTheDocument();
  }
  expect(
    within(screen.getByRole('table', { name: 'Past diagnoses summary' })).getByRole('row', {
      name: /synthetic past diagnosis/i,
    }),
  ).toBeInTheDocument();

  await user.click(screen.getAllByRole('combobox', { name: /show/i })[2]);
  await user.click(screen.getByRole('option', { name: /^inactive$/i }));
  expect(within(antecedents).getByRole('row', { name: /synthetic surgical history.*resolved/i })).toBeInTheDocument();
  expect(within(antecedents).queryByRole('row', { name: /synthetic family history/i })).not.toBeInTheDocument();
});

it('shows partial onset dates without inventing a day or month', () => {
  mockUseConditions.mockReturnValue({
    conditions: ['2020', '2021-02'].map((onsetDateTime, index) => ({
      id: `synthetic-partial-date-${index}`,
      conceptId: 'synthetic-concept',
      display: `Synthetic partial date ${index}`,
      clinicalStatus: 'Inactive',
      antecedentType: 'other',
      onsetDateTime,
      source: {
        uuid: `synthetic-partial-date-${index}`,
        patient: { uuid: fhirMockPatient.id },
        clinicalStatus: 'INACTIVE',
        condition: { coded: { uuid: 'synthetic-concept', display: `Synthetic partial date ${index}` } },
        onsetDate: onsetDateTime,
        voided: false,
      },
    })),
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });
  render(<ConditionsDetailedSummary patient={fhirMockPatient} />);
  const table = screen.getByRole('table', { name: 'Antecedents summary' });
  expect(within(table).getByRole('cell', { name: '2020' })).toBeInTheDocument();
  expect(within(table).getByRole('cell', { name: 'Feb — 2021' })).toBeInTheDocument();
  expect(within(table).queryByRole('cell', { name: /01.*2020|01.*2021/i })).not.toBeInTheDocument();
});
