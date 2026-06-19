import { render, screen } from '@testing-library/react';
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

vi.mock('./appointments.component', () => ({
  default: () => <div>Appointments dashboard</div>,
}));

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

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:appointments' }));
    expect(screen.getByText('Appointments dashboard')).toBeInTheDocument();
  });

  it('does not render appointments when the privilege guard blocks access', async () => {
    mockRequirePrivilege.mockImplementation(() => null);
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Appointments dashboard')).not.toBeInTheDocument();
  });
});
