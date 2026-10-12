import { launchWorkspace } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import * as imagingApi from '../../api/api';
import { addNewRequestWorkspace, linkStudiesFormWorkspace, uploadStudiesFormWorkspace } from '../constants';
import { useImagingAccess } from '../utils/use-imaging-access';
import ImagingDetailedSummary from './imaging-detailed-summary.component';

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
  AddIcon: () => <span aria-hidden="true">AddIcon</span>,
}));

vi.mock('../components/studies-details-table.component', () => ({ default: () => <div>StudiesDetailTable</div> }));
vi.mock('../components/requests-details-table.component', () => ({ default: () => <div>RequestProcedureTable</div> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string, values?: Record<string, unknown>) =>
      defaultValue.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => String(values?.[key] ?? placeholder)),
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  ErrorState: ({ error, headerTitle }: ErrorStateProps) => (
    <div data-testid="error-state">
      {headerTitle}: {error?.message || 'Error'}
    </div>
  ),
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
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true });
  });

  it('renders loading skeletons when data is loading', () => {
    mockUseStudiesByPatient.mockReturnValue(
      buildStudiesHookResult({
        isLoading: true,
      }),
    );

    mockUseRequestsByPatient.mockReturnValue(
      buildRequestsHookResult({
        isLoading: true,
      }),
    );

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByTestId('studies-loading')).toBeVisible();
    expect(screen.getByTestId('requests-loading')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByTestId('requests-loading')).toBeVisible();
    expect(screen.getByTestId('studies-loading')).not.toBeVisible();
  });

  it('renders empty state when no studies or requests exist', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText('There are no studies to display for this patient')).toBeVisible();
    expect(screen.getByText('There are no requests to display for this patient')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getByText('There are no requests to display for this patient')).toBeVisible();
    expect(screen.getByText('There are no studies to display for this patient')).not.toBeVisible();
    expect(screen.getByRole('heading', { name: 'Requests' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Record requests' })).toHaveLength(1);
    expect(
      screen.queryByText('Create imaging requests and follow their progress in the worklist.'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('renders error states if API returns errors', () => {
    const error = new Error('Failed to fetch');

    mockUseStudiesByPatient.mockReturnValue(
      buildStudiesHookResult({
        error,
      }),
    );

    mockUseRequestsByPatient.mockReturnValue(
      buildRequestsHookResult({
        error,
      }),
    );

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText(/Studies: Failed to fetch/)).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getByText(/Requests: Failed to fetch/)).toBeVisible();
  });

  it('renders error states if studies error', () => {
    const error = new Error('Failed to fetch');

    mockUseStudiesByPatient.mockReturnValue(
      buildStudiesHookResult({
        error,
      }),
    );

    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByTestId('error-state')).toHaveLength(1);
    expect(screen.getAllByText(/Studies: Failed to fetch/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getByText('There are no requests to display for this patient')).toBeVisible();
    expect(screen.getByTestId('error-state')).not.toBeVisible();
  });

  it('renders requests with one patient-scoped action that stops when editing access is lost', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(
      buildRequestsHookResult({
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
      }),
    );

    const { rerender } = render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText('RequestProcedureTable')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getByText('RequestProcedureTable')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(launchWorkspace).toHaveBeenCalledWith(addNewRequestWorkspace, { patientUuid });

    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: false, isOnline: true });
    vi.mocked(launchWorkspace).mockClear();
    rerender(<ImagingDetailedSummary patientUuid={patientUuid} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(launchWorkspace).not.toHaveBeenCalled();
  });

  it('triggers workspace launches when buttons clicked', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());

    mockUseRequestsByPatient.mockReturnValue(
      buildRequestsHookResult({
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
      }),
    );

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    const linkButton = screen.getByText(/Link studies/i);
    fireEvent.click(linkButton);

    const uploadButton = screen.getByRole('button', { name: 'Upload DICOM' });
    fireEvent.click(uploadButton);

    const mockedLaunchWorkspace = vi.mocked(launchWorkspace);
    expect(mockedLaunchWorkspace).toHaveBeenCalledTimes(2);
    expect(mockedLaunchWorkspace).toHaveBeenNthCalledWith(1, linkStudiesFormWorkspace, { patientUuid });
    expect(mockedLaunchWorkspace).toHaveBeenNthCalledWith(2, uploadStudiesFormWorkspace, { patientUuid });
  });

  it('keeps a single management surface and launches a request for the current patient', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());
    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());
    render(<ImagingDetailedSummary patientUuid={patientUuid} />);
    expect(screen.queryByText('Manage studies')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Studies' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record requests' }));
    expect(launchWorkspace).toHaveBeenCalledWith(addNewRequestWorkspace, { patientUuid });
  });

  it('resets to studies when the patient changes', () => {
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());
    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());
    const { rerender } = render(<ImagingDetailedSummary patientUuid={patientUuid} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    rerender(<ImagingDetailedSummary patientUuid="another-synthetic-patient" />);
    expect(screen.getByRole('tab', { name: 'Studies' })).toHaveAttribute('aria-selected', 'true');
    expect(mockUseStudiesByPatient).toHaveBeenLastCalledWith('another-synthetic-patient');
    expect(mockUseRequestsByPatient).toHaveBeenLastCalledWith('another-synthetic-patient');
    fireEvent.click(screen.getByRole('button', { name: 'Upload DICOM' }));
    expect(launchWorkspace).toHaveBeenLastCalledWith(uploadStudiesFormWorkspace, {
      patientUuid: 'another-synthetic-patient',
    });
  });

  it.each([true, false])('keeps read-only actions disabled with online=%s', (isOnline) => {
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: false, isOnline });
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());
    mockUseRequestsByPatient.mockReturnValue(buildRequestsHookResult());
    render(<ImagingDetailedSummary patientUuid={patientUuid} />);
    expect(screen.getByRole('button', { name: 'Upload DICOM' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Link studies' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Upload DICOM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link studies' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.queryByRole('button', { name: 'Record requests' })).not.toBeInTheDocument();
    expect(launchWorkspace).not.toHaveBeenCalled();
    if (!isOnline) expect(screen.getByText(/Connect to the network/)).toBeInTheDocument();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
