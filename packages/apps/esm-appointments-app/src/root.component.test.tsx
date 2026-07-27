import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('./appointments.component', async () => {
  const { Link } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    default: () => (
      <>
        <div>Appointments dashboard</div>
        <Link to="/calendar/2026-07-24?services=service-one">Open appointments calendar</Link>
      </>
    ),
  };
});

vi.mock('./calendar/appointments-calendar-view.component', () => ({
  default: () => <div>Appointments calendar</div>,
}));

vi.mock('./patient-appointments/patient-appointments-overview.component', () => ({
  default: () => <div>Patient appointments overview</div>,
}));

describe('Appointments root', () => {
  beforeEach(() => {
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa/');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
    window.history.pushState({}, 'Appointments', '/openmrs/spa/home/appointments');
  });

  it('protects direct appointments access with the appointments privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:home.citas' }));
    expect(screen.getByText('Appointments dashboard')).toBeInTheDocument();
  });

  it('does not render appointments when the privilege guard blocks access', async () => {
    mockRequirePrivilege.mockImplementation(() => null);
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Appointments dashboard')).not.toBeInTheDocument();
  });

  it('preserves the clinical route and filters while navigating through browser history', async () => {
    const user = userEvent.setup();
    const { default: Root } = await import('./root.component');

    render(<Root />);
    await user.click(screen.getByRole('link', { name: 'Open appointments calendar' }));

    expect(screen.getByText('Appointments calendar')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/openmrs/spa/home/appointments/calendar/2026-07-24');
    expect(window.location.search).toBe('?services=service-one');

    await act(async () => {
      window.history.back();
    });

    await waitFor(() => {
      expect(screen.getByText('Appointments dashboard')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/openmrs/spa/home/appointments');
      expect(window.location.search).toBe('');
    });

    await act(async () => {
      window.history.forward();
    });

    await waitFor(() => {
      expect(screen.getByText('Appointments calendar')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/openmrs/spa/home/appointments/calendar/2026-07-24');
      expect(window.location.search).toBe('?services=service-one');
    });
  });
});
