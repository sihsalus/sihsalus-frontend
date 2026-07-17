import { navigate } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { careLogbookMergePrivileges } from '../constants';
import CareLogbookAppMenuLink from './care-logbook-app-menu-link.component';
import CareLogbookDashboardLink from './care-logbook-dashboard-link.component';
import CareLogbookMergePatientsAction from './care-logbook-merge-patients-action.component';
import CareLogbookMergePatientsMenuItem from './care-logbook-merge-patients-menu-item.component';

vi.mock('@openmrs/esm-framework', async () => {
  const React = require('react');

  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    ConfigurableLink: ({ children, to, ...props }) => React.createElement('a', { href: to, ...props }, children),
    navigate: vi.fn(),
  };
});

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children, privilege }: { children: React.ReactNode; privilege: string | string[] }) => (
    <div data-required-privileges={Array.isArray(privilege) ? privilege.join(',') : privilege}>{children}</div>
  ),
}));

const mockNavigate = vi.mocked(navigate);

describe('care logbook navigation links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    globalThis.spaBase = '/openmrs/spa';
  });

  it('renders the app menu link to the care logbook', () => {
    render(<CareLogbookAppMenuLink />);

    expect(screen.getByRole('link', { name: /atenciones/i })).toHaveAttribute('href', '/openmrs/spa/home/care-logbook');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the dashboard tile link to the care logbook', () => {
    render(<CareLogbookDashboardLink />);

    expect(screen.getByRole('link', { name: /atenciones/i })).toHaveAttribute('href', '/openmrs/spa/home/care-logbook');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates directly to the merge route from the top nav action', async () => {
    const user = userEvent.setup();
    render(<CareLogbookMergePatientsAction />);

    const mergeAction = screen.getByRole('button', { name: /fusionar historias/i });
    await user.click(mergeAction);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/home/care-logbook/merge' });
    expect(mergeAction.closest('[data-required-privileges]')).toHaveAttribute(
      'data-required-privileges',
      careLogbookMergePrivileges.join(','),
    );
  });

  it('renders the patient actions merge entry as a text menu item', async () => {
    const user = userEvent.setup();
    render(<CareLogbookMergePatientsMenuItem closeMenu={vi.fn()} />);

    const mergeMenuItem = screen.getByRole('menuitem', { name: /fusionar historias/i });
    await user.click(mergeMenuItem);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/home/care-logbook/merge' });
    expect(mergeMenuItem.closest('[data-required-privileges]')).toHaveAttribute(
      'data-required-privileges',
      careLogbookMergePrivileges.join(','),
    );
  });
});
