import * as framework from '@openmrs/esm-framework';
import { usePagination } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { act } from 'react';
import RequestProcedureTable from './requests-details-table.component';

type IconProps = Record<string, unknown>;
type SelectProps = {
  children?: ReactNode;
} & Record<string, unknown>;
type SelectItemProps = {
  text: string;
  value: string;
};
type CardHeaderProps = {
  children?: ReactNode;
};
type PaginationProps = {
  pageNumber: number;
  onPageNumberChange: (value: { page: number }) => void;
};
type EmptyStateProps = {
  displayText: string;
  headerTitle: string;
};

vi.mock('./procedureStep-details-table.component', () => ({
  default: ({ requestProcedure }: { requestProcedure: { id: number } }) => <div>Steps for {requestProcedure.id}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showModal: vi.fn(),
  launchWorkspace: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
  createGlobalStore: vi.fn(() => ({
    getState: vi.fn(),
    subscribe: vi.fn(),
    dispatch: vi.fn(),
  })),
  usePagination: vi.fn((items, pageSize) => ({
    results: items?.slice(0, pageSize) || [],
    goto: vi.fn(),
    currentPage: 1,
  })),
  AddIcon: (props: IconProps) => <span {...props}>AddIcon</span>,
  TrashCanIcon: (props: IconProps) => <span {...props}>TrashCanIcon</span>,
  select: ({ children, ...props }: SelectProps) => <select {...props}>{children}</select>,
  SelectItem: ({ text, value }: SelectItemProps) => <option value={value}>{text}</option>,
}));

// Mock other OpenMRS libs
vi.mock('@openmrs/esm-patient-common-lib', () => ({
  CardHeader: ({ children }: CardHeaderProps) => <div>{children}</div>,
  compare: vi.fn((a, b) => (a > b ? 1 : -1)),
  PatientChartPagination: ({ pageNumber, onPageNumberChange }: PaginationProps) => (
    <div data-testid="pagination">
      Page {pageNumber}
      <button type="button" onClick={() => onPageNumberChange({ page: pageNumber + 1 })}>
        Next page
      </button>
    </div>
  ),
  EmptyState: ({ displayText, headerTitle }: EmptyStateProps) => (
    <div>
      {headerTitle}: {displayText}
    </div>
  ),
  useLaunchWorkspaceRequiringVisit: (_workspace: unknown) => vi.fn(),
}));

describe('RequestProcedureTable', () => {
  const patientUuid = 'patient-12345';

  const mockRequests = [
    {
      id: 1,
      status: 'scheduled',
      priority: 'high',
      requestingPhysician: 'Dr. Who',
      studyInstanceUID: 'UID123',
      requestDescription: 'MRI scan',
      orthancConfiguration: { id: 1, orthancBaseUrl: 'http://orthanc.local' },
      patientUuid: patientUuid,
      accessionNumber: 'ACC123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (usePagination as vi.Mock).mockReturnValue({
      results: mockRequests,
      currentPage: 1,
      goTo: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders Empty State when no requests are available', async () => {
    await act(async () => {
      render(<RequestProcedureTable requests={[]} patientUuid={patientUuid} />);
    });
    expect(screen.getByText(/No requests found/i)).toBeInTheDocument();
  });

  it('renders table rows when requests are provided', async () => {
    await act(async () => {
      render(<RequestProcedureTable requests={mockRequests} patientUuid={patientUuid} />);
    });
    const table = screen.getByRole('table');
    expect(screen.getByText(/MRI scan/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Who/i)).toBeInTheDocument();
    expect(within(table).getByText(/scheduled/i)).toBeInTheDocument();
  });

  it('call showModal when delete icon is clicked', async () => {
    const mockDispose = vi.fn();
    (framework.showModal as vi.Mock).mockReturnValue(mockDispose);

    await act(async () => {
      render(<RequestProcedureTable requests={mockRequests} patientUuid={patientUuid} />);
    });

    const deleteButton = screen.getByLabelText(/Remove requst/i);
    fireEvent.click(deleteButton);

    expect(framework.showModal).toHaveBeenCalled();
  });

  it('renders ProcedureStepTable when a row is expanded', async () => {
    await act(async () => {
      render(<RequestProcedureTable requests={mockRequests} patientUuid={patientUuid} />);
    });

    const row = screen.getByText(/MRI scan/i).closest('tr');
    expect(row).toBeInTheDocument();

    fireEvent.doubleClick(row!);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /procedure step/i })).toBeInTheDocument();
    });
  });

  test('status and priority filters default to "all" and update on change', async () => {
    await act(async () => {
      render(<RequestProcedureTable requests={mockRequests} patientUuid={patientUuid} />);
    });

    // Get the select elements
    const statusSelect = screen.getByLabelText(/status filter/i);
    const prioritySelect = screen.getByLabelText(/priority filter/i);

    // Check default value
    expect(statusSelect).toHaveValue('all');
    expect(prioritySelect).toHaveValue('all');

    fireEvent.change(statusSelect, { target: { value: 'completed' } });
    expect(statusSelect).toHaveValue('completed');

    // Change priority filter
    fireEvent.change(prioritySelect, { target: { value: 'high' } });
    expect(prioritySelect).toHaveValue('high');
  });
  it('expands the exact request after Carbon sorts the rows', () => {
    const requests = [
      { ...mockRequests[0], id: 11, priority: 'low', requestDescription: 'First request' },
      { ...mockRequests[0], id: 22, priority: 'high', requestDescription: 'Second request' },
    ];
    vi.mocked(usePagination).mockReturnValue({ results: requests, currentPage: 1, goTo: vi.fn() } as never);
    render(<RequestProcedureTable requests={requests} patientUuid={patientUuid} />);
    fireEvent.click(screen.getByRole('button', { name: /priority/i }));
    fireEvent.doubleClick(screen.getByText('Second request').closest('tr'));
    expect(screen.getByRole('region')).toHaveTextContent('Steps for 22');
    expect(screen.getByRole('region')).not.toHaveTextContent('Steps for 11');
  });

  it('returns to the first page when a worklist status filter changes', async () => {
    const framework = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
    vi.mocked(usePagination).mockImplementation(framework.usePagination);
    const requests = Array.from({ length: 11 }, (_, index) => ({
      ...mockRequests[0],
      id: index + 1,
      requestDescription: index === 0 ? 'Unique completed request' : 'Scheduled request',
      status: index === 0 ? 'completed' : 'scheduled',
    }));
    render(<RequestProcedureTable requests={requests} patientUuid={patientUuid} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 3');
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'completed' } });
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');
    expect(screen.getByText('Unique completed request')).toBeInTheDocument();
  });

  it('honors the caller request to hide deletion controls', () => {
    render(<RequestProcedureTable requests={mockRequests} patientUuid={patientUuid} showDeleteButton={false} />);
    expect(screen.queryByRole('button', { name: 'Remove requst' })).not.toBeInTheDocument();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
