import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Root from './root.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('./home.component', () => ({
  default: () => <div>Service queues home</div>,
}));

vi.mock('./queue-patient-linelists/queue-services-table.component', () => ({
  default: () => <div>Queue services table</div>,
}));

vi.mock('./queue-patient-linelists/scheduled-appointments-table.component', () => ({
  default: () => <div>Scheduled appointments table</div>,
}));

vi.mock('./queue-screen/queue-screen.component', () => ({
  default: () => <div>Queue screen</div>,
}));

vi.mock('./views/queue-table-by-status-view.component', () => ({
  default: () => <div>Queue table by status</div>,
}));

describe('Service queues root', () => {
  beforeEach(() => {
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    vi.stubGlobal('spaBase', '/openmrs/spa');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
    window.history.pushState({}, 'Service queues', '/openmrs/spa/home/service-queues');
  });

  it('protects direct queues access with the service queues privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:home.colasAtencion' }));
    expect(screen.getByText('Service queues home')).toBeInTheDocument();
  });

  it('does not render the queues home when the privilege guard blocks access', () => {
    mockRequirePrivilege.mockImplementation(() => null);
    render(<Root />);

    expect(screen.queryByText('Service queues home')).not.toBeInTheDocument();
  });
});
