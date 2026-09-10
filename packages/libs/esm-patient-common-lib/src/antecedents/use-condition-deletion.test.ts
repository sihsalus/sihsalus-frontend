import { act, renderHook } from '@testing-library/react';
import { useConditionDeletion } from './use-condition-deletion';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createOptions() {
  return {
    onDelete: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onDeleteError: vi.fn(),
    onRefreshError: vi.fn(),
    canDelete: true,
  };
}

describe('useConditionDeletion', () => {
  it('prevents same-tick duplicate writes and closure until every refresh page has finished', async () => {
    const options = createOptions();
    const deletion = deferred();
    const refresh = deferred();
    options.onDelete.mockReturnValue(deletion.promise);
    options.refresh.mockReturnValue(refresh.promise);
    const { result } = renderHook(() => useConditionDeletion(options));
    let pending!: Promise<void>;

    act(() => {
      pending = result.current.handleDelete();
      void result.current.handleDelete();
      result.current.handleClose();
    });
    expect(options.onDelete).toHaveBeenCalledOnce();
    expect(options.refresh).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();
    expect(result.current.isDeleting).toBe(true);

    await act(async () => deletion.resolve());
    expect(result.current.isDeleted).toBe(true);
    expect(result.current.isDeleting).toBe(true);
    expect(options.onSuccess).not.toHaveBeenCalled();
    act(() => result.current.handleClose());
    expect(options.onClose).not.toHaveBeenCalled();

    await act(async () => {
      refresh.resolve();
      await pending;
    });
    expect(result.current.isDeleting).toBe(false);
    expect(options.onSuccess).toHaveBeenCalledOnce();
    expect(options.onClose).toHaveBeenCalledOnce();
  });

  it.each([
    new Error('synthetic deletion failure'),
    null,
    undefined,
  ])('releases the pending state after a failed write and permits a retry (%s)', async (error) => {
    const options = createOptions();
    options.onDelete.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useConditionDeletion(options));

    await act(async () => result.current.handleDelete());
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.isDeleted).toBe(false);
    expect(options.onDeleteError).toHaveBeenCalledExactlyOnceWith(error);
    expect(options.onRefreshError).not.toHaveBeenCalled();
    expect(options.refresh).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();

    await act(async () => result.current.handleDelete());
    expect(options.onDelete).toHaveBeenCalledTimes(2);
    expect(result.current.isDeleted).toBe(true);
    expect(options.onSuccess).toHaveBeenCalledOnce();
  });

  it('keeps a confirmed write non-repeatable after refresh failure and re-render', async () => {
    const options = createOptions();
    const error = new Error('synthetic page failure');
    options.refresh.mockRejectedValueOnce(error);
    const { result, rerender } = renderHook(() => useConditionDeletion(options));

    await act(async () => result.current.handleDelete());
    expect(result.current.isDeleted).toBe(true);
    expect(result.current.isDeleting).toBe(false);
    expect(options.onRefreshError).toHaveBeenCalledExactlyOnceWith(error);
    expect(options.onDeleteError).not.toHaveBeenCalled();
    expect(options.onClose).toHaveBeenCalledOnce();
    expect(options.onSuccess).not.toHaveBeenCalled();

    rerender();
    await act(async () => result.current.handleDelete());
    expect(options.onDelete).toHaveBeenCalledOnce();
    expect(options.refresh).toHaveBeenCalledOnce();
  });

  it('locks an unconfirmed deletion without claiming success and permits closing to check the history', async () => {
    const options = createOptions();
    const error = Object.assign(new Error('Synthetic lost acknowledgement'), {
      code: 'CONDITION_WRITE_UNCONFIRMED',
    });
    options.onDelete.mockRejectedValueOnce(error);
    const { result, rerender } = renderHook(() => useConditionDeletion(options));

    await act(async () => result.current.handleDelete());
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.isDeleted).toBe(false);
    expect(result.current.isUncertain).toBe(true);
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onDeleteError).not.toHaveBeenCalled();
    expect(options.onRefreshError).not.toHaveBeenCalled();
    expect(options.refresh).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();

    rerender();
    await act(async () => {
      await result.current.handleDelete();
      await result.current.handleDelete();
    });
    expect(options.onDelete).toHaveBeenCalledOnce();
    expect(result.current.isUncertain).toBe(true);
    act(() => result.current.handleClose());
    expect(options.onClose).toHaveBeenCalledOnce();
  });

  it('honors the current privilege after a failed attempt', async () => {
    const options = createOptions();
    options.onDelete.mockRejectedValueOnce(new Error('synthetic failure'));
    const { result, rerender } = renderHook((canDelete: boolean) => useConditionDeletion({ ...options, canDelete }), {
      initialProps: true,
    });
    await act(async () => result.current.handleDelete());
    rerender(false);
    await act(async () => result.current.handleDelete());
    expect(options.onDelete).toHaveBeenCalledOnce();
    expect(options.refresh).not.toHaveBeenCalled();
    act(() => result.current.handleClose());
    expect(options.onClose).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    'delete',
    'refresh',
  ])('finishes after unmount without acting on a replacement modal (failed stage: %s)', async (failedStage) => {
    const options = createOptions();
    const deletion = deferred();
    options.onDelete.mockReturnValue(deletion.promise);
    if (failedStage === 'refresh') {
      options.refresh.mockRejectedValueOnce(new Error('synthetic refresh failure'));
    }
    const { result, unmount } = renderHook(() => useConditionDeletion(options));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleDelete();
    });
    unmount();

    await act(async () => {
      if (failedStage === 'delete') {
        deletion.reject(new Error('synthetic deletion failure'));
      } else {
        deletion.resolve();
      }
      await pending;
    });
    expect(options.refresh).toHaveBeenCalledTimes(failedStage === 'delete' ? 0 : 1);
    expect(options.onClose).not.toHaveBeenCalled();
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onDeleteError).not.toHaveBeenCalled();
    expect(options.onRefreshError).not.toHaveBeenCalled();
    await result.current.handleDelete();
    result.current.handleClose();
    expect(options.onDelete).toHaveBeenCalledOnce();
    expect(options.onClose).not.toHaveBeenCalled();
  });
});
