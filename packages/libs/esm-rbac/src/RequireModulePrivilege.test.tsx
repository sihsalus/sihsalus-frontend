import { render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type UserHasAccessProps = {
  privilege: string | string[];
  fallback?: ReactNode;
  children?: ReactNode;
};

const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowSnackbar = vi.hoisted(() => vi.fn());
const mockUserHasAccess = vi.hoisted(() => vi.fn((_props: UserHasAccessProps): ReactNode => null));

vi.mock('@openmrs/esm-framework', () => ({
  navigate: mockNavigate,
  showSnackbar: mockShowSnackbar,
  UserHasAccess: (props: UserHasAccessProps) => mockUserHasAccess(props),
}));

import { RequireModulePrivilege } from './RequireModulePrivilege';

describe('RequireModulePrivilege', () => {
  beforeEach(() => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    mockNavigate.mockClear();
    mockShowSnackbar.mockClear();
    mockUserHasAccess.mockReset();
  });

  it('renders the module when the user has access', () => {
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);

    render(
      <RequireModulePrivilege privilege="app:referencias">
        <div>Referencias</div>
      </RequireModulePrivilege>,
    );

    expect(screen.getByText('Referencias')).not.toBeNull();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows one informational message before redirecting unauthorized users to home', async () => {
    mockUserHasAccess.mockImplementation(({ fallback }) => <>{fallback}</>);

    render(
      <StrictMode>
        <RequireModulePrivilege privilege="app:referencias">
          <div>Referencias</div>
        </RequireModulePrivilege>
      </StrictMode>,
    );

    expect(screen.queryByText('Referencias')).toBeNull();
    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'info',
        isLowContrast: true,
        title: 'Acceso restringido',
        subtitle: 'No tiene el privilegio requerido para acceder a este módulo. Fue redirigido al inicio.',
      });
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/home' });
    });
    expect(Number(mockShowSnackbar.mock.invocationCallOrder[0])).toBeLessThan(
      Number(mockNavigate.mock.invocationCallOrder[0]),
    );
  });
});
