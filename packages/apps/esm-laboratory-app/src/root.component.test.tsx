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

vi.mock('./laboratory-dashboard.component', () => ({
  default: () => <div>Laboratory dashboard</div>,
}));

describe('Laboratory root', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    window.history.pushState({}, 'Laboratory', '/openmrs/spa/home/laboratory');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct route access with the laboratory privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:home.laboratorio' }));
    expect(screen.getByText('Laboratory dashboard')).toBeInTheDocument();
  });

  it('does not render the dashboard when the privilege guard blocks access', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Root />);

    expect(screen.queryByText('Laboratory dashboard')).not.toBeInTheDocument();
  });
});
