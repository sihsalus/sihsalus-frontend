import { navigate } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdmissionAppMenuLink from './admission-app-menu-link.component';
import AdmissionDashboardLink from './admission-dashboard-link.component';
import AdmissionMergePatientsAction from './admission-merge-patients-action.component';

vi.mock('@openmrs/esm-framework', async () => {
  const React = require('react');

  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    ConfigurableLink: ({ children, to, ...props }) => React.createElement('a', { href: to, ...props }, children),
    navigate: vi.fn(),
  };
});

const mockNavigate = vi.mocked(navigate);

describe('admission navigation links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    globalThis.spaBase = '/openmrs/spa';
  });

  it('renders the app menu link to the admission app', () => {
    render(<AdmissionAppMenuLink />);

    expect(screen.getByRole('link', { name: /admisión/i })).toHaveAttribute('href', '/openmrs/spa/admission');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the dashboard tile link to the admission app', () => {
    render(<AdmissionDashboardLink />);

    expect(screen.getByRole('link', { name: /admisiones/i })).toHaveAttribute('href', '/openmrs/spa/home/admission');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates directly to the merge route from the top nav action', async () => {
    const user = userEvent.setup();
    render(<AdmissionMergePatientsAction />);

    await user.click(screen.getByRole('button', { name: /fusionar historias/i }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/admission/merge' });
  });
});
