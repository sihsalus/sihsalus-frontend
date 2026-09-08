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

vi.mock('./patient-search-page/patient-search-page.component', () => ({
  default: () => <div>Patient search page</div>,
}));

describe('Patient search root', () => {
  beforeEach(() => {
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient search', '/openmrs/spa/search');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct search access with the patient search privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:opciones.busquedaPaciente' }),
    );
    expect(screen.getByText('Patient search page')).toBeInTheDocument();
  });

  it('does not render the patient search page when the privilege guard blocks access', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Root />);

    expect(screen.queryByText('Patient search page')).not.toBeInTheDocument();
  });
});
