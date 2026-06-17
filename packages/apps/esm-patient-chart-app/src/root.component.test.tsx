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

vi.mock('./patient-chart/patient-chart.component', () => ({
  default: () => <div>Patient chart</div>,
}));

describe('Patient chart root', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
    window.history.pushState({}, 'Patient chart', '/openmrs/spa/patient/test-patient/chart');
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct chart access with the clinical chart privilege', async () => {
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:clinical.chart' }));
    expect(screen.getByText('Patient chart')).toBeInTheDocument();
  });

  it('does not render the chart when the privilege guard blocks access', async () => {
    mockRequirePrivilege.mockImplementation(() => null);
    const { default: Root } = await import('./root.component');

    render(<Root />);

    expect(screen.queryByText('Patient chart')).not.toBeInTheDocument();
  });
});
