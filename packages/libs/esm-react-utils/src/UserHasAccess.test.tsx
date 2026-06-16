import type { LoggedInUser, Privilege, Role, Session } from '@openmrs/esm-api';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { userHasAccess } from '@openmrs/esm-api';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserHasAccess } from './UserHasAccess';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { useSession } from './useSession';

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  userHasAccess: vi.fn(),
}));

vi.mock('@openmrs/esm-api', () => ({
  userHasAccess: (...args: Parameters<typeof userHasAccess>) => mocks.userHasAccess(...args),
}));

vi.mock('./useSession', () => ({
  useSession: (): ReturnType<typeof useSession> => mocks.useSession(),
}));

function createMockUser(privileges: string[] = [], roles: string[] = []): LoggedInUser {
  return {
    uuid: 'user-uuid',
    display: 'Test User',
    username: 'testuser',
    systemId: 'testuser',
    userProperties: {},
    person: {
      uuid: 'person-uuid',
      display: 'Test User',
    },
    privileges: privileges.map((privilege) => ({
      uuid: `priv-${privilege}`,
      display: privilege,
    })) as Privilege[],
    roles: roles.map((role) => ({
      uuid: `role-${role}`,
      display: role,
    })) as Role[],
    retired: false,
    locale: 'en',
    allowedLocales: ['en'],
  };
}

function createSession(user?: LoggedInUser): Session {
  return {
    authenticated: Boolean(user),
    sessionId: 'session-id',
    user,
  } as Session;
}

describe('UserHasAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when the loaded user has the required privilege', () => {
    const user = createMockUser(['Edit Patients']);
    mocks.useSession.mockReturnValue(createSession(user));
    mocks.userHasAccess.mockReturnValue(true);

    render(
      <UserHasAccess privilege="Edit Patients">
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mocks.userHasAccess).toHaveBeenCalledWith('Edit Patients', user);
  });

  it('passes multiple required privileges to the access helper', () => {
    const user = createMockUser(['Edit Patients', 'Delete Patients']);
    mocks.useSession.mockReturnValue(createSession(user));
    mocks.userHasAccess.mockReturnValue(true);

    render(
      <UserHasAccess privilege={['Edit Patients', 'Delete Patients']}>
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mocks.userHasAccess).toHaveBeenCalledWith(['Edit Patients', 'Delete Patients'], user);
  });

  it('renders nothing when the loaded user lacks access and no fallback is provided', () => {
    const user = createMockUser(['View Patients']);
    mocks.useSession.mockReturnValue(createSession(user));
    mocks.userHasAccess.mockReturnValue(false);

    const { container } = render(
      <UserHasAccess privilege="Edit Patients">
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // eslint-disable-next-line jest-dom/prefer-empty, testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('renders the fallback when the loaded user lacks access', () => {
    const user = createMockUser(['View Patients']);
    mocks.useSession.mockReturnValue(createSession(user));
    mocks.userHasAccess.mockReturnValue(false);

    render(
      <UserHasAccess privilege="Edit Patients" fallback={<div>Access Denied</div>}>
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders the fallback when the loaded session is unauthenticated', () => {
    mocks.useSession.mockReturnValue(createSession());

    render(
      <UserHasAccess privilege="Edit Patients" fallback={<div>Please log in</div>}>
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(mocks.userHasAccess).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Please log in')).toBeInTheDocument();
  });

  it('does not render the unauthorized fallback while the session is still loading', () => {
    const pendingSession = new Promise<Session>(() => {});
    mocks.useSession.mockImplementation(() => {
      throw pendingSession;
    });

    render(
      <Suspense fallback={<div>Loading session</div>}>
        <UserHasAccess privilege="Edit Patients" fallback={<div>Access Denied</div>}>
          <div>Protected Content</div>
        </UserHasAccess>
      </Suspense>,
    );

    expect(screen.getByText('Loading session')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('updates authorization when the session changes', () => {
    const unauthorizedUser = createMockUser(['View Patients']);
    const authorizedUser = createMockUser(['Edit Patients']);
    mocks.useSession.mockReturnValue(createSession(unauthorizedUser));
    mocks.userHasAccess.mockReturnValue(false);

    const { rerender } = render(
      <UserHasAccess privilege="Edit Patients" fallback={<div>No Access</div>}>
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    mocks.useSession.mockReturnValue(createSession(authorizedUser));
    mocks.userHasAccess.mockReturnValue(true);
    rerender(
      <UserHasAccess privilege="Edit Patients" fallback={<div>No Access</div>}>
        <div>Protected Content</div>
      </UserHasAccess>,
    );

    expect(screen.queryByText('No Access')).not.toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
