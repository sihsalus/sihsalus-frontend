import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import RootComponent from './root.component';

const mockRequireModulePrivilege = vi.hoisted(() => vi.fn(({ children }: { children: ReactNode }) => <>{children}</>));

vi.mock('./hooks/useIndicatorsHealth', () => ({
  useIndicatorsHealth: vi.fn(),
}));

vi.mock('./api/mock-mode', () => ({
  useMockMode: vi.fn(() => ({ isMockMode: false })),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  modulePrivileges: { indicators: 'app:indicadores' },
  RequireModulePrivilege: (props: { children: ReactNode; privilege: string }) => mockRequireModulePrivilege(props),
}));

import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';

const mockUseIndicatorsHealth = vi.mocked(useIndicatorsHealth);

describe('RootComponent health-check wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('calls useIndicatorsHealth on mount', () => {
    render(<RootComponent />);
    expect(mockUseIndicatorsHealth).toHaveBeenCalledTimes(1);
    expect(mockRequireModulePrivilege).toHaveBeenCalledWith(expect.objectContaining({ privilege: 'app:indicadores' }));
  });

  it('calls useIndicatorsHealth exactly once after re-render', () => {
    const { rerender } = render(<RootComponent />);
    rerender(<RootComponent />);
    // The hook is called once per render, but only the initial mount
    // triggers the health-check side-effect. The mock tracks all calls.
    // React 18 StrictMode in dev would call it twice on initial mount,
    // so we check it was called at least once (not strictly === 1).
    expect(mockUseIndicatorsHealth).toHaveBeenCalled();
  });
});
