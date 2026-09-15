import { useSession } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLogger } from './AuditLogger';
import { useAuditLogger } from './useAuditLogger';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

describe('useAuditLogger', () => {
  beforeEach(() => {
    vi.spyOn(auditLogger, 'init').mockImplementation(() => {});
    vi.spyOn(auditLogger, 'destroy').mockImplementation(() => {});
    vi.spyOn(auditLogger, 'setSession').mockImplementation(() => {});
    vi.spyOn(auditLogger, 'clearSession').mockImplementation(() => {});
    vi.spyOn(auditLogger, 'log').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds an authenticated user when the session response omits its identifier', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);

    const { unmount } = renderHook(() => useAuditLogger());

    expect(auditLogger.init).toHaveBeenCalledOnce();
    expect(auditLogger.setSession).toHaveBeenCalledWith('user-1');

    unmount();

    expect(auditLogger.clearSession).toHaveBeenCalled();
    expect(auditLogger.destroy).toHaveBeenCalledOnce();
  });

  it('clears attribution as soon as the session becomes unauthenticated', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);
    const { rerender } = renderHook(() => useAuditLogger());

    vi.mocked(auditLogger.clearSession).mockClear();
    mockUseSession.mockReturnValue({
      authenticated: false,
      sessionId: null,
      user: null,
    } as unknown as ReturnType<typeof useSession>);
    rerender();

    expect(auditLogger.clearSession).toHaveBeenCalledOnce();
  });

  it('updates the actor without passing authentication identifiers to the logger', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);
    const { rerender } = renderHook(() => useAuditLogger());

    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'legacy-authentication-identifier',
      user: { uuid: 'user-2' },
    } as ReturnType<typeof useSession>);
    rerender();

    expect(auditLogger.setSession).toHaveBeenNthCalledWith(1, 'user-1');
    expect(auditLogger.setSession).toHaveBeenNthCalledWith(2, 'user-2');
  });

  it('clears attribution when an authenticated response has no user identity', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: null,
    } as unknown as ReturnType<typeof useSession>);
    renderHook(() => useAuditLogger());

    expect(auditLogger.setSession).not.toHaveBeenCalled();
    expect(auditLogger.clearSession).toHaveBeenCalledOnce();
  });

  it('returns a stable callback that delegates to the shared logger', async () => {
    mockUseSession.mockReturnValue({
      authenticated: false,
      sessionId: null,
      user: null,
    } as unknown as ReturnType<typeof useSession>);
    const { result, rerender } = renderHook(() => useAuditLogger());
    const firstCallback = result.current;

    rerender();
    expect(result.current).toBe(firstCallback);

    await result.current({
      eventType: 'PATIENT_VIEW',
      patientUuid: 'patient-1',
    });
    expect(auditLogger.log).toHaveBeenCalledWith({
      eventType: 'PATIENT_VIEW',
      patientUuid: 'patient-1',
    });
  });
});
