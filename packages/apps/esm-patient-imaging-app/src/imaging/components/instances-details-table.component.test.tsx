import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import * as api from '../../api';
import InstancesDetailsTable, { type InstancesDetailsTableProps } from './instances-details-table.component';

type PaginationProps = {
  pageNumber: number;
  totalItems: number;
};

type EmptyStateProps = {
  displayText: string;
};

vi.mock('../../api');
vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/ws/rest/v1',
  useLayoutType: () => 'desktop',
  usePagination: (data: unknown[], pagesize: number) => ({
    results: data.slice(0, pagesize),
    goto: vi.fn(),
    currentPage: 1,
  }),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
  PatientChartPagination: ({ pageNumber, totalItems }: PaginationProps) => (
    <div data-testid="pagination">
      Page {pageNumber} of {totalItems}
    </div>
  ),
  EmptyState: ({ displayText }: EmptyStateProps) => <div data-testid="empty-state">{displayText}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('InstancesDetailsTable', () => {
  const orignalError = console.error;

  const mockConfig = {
    id: 1,
    orthancBaseUrl: 'http://orthanc.local',
    orthancProxyUrl: 'http://orthanc.proxy',
  };

  const defaultProps: InstancesDetailsTableProps = {
    studyId: 1,
    studyInstanceUID: '1.2.3',
    seriesInstanceUID: '1.2.3.4.5',
    orthancConfig: mockConfig,
    seriesModality: 'CT',
  };

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (msg.includes('warning') || msg.includes('ResizeObserver')) {
        return;
      }
      orignalError(msg, ...args);
    });
  });

  afterAll(() => {
    console.error = orignalError;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (api.useStudyInstances as vi.Mock).mockReturnValue({
      data: [
        {
          sopInstanceUID: '1.2.3',
          instanceNumber: 1,
          imagePositionPatient: '0\\0\\0',
          numberOfFrames: 10,
          orthancInstanceUID: 'inst-1',
        },
        {
          sopInstanceUID: '4.5.6',
          instanceNumber: 2,
          imagePositionPatient: '1\\0\\0',
          numberOfFrames: 12,
          orthancInstanceUID: 'inst-2',
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        origin: 'http://openmrs.sihsalus.gidistest',
      },
    });
    window.open = vi.fn();
  });

  it('renders table with instances and pagination', async () => {
    await act(async () => {
      render(<InstancesDetailsTable {...defaultProps} />);
    });

    // Check table headers
    expect(screen.getByText('SOP Instance UID')).toBeInTheDocument();
    expect(screen.getByText('Instance number')).toBeInTheDocument();
    expect(screen.getByText('Number of frames')).toBeInTheDocument();
    expect(screen.getByText('Image position of Patient')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Check table rows
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('0\\0\\0')).toBeInTheDocument();

    expect(screen.getByText('4.5.6')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1\\0\\0')).toBeInTheDocument();

    // Check pagination
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('opens local and Orthanc previews in new windows when buttons are clicked', async () => {
    await act(async () => {
      render(<InstancesDetailsTable {...defaultProps} />);
    });

    const row = screen.getByText('1.2.3').closest('tr');

    const localBtn = within(row!).getByLabelText('Instance preview local');
    const orthancBtn = within(row!).getByLabelText('Instance view in Orthanc');

    fireEvent.click(localBtn);

    await act(async () => {
      fireEvent.click(orthancBtn);
    });

    expect(window.open).toHaveBeenNthCalledWith(
      1,
      'http://openmrs.sihsalus.gidistest/imaging/previewinstance?orthancInstanceUID=inst-1&studyId=1',
      '_blank',
      'noopener,noreferrer',
    );
    expect(window.open).toHaveBeenCalledWith(
      'http://openmrs.sihsalus.gidistest/orthanc/instances/inst-1/preview',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('shows loading state when data is being fetched', async () => {
    (api.useStudyInstances as vi.Mock).mockReturnValue({
      data: [],
      error: null,
      isLoading: true,
      isValidating: false,
    });

    await act(async () => {
      render(<InstancesDetailsTable {...defaultProps} />);
    });

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });
});
