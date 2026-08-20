import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OfflineActions from './offline-actions.component';

const mocks = vi.hoisted(() => ({
  deleteSynchronizationItem: vi.fn(),
  mutatePendingSyncItems: vi.fn(),
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  deleteSynchronizationItem: mocks.deleteSynchronizationItem,
  getOfflineSynchronizationStore: () => ({}),
  showModal: mocks.showModal,
  showSnackbar: mocks.showSnackbar,
  useStore: () => ({ synchronization: undefined }),
}));

vi.mock('../hooks/offline-actions', () => ({
  usePendingSyncItems: () => ({
    data: [
      { id: 1, descriptor: {}, type: 'test' },
      { id: 2, descriptor: {}, type: 'test' },
    ],
    mutate: mocks.mutatePendingSyncItems,
  }),
  useSyncItemPatients: () => ({ data: [] }),
}));

vi.mock('./offline-actions-table.component', () => ({
  default: ({ onDelete }: { onDelete: (ids: Array<number>) => void }) => (
    <button type="button" onClick={() => onDelete([1, 2])}>
      Delete pending actions
    </button>
  ),
}));

function createDeferredDeletion() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function openDeletionConfirmation() {
  const user = userEvent.setup();
  render(<OfflineActions />);
  await user.click(screen.getByRole('button', { name: 'Delete pending actions' }));

  return mocks.showModal.mock.calls[0]?.[1] as { onConfirm: () => void };
}

describe('OfflineActions deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteSynchronizationItem.mockResolvedValue(undefined);
    mocks.mutatePendingSyncItems.mockResolvedValue(undefined);
    mocks.showModal.mockReturnValue(vi.fn());
  });

  it('settles every deletion before refreshing and gives deletion failure precedence', async () => {
    const deferredDeletion = createDeferredDeletion();
    const sensitiveDeleteError =
      'IndexedDB failure for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    mocks.deleteSynchronizationItem
      .mockRejectedValueOnce(new Error(sensitiveDeleteError))
      .mockImplementationOnce(() => deferredDeletion.promise);
    mocks.mutatePendingSyncItems.mockRejectedValueOnce(new Error('Queue refresh failed'));
    const modalProps = await openDeletionConfirmation();

    expect(modalProps.onConfirm()).toBeUndefined();
    await waitFor(() => expect(mocks.deleteSynchronizationItem).toHaveBeenCalledTimes(2));
    expect(mocks.mutatePendingSyncItems).not.toHaveBeenCalled();

    deferredDeletion.resolve();

    await waitFor(() => {
      expect(mocks.mutatePendingSyncItems).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Some offline actions could not be deleted',
        subtitle: '1 action(s) failed to delete and are still listed.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveDeleteError);
  });

  it('warns once when deletion succeeds but the current-owner queue cannot be refreshed', async () => {
    const sensitiveRefreshError = 'Queue refresh failed for an identifiable local row';
    mocks.mutatePendingSyncItems.mockRejectedValueOnce(new Error(sensitiveRefreshError));
    const modalProps = await openDeletionConfirmation();

    expect(modalProps.onConfirm()).toBeUndefined();

    await waitFor(() => {
      expect(mocks.deleteSynchronizationItem).toHaveBeenCalledTimes(2);
      expect(mocks.mutatePendingSyncItems).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'warning',
        title: 'Pending actions could not be refreshed',
        subtitle: 'The deletion completed, but this page may be out of date. Reload it before taking another action.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveRefreshError);
  });
});
