import { getDefaultsFromConfigSchema, useAppContext, useConfig, useFeatureFlag } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import { mockWardPatientGroupDetails, mockWardViewContext } from '../../mock';
import { configSchema, type WardConfigObject } from '../config-schema';
import { useObs } from '../hooks/useObs';
import useWardLocation from '../hooks/useWardLocation';
import { type WardViewContext } from '../types';
import DefaultWardView from './default-ward/default-ward-view.component';
import WardView from './ward-view.component';

const mockUseConfig = vi.mocked(useConfig<WardConfigObject>);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseWardLocation = vi.mocked(useWardLocation);
const mockUseParams = vi.mocked(useParams);

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn().mockReturnValue({}),
}));

vi.mock('../hooks/useWardLocation', async () => ({
  default: vi.fn().mockReturnValue({
    location: { uuid: 'abcd', display: 'mock location' },
    isLoadingLocation: false,
    errorFetchingLocation: null,
    invalidLocation: false,
  }),
}));

vi.mock('../hooks/useObs', async () => ({
  useObs: vi.fn(),
}));

vi.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);

//@ts-expect-error
vi.mocked(useObs).mockReturnValue({
  data: [],
});

class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

beforeEach(() => {
  const config = getDefaultsFromConfigSchema<WardConfigObject>(configSchema);
  mockUseConfig.mockReturnValue(config);
});

describe('WardView', () => {
  let restoreBedLayouts: (() => void) | null = null;

  it('renders the session location when no location provided in URL', () => {
    renderWithSwr(<DefaultWardView />);
    const header = screen.getByRole('heading', { name: 'mock location' });
    expect(header).toBeInTheDocument();
  });

  it('renders the location provided in URL', () => {
    mockUseParams.mockReturnValueOnce({ locationUuid: 'abcd' });
    renderWithSwr(<DefaultWardView />);
    const header = screen.getByRole('heading', { name: 'mock location' });
    expect(header).toBeInTheDocument();
  });

  it('renders the correct number of occupied and empty beds', async () => {
    renderWithSwr(<DefaultWardView />);
    const emptyBedCards = await screen.findAllByText(/empty bed/i);
    expect(emptyBedCards).toHaveLength(3);
  });

  it('renders admitted patient without bed', async () => {
    renderWithSwr(<DefaultWardView />);
    const admittedPatientWithoutBed = screen.queryByText('Brian Johnson');
    expect(admittedPatientWithoutBed).toBeInTheDocument();
  });

  it('renders all admitted patients even if bed management module not installed', async () => {
    mockUseFeatureFlag.mockReturnValueOnce(false);
    renderWithSwr(<DefaultWardView />);
    const admittedPatientWithoutBed = screen.queryByText('Brian Johnson');
    expect(admittedPatientWithoutBed).toBeInTheDocument();
  });

  it('renders notification for invalid location uuid', () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: null,
      isLoadingLocation: false,
      errorFetchingLocation: null,
      invalidLocation: true,
    });

    renderWithSwr(<WardView />);
    const notification = screen.getByRole('status');
    expect(notification).toBeInTheDocument();
    const invalidText = screen.queryByText('Invalid location specified');
    expect(invalidText).toBeInTheDocument();
  });

  it('should render warning if backend module installed and no beds configured', () => {
    // override the default response so that no beds are returned
    const wardPatientGroupDetails = mockWardPatientGroupDetails();
    const originalBedLayouts = wardPatientGroupDetails.bedLayouts;
    restoreBedLayouts = () => {
      wardPatientGroupDetails.bedLayouts = originalBedLayouts;
    };
    wardPatientGroupDetails.bedLayouts = [];

    mockUseFeatureFlag.mockReturnValue(true);

    renderWithSwr(<DefaultWardView />);
    const admittedPatientWithoutBed = screen.queryByText('Brian Johnson');
    expect(admittedPatientWithoutBed).toBeInTheDocument();
  });

  it('should not render warning if backend module installed and no beds configured', () => {
    // override the default response so that no beds are returned
    const wardPatientGroupDetails = mockWardPatientGroupDetails();
    const originalBedLayouts = wardPatientGroupDetails.bedLayouts;
    restoreBedLayouts = () => {
      wardPatientGroupDetails.bedLayouts = originalBedLayouts;
    };
    wardPatientGroupDetails.bedLayouts = [];
    mockUseFeatureFlag.mockReturnValue(false);

    renderWithSwr(<WardView />);
    const noBedsConfiguredForThisLocation = screen.queryByText('No beds configured for this location');
    expect(noBedsConfiguredForThisLocation).not.toBeInTheDocument();
  });

  afterEach(() => {
    restoreBedLayouts?.();
    restoreBedLayouts = null;
  });
});
