import { navigate, type Session, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChangeLocationLink from './change-location-link.extension';

const mockNavigate = vi.mocked(navigate);
const mockUseSession = vi.mocked(useSession);
const originalLocation = window.location;

describe('ChangeLocationLink', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://dev3.openmrs.org/openmrs/spa/home') as unknown as Location,
    });

    mockUseSession.mockReturnValue({
      sessionLocation: {
        display: 'Waffle House',
      },
    } as Session);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it('should display the `Change location` link', async () => {
    render(<ChangeLocationLink />);

    const user = userEvent.setup();
    const changeLocationButton = await screen.findByRole('button', {
      name: /Change/i,
    });

    await user.click(changeLocationButton);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/spa/login/location?returnToUrl=/openmrs/spa/home&update=true',
    });
  });

  it('allows admission users to see and change their current location', () => {
    mockUseSession.mockReturnValue({
      user: {
        roles: [{ display: 'Admisión' }],
        privileges: [{ display: 'app:home.admision' }],
      },
      sessionLocation: {
        display: 'UPSS - CONSULTA EXTERNA',
      },
    } as Session);

    render(<ChangeLocationLink />);

    expect(screen.getByRole('button', { name: /Change/i })).toBeInTheDocument();
    expect(screen.getByText(/UPSS - CONSULTA EXTERNA/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Ubicación:?$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/UPSS - CONSULTA EXTERNA/i)).toHaveAttribute('title', 'UPSS - CONSULTA EXTERNA');
  });
});
