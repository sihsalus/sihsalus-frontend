import { useConfig, useLeftNav } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BloodBankConfig } from './config-schema';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import Root from './root.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockUseConfig = vi.mocked(useConfig<BloodBankConfig>);
const mockUseLeftNav = vi.mocked(useLeftNav);

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: vi.fn(),
  useLeftNav: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', async () => {
  const React = await import('react');

  return {
    AppErrorBoundary: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
    RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
  };
});

vi.mock('./blood-bank-app.component', () => ({
  BloodBankApp: () => <div>Blood Bank application</div>,
}));

describe('Blood Bank root', () => {
  beforeEach(() => {
    mockUseLeftNav.mockClear();
    mockUseConfig.mockReturnValue({ enabled: true, useMockData: true });
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct access with the Blood Bank privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: bloodBankPrivileges.module, children: expect.anything() }),
    );
    expect(screen.getByText('Blood Bank application')).toBeInTheDocument();
    expect(mockUseLeftNav).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'blood-bank-nav-slot', basePath: expect.stringContaining('/blood-bank') }),
    );
  });

  it('does not render the application when access is denied', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Root />);

    expect(screen.queryByText('Blood Bank application')).not.toBeInTheDocument();
    expect(mockUseLeftNav).not.toHaveBeenCalled();
  });

  it('renders a safe disabled state', () => {
    mockUseConfig.mockReturnValue({ enabled: false, useMockData: true });

    render(<Root />);

    expect(screen.getByText('Banco de Sangre deshabilitado')).toBeInTheDocument();
  });
});
