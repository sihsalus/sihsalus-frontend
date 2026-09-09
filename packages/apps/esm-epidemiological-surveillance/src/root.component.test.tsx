import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { epidemiologicalSurveillanceReadPrivilege } from './constants';
import Root from './root.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  hideUnauthorized?: boolean;
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));

vi.mock('@sihsalus/esm-rbac', async () => {
  const React = await import('react');

  return {
    AppErrorBoundary: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
    RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
  };
});

describe('epidemiological surveillance root', () => {
  beforeEach(() => {
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct dashboard access with the read privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: epidemiologicalSurveillanceReadPrivilege,
        children: expect.anything(),
      }),
    );
    expect(screen.getByText('Epidemiological Surveillance')).toBeInTheDocument();
  });

  it('does not render the dashboard when access is denied', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Root />);

    expect(screen.queryByText('Epidemiological Surveillance')).not.toBeInTheDocument();
  });
});
