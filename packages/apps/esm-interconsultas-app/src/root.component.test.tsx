import { render, screen } from '@testing-library/react';
import React from 'react';
import Root from './root.component';
import { expectKnownGap } from './test-utils/expect-known-gap';

const { mockRequirePrivilege } = vi.hoisted(() => ({
  mockRequirePrivilege: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}));

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RequirePrivilege: mockRequirePrivilege,
}));

vi.mock('./dashboard/interconsultas-dashboard.component', () => ({
  default: () => <div>Interconsultas dashboard</div>,
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ element }: { element: React.ReactNode }) => <>{element}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Interconsultas root authorization', () => {
  beforeEach(() => {
    mockRequirePrivilege.mockClear();
    globalThis.spaBase = '/openmrs/spa';
    window.history.pushState({}, '', '/openmrs/spa/home/interconsultas/');
  });

  it('renders the dashboard on its registered home route', () => {
    render(<Root />);

    expect(screen.getByText('Interconsultas dashboard')).toBeInTheDocument();
  });

  it('[AC-02][brecha] protects direct URL access with the home view privilege', async () => {
    await expectKnownGap(() => {
      render(<Root />);

      expect(mockRequirePrivilege).toHaveBeenCalledWith(
        expect.objectContaining({ privilege: 'app:home.interconsultas' }),
        undefined,
      );
    });
  });
});
