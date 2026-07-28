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

  it('initializes the shared logger and binds the authenticated session', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-1',
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);

    const { unmount } = renderHook(() => useAuditLogger());

    expect(auditLogger.init).toHaveBeenCalledOnce();
    expect(auditLogger.setSession).toHaveBeenCalledWith('user-1', 'session-1');

    unmount();

    expect(auditLogger.clearSession).toHaveBeenCalled();
    expect(auditLogger.destroy).toHaveBeenCalledOnce();
  });

  it('clears attribution as soon as the session becomes unauthenticated', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-1',
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

    await result.current({ eventType: 'PATIENT_VIEW', patientUuid: 'patient-1' });
    expect(auditLogger.log).toHaveBeenCalledWith({ eventType: 'PATIENT_VIEW', patientUuid: 'patient-1' });
  });
});
