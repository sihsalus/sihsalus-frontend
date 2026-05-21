import { showModal, usePagination } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import StudiesDetailTable from './studies-details-table.component';

type IconProps = Record<string, unknown>;
type PaginationProps = {
  pageNumber: number;
};
type EmptyStateProps = {
  displayText: string;
  headerTitle: string;
};
type CardHeaderProps = {
  children?: ReactNode;
};
type SeriesDetailsProps = {
  studyId: number;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));
vi.mock('../../api');
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showModal: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
  usePagination: vi.fn((items, pageSize) => ({
    results: items?.slice(0, pageSize) || [],
    goTo: vi.fn(),
    currentPage: 1,
  })),
  TrashCanIcon: (props: IconProps) => <span data-testid="trash-icon" {...props} />,
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  PatientChartPagination: ({ pageNumber }: PaginationProps) => <div data-testid="pagination">Page {pageNumber}</div>,
  EmptyState: ({ displayText, headerTitle }: EmptyStateProps) => (
    <div>
      {headerTitle}: {displayText}
    </div>
  ),
  CardHeader: ({ children }: CardHeaderProps) => <div>{children}</div>,
  compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
}));

vi.mock('./series-details-table.component', () => ({
  default: ({ studyId }: SeriesDetailsProps) => <div data-testid="series-details">Series for {studyId}</div>,
}));

describe('StudiesDetailsTable', () => {
  const mockStudies = [
    {
      id: 1,
      studyInstanceUID: 'STUDY-123',
      orthancStudyUID: 'ORTHANC-UID-123',
      mrsPatientUuid: 'patientUuid-123',
      patientName: 'John Doe',
      studyDate: '2025-08-29',
      studyDescription: 'Brain MRI',
      orthancConfiguration: { id: 1, orthancBaseUrl: 'http://localhost:8042' },
    },
  ];

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (usePagination as vi.Mock).mockReturnValue({
      results: mockStudies,
      currentPage: 1,
      goTo: vi.fn(),
    });
  });

  it('renders EmptyState when no studies are available', () => {
    (usePagination as vi.Mock).mockReturnValue({
      results: [],
      currentPage: 1,
      goTo: vi.fn(),
    });

    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={[]} />);

    expect(screen.getByText(/Studies: No studies found/i)).toBeInTheDocument();
  });

  it('renders table headers and study row', () => {
    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={mockStudies} />);

    expect(screen.getByRole('table', { name: /Studies summary/i })).toBeInTheDocument();
    expect(screen.getByText(/STUDY-123/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-08-29/i)).toBeInTheDocument();
    expect(screen.getByText(/Brain MRI/i)).toBeInTheDocument();
  });

  it('shows pagination', () => {
    render(<StudiesDetailTable patientUuid="p-1" studies={mockStudies} />);
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');
  });

  it('calls showModal when delete button clicked', () => {
    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={mockStudies} showDeleteButton={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove study/i }));
    expect(showModal).toHaveBeenCalled();
  });

  it('expand row and renders SeriesDetailsTable on double click', () => {
    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={mockStudies} />);
    const row = screen.getByText(/Brain MRI/i);
    fireEvent.doubleClick(row);
    expect(screen.getByTestId('series-details')).toHaveTextContent('Series for 1');
  });

  it('navigates when viewer button clicked', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' } as unknown as Location,
    });

    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={mockStudies} />);

    fireEvent.click(screen.getByLabelText(/Stone viewer of Orthanc/i));
    expect(window.location.href).toContain('stone-webviewer');

    fireEvent.click(screen.getByLabelText(/Ohif viewer/i));
    expect(window.location.href).toContain('http://localhost:8042/ohif/viewer?StudyInstanceUIDs=STUDY-123');

    fireEvent.click(screen.getByLabelText(/Show data in orthanc explorer/i));
    expect(window.location.href).toContain('filtered-studies');
  });
});
