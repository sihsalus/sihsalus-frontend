import { getGlobalStore } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockPastVisit } from 'test-utils';
import { useVisit } from './current-visit.resource';
import CurrentVisit from './current-visit-summary.component';

const useVisitMock = vi.mocked(useVisit);
const getGlobalStoreMock = vi.mocked(getGlobalStore);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getGlobalStore: vi.fn(),
}));

vi.mock('./visit-details/current-visit-details.component', () => ({
  default: () => <div>Visit details</div>,
}));

vi.mock('./current-visit.resource', () => ({
  useVisit: vi.fn().mockReturnValue({
    visit: {
      visitType: { display: 'Visit Type' },
      encounters: [],
    },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

const patientUuid = mockPastVisit.data.results[0].patient.uuid;
const visitUuid = mockPastVisit.data.results[0].uuid;

describe('CurrentVisit', () => {
  beforeEach(() => {
    getGlobalStoreMock.mockReturnValue({
      getState: () => ({ openedWindows: [] }),
      subscribe: vi.fn(() => vi.fn()),
    } as unknown as ReturnType<typeof getGlobalStore>);
  });

  it('renders visit details correctly', async () => {
    render(<CurrentVisit patientUuid={patientUuid} visitUuid={visitUuid} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Visit Type')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for today')).toBeInTheDocument();
    expect(screen.getByText('On time')).toBeInTheDocument();
  });
  it('renders a loading skeleton when fetching data', async () => {
    useVisitMock.mockReturnValue({
      visit: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<CurrentVisit patientUuid={patientUuid} visitUuid={visitUuid} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a fallback when visit uuid is missing', async () => {
    useVisitMock.mockReturnValue({
      visit: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<CurrentVisit patientUuid={patientUuid} />);

    expect(useVisitMock).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('No active visit')).toBeInTheDocument();
  });

  it('renders a fallback when visit data is unavailable', async () => {
    useVisitMock.mockReturnValue({
      visit: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<CurrentVisit patientUuid={patientUuid} visitUuid={visitUuid} />);

    expect(screen.getByText('No active visit')).toBeInTheDocument();
  });
});
