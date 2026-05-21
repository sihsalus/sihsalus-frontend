import { showModal, usePagination } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as api from '../../api';
import SeriesDetailsTable from './series-details-table.component';

type IconProps = Record<string, unknown>;
type TableHeaderMock = {
  key: string;
  header: string;
};
type TableCellMockValue = ReactNode | { content?: ReactNode };
type TableRowMock = {
  id: string | number;
} & Record<string, TableCellMockValue>;
type PageChangeProps = {
  onPageNumberChange: ({ page }: { page: number }) => void;
};
type EmptyStateProps = {
  displayText: string;
  headerTitle: string;
};

vi.mock('react-i18next', async () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

const mockSeries = [
  {
    seriesInstanceUID: 'SERIES1',
    modality: 'CT',
    seriesDate: '2025-08-29',
    seriesDescription: 'Head scan',
    orthancSeriesUID: 'UID123',
  },
  {
    seriesInstanceUID: 'SERIES2',
    modality: 'MRI',
    seriesDate: '2025-08-30',
    seriesDescription: 'Brain scan',
    orthancSeriesUID: 'UID124',
  },
];

const mockConfig = {
  id: 1,
  orthancBaseUrl: 'http://orthanc.local',
  orthancProxyUrl: '',
};

vi.mock('../../api');
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useLayoutType: vi.fn(() => 'desktop'),
  showModal: vi.fn(),
  usePagination: vi.fn(() => ({
    results: mockSeries,
    goTo: vi.fn(),
    currentPage: 1,
  })),
  TrashCanIcon: (props: IconProps) => <span data-testid="trash-icon" {...props} />,
}));

vi.mock('@carbon/react', async () => {
  const original = await vi.importActual('@carbon/react');
  return {
    ...original,
    DataTable: ({ headers, rows }: { headers: Array<TableHeaderMock>; rows: Array<TableRowMock> }) => (
      <table aria-label="Series summary">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h.key}>{h.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {headers.map((h) => (
                <td key={h.key}>{r[h.key]?.content ?? r[h.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  PatientChartPagination: ({ onPageNumberChange }: PageChangeProps) => (
    <button type="button" onClick={() => onPageNumberChange({ page: 2 })}>
      Next
    </button>
  ),

  EmptyState: ({ displayText, headerTitle }: EmptyStateProps) => (
    <div>
      {headerTitle}: {displayText}
    </div>
  ),
  compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
}));

describe('SeriesDetailsTable', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders EmptyState when no series are available', async () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      results: [],
      error: null,
      isLoading: false,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      );
    });

    expect(screen.getByText(/Series: No series available/i)).toBeInTheDocument();
  });

  it('renders rows and triggers row actions', async () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeries,
      error: null,
      isLoading: false,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      );
    });

    // check row values
    const row1 = screen
      .getAllByRole('row')
      .find((r) => within(r).queryByText((content) => content.includes('SERIES1')));
    expect(row1).toBeTruthy();

    const row2 = screen
      .getAllByRole('row')
      .find((r) => within(r).queryByText((content) => content.includes('SERIES2')));
    expect(row2).toBeTruthy();

    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByText('Head scan')).toBeInTheDocument();
    expect(screen.getByText('MRI')).toBeInTheDocument();
    expect(screen.getByText('Brain scan')).toBeInTheDocument();

    // Click triggers modal
    const trashIcon = screen.getAllByTestId('trash-icon')[0];
    fireEvent.click(trashIcon);
    expect(showModal).toHaveBeenCalled();
  });

  it('triggers pagination goto function', async () => {
    const goToMock = vi.fn();
    (usePagination as vi.Mock).mockReturnValue({
      results: mockSeries,
      currentPage: 1,
      goTo: goToMock,
    });

    await act(async () =>
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      ),
    );

    // simulate page change
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    expect(goToMock).toHaveBeenCalledWith(2);
  });

  it('renders series rows when data is returned', async () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeries,
      error: null,
      isLoading: true,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID={'1.2.3'}
          patientUuid={'patient-123'}
          orthancConfig={mockConfig}
        />,
      );
    });

    expect(screen.getAllByText(/description/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Modality/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Series UID/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Action/i).length).toBeGreaterThan(0);

    // Row values
    expect(screen.getByText('SERIES1')).toBeInTheDocument();
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByText('Head scan')).toBeInTheDocument();
  });

  it('renders series row with empty modality or description', async () => {
    const mockSeriesWithEmptyFields = [
      {
        seriesInstanceUID: 'SERIES_EMPTY',
        modality: '',
        seriesDate: '2025-08-31',
        seriesDescription: '',
        orthancSeriesUID: 'UID125',
      },
    ];
    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeriesWithEmptyFields,
      error: null,
      isLoading: false,
      isValidating: false,
    });
    // expect(screen.getByText('SERIES_EMPTY')).toBeInTheDocument();
    expect(screen.getByText('')).toBeInTheDocument(); // empty description
    expect(screen.getAllByText('').length).toBeGreaterThanOrEqual(1); // empty modality
  });

  it('triggers action buttons', async () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeries,
      error: null,
      isLoading: false,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      );
    });

    const trashButton = screen.getAllByTestId('trash-icon')[0];
    fireEvent.click(trashButton);
    expect(showModal).toHaveBeenCalled();

    const stoneViewerButton = screen.getAllByLabelText(/Stone viewer of Orthanc/i)[0];
    fireEvent.click(stoneViewerButton);

    const orthancExplorerButton = screen.getAllByLabelText(/Show data in orthanc explorere/i)[0];
    fireEvent.click(orthancExplorerButton);
  });

  it('sorts table when clicking headers', async () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeries,
      error: null,
      isLoading: false,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      );
    });

    const headers = screen.getAllByText(
      (content, element) => element?.tagName === 'TH' && content.includes('Series UID'),
    );
    fireEvent.click(headers[0]);
    fireEvent.click(headers[0]);
  });

  it('does not render preview buttons for RTSTRUCT or RTDOSE', async () => {
    const mockSeriesRT = [
      {
        seriesInstanceUID: 'SERIES_RT',
        modality: 'RTSTRUCT',
        seriesDate: '2025-09-02',
        seriesDescription: 'Structure',
        orthancSeriesUID: 'UID_RT',
      },
    ];

    (api.useStudySeries as vi.Mock).mockReturnValue({
      data: mockSeriesRT,
      error: null,
      isLoading: false,
      isValidating: false,
    });

    await act(async () => {
      render(
        <SeriesDetailsTable
          studyId={1}
          studyInstanceUID="1.2.3"
          patientUuid="patient-123"
          orthancConfig={mockConfig}
        />,
      );
    });

    expect(screen.queryByLabelText(/Instance preview local/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Instance view in Orthanc/i)).not.toBeInTheDocument();
  });
});
