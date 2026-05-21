import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AssignStudiesTable, { type AssignStudiesTableProps } from './assign-studies-table.component';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('../../api');

vi.mock('../../types', () => ({}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useLayoutType: () => 'desktop',
  usePagination: (data: any[], pagesize: number) => ({
    results: data.slice(0, pagesize),
    goto: vi.fn(),
    currentPage: 1,
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
  PatientChartPagination: ({ pageNumber, totalItems }: any) => (
    <div data-testid="pagination">
      Page {pageNumber} of {totalItems}
    </div>
  ),
  EmptyState: ({ displayText }: any) => <div data-testid="empty-state">{displayText}</div>,
}));

vi.mock('./series-details-table.component', () => ({ default: () => <div>Series Details</div> }));

describe('AssignStudiesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockConfig = {
    id: 1,
    orthancBaseUrl: 'http://orthanc.local',
    orthancProxyUrl: '',
  };

  const defaultProps: AssignStudiesTableProps = {
    patientUuid: '1234-5678-9012-3456',
    assignStudyFunction: vi.fn(),
    data: {
      studies: [
        {
          id: 1,
          studyInstanceUID: '1.2.3',
          patientName: 'John Doe',
          studyDate: '2023-01-01',
          studyDescription: 'Description of study 1',
          orthancStudyUID: 'orthancUID_1.2.3',
          orthancConfiguration: mockConfig,
          mrsPatientUuid: null,
        },
        {
          id: 2,
          studyInstanceUID: '4.5.6',
          patientName: 'Jane Smith',
          studyDate: '2023-02-15',
          studyDescription: 'Description of study 2',
          orthancStudyUID: 'orthancUID_4.5.6',
          orthancConfiguration: mockConfig,
          mrsPatientUuid: '1234-5678-9012-3456', // assigned study
        },
      ],
      scores: new Map([
        ['1.2.3', 80],
        ['4.5.6', 95],
      ]),
    },
  };

  it('renders empty state when no studies are available', () => {
    render(<AssignStudiesTable {...defaultProps} data={{ studies: [], scores: new Map<string, number>() }} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('studies');
  });

  it('renders table with studies and pagination', () => {
    render(<AssignStudiesTable {...defaultProps} />);

    // Verify patient names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Grab data rows (skip header)
    const rows = screen.getAllByRole('row');
    const dataRows = rows.slice(1);

    // Check John Doe row
    expect(within(dataRows[0]).getByText('John Doe')).toBeInTheDocument();
    expect(within(dataRows[0]).getByText(/80%/)).toBeInTheDocument();

    // Check Jane Smith row
    expect(within(dataRows[1]).getByText('Jane Smith')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText(/95%/)).toBeInTheDocument();
  });

  it('calls assignStudyFunction when checkbox is toggled', () => {
    const assignMock = vi.fn();
    render(<AssignStudiesTable {...defaultProps} assignStudyFunction={assignMock} />);

    const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    act(() => {
      fireEvent.click(checkbox);
    });

    expect(assignMock).toHaveBeenCalledWith(defaultProps.data!.studies[0], 'true');
  });

  it('sorts studies when sortable headers are clicked', () => {
    render(<AssignStudiesTable {...defaultProps} />);
    const header = screen.getByText('Patient name');
    fireEvent.click(header);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('expands row on double click to show series details', () => {
    render(<AssignStudiesTable {...defaultProps} />);
    const row = screen.getByText('John Doe').closest('tr');
    expect(screen.queryByText('Series Details')).not.toBeInTheDocument();

    fireEvent.doubleClick(row);
    expect(screen.getByText('Series Details')).toBeInTheDocument();
  });

  it('renders pagination controls when there are multiple pages of studies', () => {
    render(<AssignStudiesTable {...defaultProps} />);
    expect(screen.getByTestId('pagination')).toHaveTextContent(`Page 1 of ${defaultProps.data!.studies.length}`);
  });
});
