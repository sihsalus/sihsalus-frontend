import { act, renderHook } from '@testing-library/react';
import { useImagingAccess } from './use-imaging-access';
import { useImagingOperation } from './use-imaging-operation';

describe('imaging operation lifecycle', () => {
  beforeEach(() => vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true }));
  it('locks synchronously and unlocks after a failed or successful operation', () => {
    const { result } = renderHook(() => useImagingOperation('patient-a'));
    let controller: AbortController;
    act(() => {
      controller = result.current.start();
      expect(result.current.start()).toBeNull();
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.isCurrent(controller)).toBe(true);
    act(() => result.current.finish(controller));
    expect(result.current.isPending).toBe(false);
    act(() => expect(result.current.start()).not.toBeNull());
  });

  it('aborts and rejects stale completions after a patient change', () => {
    const { result, rerender, unmount } = renderHook(({ patient }) => useImagingOperation(patient), {
      initialProps: { patient: 'patient-a' },
    });
    let original: AbortController;
    act(() => {
      original = result.current.start();
    });
    rerender({ patient: 'patient-b' });
    expect(original.signal.aborted).toBe(true);
    expect(result.current.isCurrent(original)).toBe(false);
    let next: AbortController;
    act(() => {
      next = result.current.start();
    });
    act(() => result.current.finish(original));
    expect(result.current.isPending).toBe(true);
    unmount();
    expect(next.signal.aborted).toBe(true);
    expect(result.current.isCurrent(next)).toBe(false);
    expect(result.current.start()).toBeNull();
  });

  it('aborts pending writes and blocks new writes when access or connectivity is lost', () => {
    const { result, rerender } = renderHook(() => useImagingOperation('synthetic-patient'));
    let controller: AbortController;
    act(() => {
      controller = result.current.start();
    });
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: false, isOnline: false });
    rerender();
    expect(controller.signal.aborted).toBe(true);
    expect(result.current.isCurrent(controller)).toBe(false);
    expect(result.current.start()).toBeNull();
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true });
    rerender();
    expect(result.current.start()).toBeNull();
    act(() => result.current.finish(controller));
    act(() => expect(result.current.start()).not.toBeNull());
  });

  it('rejects an old acknowledgement when the authenticated user changes', () => {
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true, userUuid: 'synthetic-user-a' });
    const { result, rerender } = renderHook(() => useImagingOperation('synthetic-patient'));
    let controller: AbortController;
    act(() => {
      controller = result.current.start();
    });
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true, userUuid: 'synthetic-user-b' });
    rerender();
    expect(controller.signal.aborted).toBe(true);
    expect(result.current.isCurrent(controller)).toBe(false);
  });
});

vi.mock('./use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
