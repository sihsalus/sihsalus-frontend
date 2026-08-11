import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirePrivilege } from './RequirePrivilege';

type UserHasAccessProps = {
  privilege: string | string[];
  fallback?: ReactNode;
  children?: ReactNode;
};

const mockUserHasAccess = vi.hoisted(() => vi.fn((_props: UserHasAccessProps): ReactNode => null));

vi.mock('@openmrs/esm-framework', () => ({
  UserHasAccess: (props: UserHasAccessProps) => mockUserHasAccess(props),
}));

describe('RequirePrivilege', () => {
  beforeEach(() => {
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);
  });

  it('delegates authorization to the OpenMRS UserHasAccess component', () => {
    render(
      <RequirePrivilege privilege="Get Queue Entries">
        <span>Protected content</span>
      </RequirePrivilege>,
    );

    expect(screen.getByText('Protected content')).toBeTruthy();
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: 'Get Queue Entries',
        children: expect.anything(),
      }),
    );
  });

  it('renders the default unauthorized state through UserHasAccess fallback', () => {
    mockUserHasAccess.mockImplementation(({ fallback }) => <>{fallback}</>);

    render(
      <RequirePrivilege privilege="Read Fua">
        <span>Protected content</span>
      </RequirePrivilege>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('Sección no disponible para su usuario')).toBeTruthy();
    // The operator-facing copy stays task-oriented: the privilege identifier is
    // only exposed to support through the data attribute.
    expect(screen.queryByText(/Read Fua/)).toBeNull();
    expect(screen.getByText(/solicite el acceso al administrador/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /volver/i })).toBeTruthy();
  });

  it('can hide unauthorized content completely', () => {
    mockUserHasAccess.mockImplementation(({ fallback }) => <>{fallback}</>);

    render(
      <RequirePrivilege privilege="Read Fua" hideUnauthorized>
        <span>Protected content</span>
      </RequirePrivilege>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.queryByText('Acceso denegado')).toBeNull();
  });
});
