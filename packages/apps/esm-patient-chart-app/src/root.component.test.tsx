import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
  fallback?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  navigate: mockNavigate,
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('./patient-chart/patient-chart.component', () => ({
  default: () => <div>Patient chart</div>,
}));

describe('Patient chart root', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient chart', '/openmrs/spa/patient/test-patient/chart');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
    mockNavigate.mockClear();
  });

  it('protects direct chart access with the clinical chart privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: 'app:hoja.clinica', fallback: expect.anything() }),
    );
    expect(screen.getByText('Patient chart')).toBeInTheDocument();
  });

  it('redirects to the frontend home when the privilege guard blocks access', async () => {
    mockRequirePrivilege.mockImplementation(({ fallback }) => <>{fallback}</>);
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Patient chart')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/home/home' });
    });
  });
});
