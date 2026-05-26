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
};
type EmptyStateProps = {
  displayText: string;
  headerTitle: string;
};

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
  PatientChartPagination: ({ pageNumber }: PaginationProps) => <div>Page {pageNumber}</div>,
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
});
