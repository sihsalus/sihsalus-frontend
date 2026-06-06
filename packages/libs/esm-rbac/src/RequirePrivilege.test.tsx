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
    expect(screen.getByText('Access Denied')).toBeTruthy();
    expect(screen.getByText('You need the "Read Fua" privilege to access this section.')).toBeTruthy();
  });

  it('can hide unauthorized content completely', () => {
    mockUserHasAccess.mockImplementation(({ fallback }) => <>{fallback}</>);

    render(
      <RequirePrivilege privilege="Read Fua" hideUnauthorized>
        <span>Protected content</span>
      </RequirePrivilege>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.queryByText('Access Denied')).toBeNull();
  });
});
