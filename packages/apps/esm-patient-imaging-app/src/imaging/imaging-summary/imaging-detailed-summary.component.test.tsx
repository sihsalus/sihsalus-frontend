import { launchWorkspace } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import * as api from '../../api';
import ImagingDetailedSummary from './imaging-detailed-summary.component';

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

vi.mock('../../api');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  CardHeader: ({ children, title }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  EmptyState: ({ displayText, headerTitle, launchForm }: any) => (
    <div data-testid="empty-state">
      {headerTitle}: {displayText}
      {launchForm && (
        <button type="button" onClick={launchForm}>
          Launch
        </button>
      )}
    </div>
  ),
  ErrorState: ({ error, headerTitle }: any) => (
    <div data-testid="error-state">
      {headerTitle}: {error?.message || 'Error'}
    </div>
  ),
}));

describe('<ImagingDetailedSummary />', () => {
  const patientUuid = 'patient-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons when data is loading', () => {
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('renders empty state when no studies or requests exist', () => {
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText(/Studies: No studies found/i)).toBeInTheDocument();
    expect(screen.getByText(/Worklist: No worklist found/i)).toBeInTheDocument();
  });

  it('renders error states if API returns errors', () => {
    const error = new Error('Failed to fetch');

    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByTestId('error-state')).toHaveLength(2);
    expect(screen.getAllByText(/Worklist: Failed to fetch/i)).toHaveLength(1);
  });

  it('renders error states if studies error', () => {
    const error = new Error('Failed to fetch');

    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getAllByTestId('error-state')).toHaveLength(1);
    expect(screen.getAllByText(/Studies: Failed to fetch/i)).toHaveLength(1);
  });

  it('renders RequestProcedureTable when requests exist', () => {
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [
        {
          id: 1,
          studyInstanceUID: 'STUDY-123',
          requestDescription: 'Request 1',
          orthancConfiguration: { orthancBaseUrl: 'http://orthanc.local' },
          patientName: 'John Doe',
          studyDate: '2025-08-29',
        },
      ],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    expect(screen.getByText('RequestProcedureTable')).toBeInTheDocument();
  });

  it('triggers workspace launches when buttons clicked', () => {
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      data: [
        {
          id: 1,
          studyInstanceUID: 'STUDY-123',
          requestDescription: 'Request1',
          orthancConfiguration: { orthancBaseUrl: 'http://orthanc.local' },
          patientName: 'John Doe',
          studyDate: '2025-08-29',
        },
      ],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    render(<ImagingDetailedSummary patientUuid={patientUuid} />);

    const linkButton = screen.getByText(/Link studies/i);
    fireEvent.click(linkButton);

    const uploadButton = screen.getByText(/Upload/i);
    fireEvent.click(uploadButton);

    expect(launchWorkspace).toHaveBeenCalledTimes(2);
  });
});
