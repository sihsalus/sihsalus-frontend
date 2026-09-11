import { showModal, usePagination } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import StudiesDetailTable from './studies-details-table.component';

type IconProps = Record<string, unknown>;
type PaginationProps = {
  pageNumber: number;
  onPageNumberChange: (value: { page: number }) => void;
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
      orthancConfiguration: {
        id: 1,
        orthancBaseUrl: 'http://orthanc:8042',
        orthancProxyUrl: 'http://openmrs.sihsalus.gidistest/orthanc',
      },
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
      value: {
        origin: 'http://openmrs.sihsalus.gidistest',
      } as unknown as Location,
    });
    window.open = vi.fn();

    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={mockStudies} />);

    fireEvent.click(screen.getByLabelText(/^Show image$/i));
    expect(window.open).toHaveBeenNthCalledWith(
      1,
      'http://openmrs.sihsalus.gidistest/imaging/viewer?StudyInstanceUIDs=STUDY-123',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByLabelText(/^Show image data$/i));
    expect(window.open).toHaveBeenNthCalledWith(
      2,
      'http://openmrs.sihsalus.gidistest/orthanc/ui/app/#/filtered-studies?StudyInstanceUID=STUDY-123&expand=series',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByLabelText(/Open in Orthanc/i));
    expect(window.open).toHaveBeenNthCalledWith(
      3,
      'http://openmrs.sihsalus.gidistest/orthanc/ui/app/#/filtered-studies?StudyInstanceUID=STUDY-123&expand=series',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('returns to page one when the last item of page two is removed', async () => {
    const framework = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
    vi.mocked(usePagination).mockImplementation(framework.usePagination);
    const studies = Array.from({ length: 6 }, (_, index) => ({
      ...mockStudies[0],
      id: index + 1,
      studyInstanceUID: `SYNTHETIC-${index + 1}`,
      studyDescription: `Synthetic study ${index + 1}`,
    }));
    const { rerender } = render(<StudiesDetailTable patientUuid="patientUuid-123" studies={studies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 2');
    expect(screen.getByText('Synthetic study 6')).toBeInTheDocument();
    rerender(<StudiesDetailTable patientUuid="patientUuid-123" studies={studies.slice(0, 5)} />);
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');
    expect(screen.getByText('Synthetic study 1')).toBeInTheDocument();
    expect(screen.queryByText('Synthetic study 6')).not.toBeInTheDocument();
  });

  it('resets a high page when a filter changes, including empty results', async () => {
    const framework = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
    vi.mocked(usePagination).mockImplementation(framework.usePagination);
    const studies = Array.from({ length: 11 }, (_, index) => ({
      ...mockStudies[0],
      id: index + 1,
      studyInstanceUID: `SYNTHETIC-${index + 1}`,
      studyDescription: index === 0 ? 'Unique synthetic match' : 'Other study',
    }));
    render(<StudiesDetailTable patientUuid="patientUuid-123" studies={studies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 3');
    const filter = screen.getByPlaceholderText('Filter by study description');
    fireEvent.change(filter, { target: { value: 'Unique' } });
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');
    expect(screen.getByText('Unique synthetic match')).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'No matching synthetic study' } });
    expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');
    fireEvent.change(filter, { target: { value: '' } });
    expect(screen.getByText('Unique synthetic match')).toBeInTheDocument();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
