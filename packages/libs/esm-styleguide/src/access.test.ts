import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetState = vi.hoisted(() => vi.fn());
const mockUserHasAccess = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-api', () => ({
  sessionStore: { getState: mockGetState },
  userHasAccess: mockUserHasAccess,
}));

import { userCanLaunch } from './access';

describe('userCanLaunch', () => {
  beforeEach(() => {
    mockGetState.mockReturnValue({ session: {} });
    mockUserHasAccess.mockReset();
  });

  it('allows unprotected registrations without a loaded user', () => {
    expect(userCanLaunch()).toBe(true);
    expect(userCanLaunch([])).toBe(true);
  });

  it('fails closed when a protected registration has no loaded user', () => {
    expect(userCanLaunch('app:reportes')).toBe(false);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  it('delegates protected registrations to the standard privilege evaluator', () => {
    const user = { uuid: 'user-1' };
    mockGetState.mockReturnValue({ session: { user } });
    mockUserHasAccess.mockReturnValue(true);

    expect(userCanLaunch('app:reportes')).toBe(true);
    expect(mockUserHasAccess).toHaveBeenCalledWith('app:reportes', user);
  });
});
