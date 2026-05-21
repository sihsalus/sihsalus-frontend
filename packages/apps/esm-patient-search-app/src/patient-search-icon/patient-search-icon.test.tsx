import { getDefaultsFromConfigSchema, isDesktop, useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { configSchema, type PatientSearchConfig } from '../config-schema';

import PatientSearchLaunch from './patient-search-icon.component';

const mockIsDesktop = vi.mocked(isDesktop);
const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseSession = vi.mocked(useSession);

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useSearchParams: vi.fn(() => [
    {
      get: vi.fn(() => 'John'),
    },
  ]),
}));

describe('PatientSearchLaunch', () => {
  beforeEach(() => {
    mockIsDesktop.mockReturnValue(true);
    mockUseSession.mockReturnValue({
      user: { uuid: 'test-user-uuid' },
      sessionLocation: { uuid: 'test-location-uuid' },
    } as ReturnType<typeof useSession>);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      search: {
        disableTabletSearchOnKeyUp: false,
        showRecentlySearchedPatients: false,
      } as PatientSearchConfig['search'],
    });
  });

  it('renders without errors', () => {
    render(<PatientSearchLaunch />);
    expect(screen.getByRole('button', { name: /search patient/i })).toBeInTheDocument();
  });

  it('toggles search input when search button is clicked', async () => {
    const user = userEvent.setup();
    render(<PatientSearchLaunch />);

    const searchButton = screen.getByRole('button', { name: /search patient/i });

    await user.click(searchButton);
    const closeButton = await screen.findByTestId('closeSearchIcon');
    expect(closeButton).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();

    await user.click(closeButton);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('displays search input in overlay on mobile', async () => {
    const user = userEvent.setup();
    mockIsDesktop.mockReturnValue(false);

    render(<PatientSearchLaunch />);

    const searchButton = screen.getByRole('button', { name: /search patient/i });

    await user.click(searchButton);
    expect(await screen.findByTestId('closeSearchIcon')).toBeInTheDocument();
    expect(screen.getByText(/search results/i)).toBeInTheDocument();
  });
});
