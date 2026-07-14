import {
  getDefaultsFromConfigSchema,
  useConfig,
  useFhirFetchAll,
  useOpenmrsFetchAll,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import {
  mockImmunizationData,
  mockPatient,
  patientChartBasePath,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import { immunizationEditPrivilege, immunizationPrivilege } from '../constants';
import ImmunizationsOverview from './immunizations-overview.component';

const testProps = {
  basePath: patientChartBasePath,
  patient: mockPatient as unknown as fhir.Patient,
  patientUuid: mockPatient.id,
};

const mockUseFhirFetchAll = useFhirFetchAll as vi.Mock;
const mockUseOpenmrsFetchAll = useOpenmrsFetchAll as vi.Mock;
const mockUseConfig = vi.mocked(useConfig<ImmunizationConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const immunizationConfig = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

const sessionWithEditPrivilege = {
  authenticated: true,
  user: {
    privileges: [{ display: immunizationPrivilege }, { display: immunizationEditPrivilege }],
  },
} as unknown as ReturnType<typeof useSession>;

const sessionWithoutPrivileges = {
  authenticated: true,
  user: { privileges: [] },
} as unknown as ReturnType<typeof useSession>;

describe('ImmunizationOverview', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(sessionWithEditPrivilege);
    mockUserHasAccess.mockReturnValue(true);
    mockUseConfig.mockReturnValue(immunizationConfig);
    mockUseOpenmrsFetchAll.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('renders an empty state view of immunizations data is unavailable', async () => {
    mockUseFhirFetchAll.mockReturnValue({ data: [] });

    renderWithSwr(<ImmunizationsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /immunizations/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no immunizations to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Record immunizations/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching immunization data', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };

    mockUseFhirFetchAll.mockReturnValue({
      data: null,
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    renderWithSwr(<ImmunizationsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /immunizations/i })).toBeInTheDocument();
    expect(screen.queryByText(/Error 401: Unauthorized/i)).not.toBeInTheDocument();
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
  });

  it('renders a tabular overview of recently administered immunizations if available', async () => {
    mockUseFhirFetchAll.mockReturnValue({ data: mockImmunizationData });

    renderWithSwr(<ImmunizationsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /immunizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();

    const expectedColumnHeaders = [/recent vaccination/, /vaccination date/];
    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    const expectedTableRows = [/rotavirus sept 2018/, /polio nov 2018/, /influenza may 2018/];
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row').length).toEqual(4);
    expect(screen.getByText(/1–3 of 3 items/i)).toBeInTheDocument();
  });

  it('falls back to AMPATH encounter immunizations when FHIR2 Immunization is not implemented', async () => {
    const {
      ampathFormPersistence: { concepts },
    } = immunizationConfig;

    mockUseFhirFetchAll.mockReturnValue({
      data: null,
      error: {
        message: '501 Not Implemented',
        response: {
          status: 501,
          statusText: 'Not Implemented',
        },
      },
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseOpenmrsFetchAll.mockReturnValue({
      data: [
        {
          uuid: 'ampath-immunization-encounter',
          encounterDatetime: '2024-01-03T00:00:00.000Z',
          visit: { uuid: 'visit-uuid' },
          obs: [
            {
              concept: { uuid: concepts.vaccineUuid },
              value: {
                uuid: '783AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                display: 'Polio vaccination, oral',
              },
            },
            { concept: { uuid: concepts.vaccinationDate }, value: '2024-01-03T00:00:00.000Z' },
            { concept: { uuid: concepts.doseNumber }, value: 1 },
            { concept: { uuid: concepts.status }, value: 'completed' },
            { concept: { uuid: concepts.programContext }, value: 'routine' },
          ],
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    renderWithSwr(<ImmunizationsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.queryByText(/Error 501/i)).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Polio vaccination, oral/i })).toBeInTheDocument();
  });

  it('does not offer to record immunizations when the user lacks the edit privilege', async () => {
    mockUseSession.mockReturnValue(sessionWithoutPrivileges);
    mockUserHasAccess.mockReturnValue(false);
    mockUseFhirFetchAll.mockReturnValue({ data: [] });

    renderWithSwr(<ImmunizationsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /immunizations/i })).toBeInTheDocument();
    expect(screen.queryByText(/Record immunizations/i)).not.toBeInTheDocument();
  });
});
