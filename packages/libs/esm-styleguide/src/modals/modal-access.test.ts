import { getSessionStore, userHasAccess } from '@openmrs/esm-api';
import { reportError } from '@openmrs/esm-error-handling';
import { registerModal } from '@openmrs/esm-extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canLaunchModal, showModal } from '.';

vi.mock('@openmrs/esm-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openmrs/esm-api')>();
  return {
    ...actual,
    getSessionStore: vi.fn(),
    userHasAccess: vi.fn(),
  };
});

vi.mock('@openmrs/esm-error-handling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openmrs/esm-error-handling')>();
  return {
    ...actual,
    reportError: vi.fn(),
  };
});

const mockGetSessionStore = vi.mocked(getSessionStore);
const mockReportError = vi.mocked(reportError);
const mockUserHasAccess = vi.mocked(userHasAccess);
const user = { privileges: [], roles: [] };

describe('canLaunchModal', () => {
  beforeEach(() => {
    mockGetSessionStore.mockReset();
    mockGetSessionStore.mockReturnValue({
      getState: () => ({ session: { user: undefined } }),
    } as ReturnType<typeof getSessionStore>);
    mockReportError.mockReset();
    mockUserHasAccess.mockReset();
  });

  it('allows a modal that does not declare privileges', () => {
    expect(canLaunchModal(undefined, undefined)).toBe(true);
    expect(canLaunchModal([], undefined)).toBe(true);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  it('fails closed when a protected modal has no loaded user', () => {
    expect(canLaunchModal('Edit Visits', undefined)).toBe(false);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  it('delegates a single required privilege to the core access helper', () => {
    mockUserHasAccess.mockReturnValue(true);

    expect(canLaunchModal('Edit Visits', user)).toBe(true);
    expect(mockUserHasAccess).toHaveBeenCalledWith('Edit Visits', user);
  });

  it('preserves all-required semantics for privilege arrays', () => {
    const requiredPrivileges = ['View Visits', 'Edit Visits'];
    mockUserHasAccess.mockReturnValue(false);

    expect(canLaunchModal(requiredPrivileges, user)).toBe(false);
    expect(mockUserHasAccess).toHaveBeenCalledWith(requiredPrivileges, user);
  });

  it('does not load the session merely to open an unrestricted modal', () => {
    const modalName = `unrestricted-modal-${crypto.randomUUID()}`;
    registerModal({ name: modalName, moduleName: 'test', load: vi.fn() });

    showModal(modalName);

    expect(mockGetSessionStore).not.toHaveBeenCalled();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('denies a protected modal before it is opened when the session user is unavailable', () => {
    const modalName = `protected-modal-${crypto.randomUUID()}`;
    registerModal({ name: modalName, moduleName: 'test', load: vi.fn(), privileges: 'Edit Visits' });

    showModal(modalName);

    expect(mockGetSessionStore).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
  });
});
