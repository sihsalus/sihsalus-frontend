import { launchWorkspace } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as imagingApi from '../../api/api';
import ImagingDetailedSummary from './imaging-detailed-summary.component';

type CardHeaderProps = {
  children?: ReactNode;
  title: string;
};
type EmptyStateProps = {
  displayText: string;
  headerTitle: string;
  launchForm?: () => void;
};
type ErrorStateProps = {
  error?: Error | null;
  headerTitle: string;
};

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useLayoutType: vi.fn(() => 'desktop'),
  launchWorkspace: vi.fn(),
  usePagination: vi.fn((items, pageSize) => ({
    results: items?.slice(0, pageSize) || [],
    goTo: vi.fn(),
    currentPage: 1,
  })),
  AddIcon: () => <span>AddIcon</span>,
}));

vi.mock('../components/studies-details-table.component', () => ({ default: () => <div>StudiesDetailTable</div> }));
vi.mock('../components/requests-details-table.component', () => ({ default: () => <div>RequestProcedureTable</div> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  CardHeader: ({ children, title }: CardHeaderProps) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  EmptyState: ({ displayText, headerTitle, launchForm }: EmptyStateProps) => (
    <div data-testid="empty-state">
      {headerTitle}: {displayText}
      {launchForm && (
        <button type="button" onClick={launchForm}>
          Launch
        </button>
      )}
    </div>
  ),
  ErrorState: ({ error, headerTitle }: ErrorStateProps) => (
    <div data-testid="error-state">
      {headerTitle}: {error?.message || 'Error'}
    </div>
  ),
  PatientChartPagination: () => <div data-testid="patient-chart-pagination" />,
  compare: (a: string, b: string) => a.localeCompare(b),
}));

describe('<ImagingDetailedSummary />', () => {
  const patientUuid = 'patient-uuid-123';
  const mockUseStudiesByPatient = vi.spyOn(imagingApi, 'useStudiesByPatient');
  const mockUseRequestsByPatient = vi.spyOn(imagingApi, 'useRequestsByPatient');
  const buildStudiesHookResult = (
    overrides: Partial<ReturnType<typeof imagingApi.useStudiesByPatient>> = {},
  ): ReturnType<typeof imagingApi.useStudiesByPatient> =>
    ({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      ...overrides,
    }) as ReturnType<typeof imagingApi.useStudiesByPatient>;
  const buildRequestsHookResult = (
    overrides: Partial<ReturnType<typeof imagingApi.useRequestsByPatient>> = {},
  ): ReturnType<typeof imagingApi.useRequestsByPatient> =>
    ({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      ...overrides,
    }) as ReturnType<typeof imagingApi.useRequestsByPatient>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons when data is loading', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult({
      isLoading: true,
    }));

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult({
      isLoading: true,
    }));

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('renders empty state when no studies or requests exist', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText(/Studies: No studies found/i)).toBeInTheDocument();
    expect(screen.getByText(/Worklist: No worklist found/i)).toBeInTheDocument();
  });

  it('renders error states if API returns errors', () => {
    const error = new Error('Failed to fetch');

    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult({
      error,
    }));

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult({
      error,
    }));

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByTestId('error-state')).toHaveLength(2);
    expect(screen.getAllByText(/Worklist: Failed to fetch/i)).toHaveLength(1);
  });

  it('renders error states if studies error', () => {
    const error = new Error('Failed to fetch');

    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult({
      error,
    }));

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByTestId('error-state')).toHaveLength(1);
    expect(screen.getAllByText(/Studies: Failed to fetch/i)).toHaveLength(1);
  });

  it('renders RequestProcedureTable when requests exist', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult({
      data: [
        {
          id: 1,
          patientUuid,
          accessionNumber: 'ACC-001',
          status: 'scheduled',
          priority: 'high',
          requestingPhysician: 'Dr. House',
          studyInstanceUID: 'STUDY-123',
          requestDescription: 'Request 1',
          orthancConfiguration: { id: 1, orthancBaseUrl: 'http://orthanc.local' },
        },
      ],
    }));

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText('RequestProcedureTable')).toBeInTheDocument();
  });

  it('triggers workspace launches when buttons clicked', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult({
      data: [
        {
          id: 1,
          patientUuid,
          accessionNumber: 'ACC-001',
          status: 'scheduled',
          priority: 'high',
          requestingPhysician: 'Dr. House',
          studyInstanceUID: 'STUDY-123',
          requestDescription: 'Request1',
          orthancConfiguration: { id: 1, orthancBaseUrl: 'http://orthanc.local' },
        },
      ],
    }));

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    const linkButton = screen.getByText(/Link studies/i);
    fireEvent.click(linkButton);

    const uploadButton = screen.getByText(/Upload/i);
    fireEvent.click(uploadButton);

    const mockedLaunchWorkspace = vi.mocked(launchWorkspace);
    expect(mockedLaunchWorkspace).toHaveBeenCalledTimes(2);
    expect(mockedLaunchWorkspace.mock.calls[0]?.[1]).toEqual({ patientUuid });
    expect(mockedLaunchWorkspace.mock.calls[1]?.[1]).toEqual({ patientUuid });
  });
});
