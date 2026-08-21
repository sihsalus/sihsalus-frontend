import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineActionsPage from './offline-actions-page.component';

const mocks = vi.hoisted(() => ({
  mutatePendingSyncItems: vi.fn(),
  runSynchronization: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  getOfflineSynchronizationStore: () => ({}),
  isDesktop: () => true,
  runSynchronization: mocks.runSynchronization,
  showSnackbar: mocks.showSnackbar,
  useConnectivity: () => true,
  useLayoutType: () => 'desktop',
  useStore: () => ({ synchronization: undefined }),
}));

vi.mock('../hooks/offline-actions', () => ({
  usePendingSyncItems: () => ({ mutate: mocks.mutatePendingSyncItems }),
}));

vi.mock('./offline-actions.component', () => ({
  default: () => <div>Pending offline actions</div>,
}));

describe('OfflineActionsPage', () => {
  beforeEach(() => {
    mocks.runSynchronization.mockResolvedValue(undefined);
    mocks.mutatePendingSyncItems.mockResolvedValue(undefined);
  });

  it('refreshes the current-user queue after successful synchronization', async () => {
    const user = userEvent.setup();
    render(<OfflineActionsPage />);

    await user.click(screen.getByRole('button', { name: 'Update offline patients' }));

    await waitFor(() => expect(mocks.mutatePendingSyncItems).toHaveBeenCalledTimes(1));
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('handles an incomplete synchronization without exposing its technical error or leaving a rejected promise', async () => {
    const user = userEvent.setup();
    const sensitiveError =
      'POST https://clinical.example.test/openmrs/ws/rest/v1/patient/00000000-0000-0000-0000-000000000001 failed';
    mocks.runSynchronization.mockRejectedValueOnce(new Error(sensitiveError));
    render(<OfflineActionsPage />);

    await user.click(screen.getByRole('button', { name: 'Update offline patients' }));

    await waitFor(() => expect(mocks.mutatePendingSyncItems).toHaveBeenCalledTimes(1));
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Offline actions were not fully synchronized',
      subtitle: 'Pending actions were kept. Verify the session and connection, then try again.',
    });
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveError);
  });

  it('handles a queue refresh rejection after synchronization', async () => {
    const user = userEvent.setup();
    const sensitiveError = 'IndexedDB failure while reading a patient queue';
    mocks.mutatePendingSyncItems.mockRejectedValueOnce(new Error(sensitiveError));
    render(<OfflineActionsPage />);

    await user.click(screen.getByRole('button', { name: 'Update offline patients' }));

    await waitFor(() =>
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Pending actions could not be refreshed',
        subtitle: 'The local queue may have changed. Reload this page before taking another action.',
      }),
    );
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveError);
  });
});
