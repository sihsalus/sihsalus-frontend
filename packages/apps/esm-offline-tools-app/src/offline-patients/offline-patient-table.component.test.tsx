import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OfflinePatientTable from './offline-patient-table.component';

const mocks = vi.hoisted(() => ({
  deleteSynchronizationItem: vi.fn(),
  getDynamicOfflineDataEntries: vi.fn(),
  getFullSynchronizationItems: vi.fn(),
  getUserFacingErrorMessage: vi.fn(),
  mutateOfflinePatients: vi.fn(),
  mutateOfflineRegisteredPatients: vi.fn(),
  removeDynamicOfflineData: vi.fn(),
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
  syncSelectedOfflinePatients: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', () => ({
  age: vi.fn(),
  deleteSynchronizationItem: mocks.deleteSynchronizationItem,
  getDynamicOfflineDataEntries: mocks.getDynamicOfflineDataEntries,
  getFullSynchronizationItems: mocks.getFullSynchronizationItems,
  getUserFacingErrorMessage: mocks.getUserFacingErrorMessage,
  isDesktop: () => true,
  removeDynamicOfflineData: mocks.removeDynamicOfflineData,
  showModal: mocks.showModal,
  showSnackbar: mocks.showSnackbar,
  useLayoutType: () => 'desktop',
}));

vi.mock('./offline-patient-sync', () => ({
  syncSelectedOfflinePatients: mocks.syncSelectedOfflinePatients,
}));

vi.mock('../hooks/offline-patient-data-hooks', () => ({
  useOfflinePatientsWithEntries: () => ({
    data: [
      {
        patient: {
          id: 'synthetic-patient-uuid',
          name: [{ family: 'Patient', given: ['Synthetic'] }],
          gender: 'female',
        },
        entry: {},
      },
      {
        patient: {
          id: 'second-synthetic-patient-uuid',
          name: [{ family: 'Patient', given: ['Second'] }],
          gender: 'male',
        },
        entry: {},
      },
    ],
    isValidating: false,
    mutate: mocks.mutateOfflinePatients,
  }),
  useOfflineRegisteredPatients: () => ({
    data: [],
    isValidating: false,
    mutate: mocks.mutateOfflineRegisteredPatients,
  }),
}));

vi.mock('./last-updated-table-cell.component', () => ({
  default: () => <span>Downloaded</span>,
}));

vi.mock('./patient-name-table-cell.component', () => ({
  default: () => <span>Synthetic Patient</span>,
}));

function createDeferredRemoval() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createDeferredRefresh() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function openRemovalConfirmation() {
  const user = userEvent.setup();
  render(<OfflinePatientTable isInteractive showHeader={false} />);

  await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
  await user.click(screen.getByRole('button', { name: /Remove from list/ }));

  return mocks.showModal.mock.calls[0]?.[1] as { onConfirm: () => void };
}

async function updateSelectedPatients() {
  const user = userEvent.setup();
  render(<OfflinePatientTable isInteractive showHeader={false} />);

  await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
  await user.click(screen.getByRole('button', { name: 'Update patients' }));
}

describe('OfflinePatientTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteSynchronizationItem.mockResolvedValue(undefined);
    mocks.getDynamicOfflineDataEntries.mockResolvedValue([]);
    mocks.getFullSynchronizationItems.mockResolvedValue([]);
    mocks.getUserFacingErrorMessage.mockImplementation((_error, fallback) => fallback);
    mocks.showModal.mockReturnValue(vi.fn());
    mocks.mutateOfflinePatients.mockResolvedValue(undefined);
    mocks.mutateOfflineRegisteredPatients.mockResolvedValue(undefined);
    mocks.removeDynamicOfflineData.mockResolvedValue(undefined);
    mocks.syncSelectedOfflinePatients.mockResolvedValue({
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it('settles both update refreshes and shows one fixed warning when synchronization succeeds', async () => {
    const deferredRefresh = createDeferredRefresh();
    const sensitiveRefreshError =
      'Queue refresh failed for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    mocks.mutateOfflinePatients.mockRejectedValueOnce(new Error(sensitiveRefreshError));
    mocks.mutateOfflineRegisteredPatients.mockImplementationOnce(() => deferredRefresh.promise);
    await updateSelectedPatients();

    await waitFor(() => expect(mocks.syncSelectedOfflinePatients).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
    });
    expect(mocks.showSnackbar).not.toHaveBeenCalled();

    deferredRefresh.resolve();

    await waitFor(() => {
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'warning',
        title: 'Offline patient list could not be refreshed',
        subtitle: 'The update attempt ended, but this page may be out of date. Reload it before taking another action.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveRefreshError);
  });

  it('keeps a reported synchronization failure ahead of a subsequent refresh failure', async () => {
    const sensitiveRefreshError = 'Registration queue refresh exposed a local row';
    mocks.syncSelectedOfflinePatients.mockResolvedValueOnce({ failedCount: 1, skippedCount: 0 });
    mocks.mutateOfflineRegisteredPatients.mockRejectedValueOnce(new Error(sensitiveRefreshError));

    await updateSelectedPatients();

    await waitFor(() => {
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Some patients could not be synchronized',
        subtitle:
          '1 patient(s) could not be updated for offline use. Previously downloaded data may be out of date. Please try again.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveRefreshError);
  });

  it('keeps a skipped-patient warning ahead of a subsequent refresh failure', async () => {
    const sensitiveRefreshError = 'Registration queue refresh exposed a local row';
    mocks.syncSelectedOfflinePatients.mockResolvedValueOnce({ failedCount: 0, skippedCount: 1 });
    mocks.mutateOfflineRegisteredPatients.mockRejectedValueOnce(new Error(sensitiveRefreshError));

    await updateSelectedPatients();

    await waitFor(() => {
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'warning',
        title: 'Pending registrations cannot be updated',
        subtitle:
          '1 selected patient(s) still have pending offline registrations. Synchronize pending actions before updating them.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveRefreshError);
  });

  it('gives a synchronization rejection precedence over refresh failure without exposing either error', async () => {
    const sensitiveSyncError = 'GET https://clinical.example.test/private-patient-uuid failed';
    const sensitiveRefreshError = 'IndexedDB refresh failed for private-patient-uuid';
    mocks.syncSelectedOfflinePatients.mockRejectedValueOnce(new Error(sensitiveSyncError));
    mocks.mutateOfflinePatients.mockRejectedValueOnce(new Error(sensitiveRefreshError));
    mocks.mutateOfflineRegisteredPatients.mockRejectedValueOnce(new Error(sensitiveRefreshError));

    await updateSelectedPatients();

    await waitFor(() => {
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Some patients could not be synchronized',
        subtitle: 'The selected patients could not be updated for offline use. Please try again.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toMatch(/private-patient-uuid|clinical\.example\.test/);
  });

  it('consumes a removal rejection, shows fixed feedback, and refreshes both patient lists', async () => {
    const sensitiveError =
      'IndexedDB failure for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    mocks.getDynamicOfflineDataEntries.mockResolvedValueOnce([]);
    mocks.getFullSynchronizationItems.mockRejectedValueOnce(new Error(sensitiveError));
    mocks.mutateOfflinePatients.mockRejectedValueOnce(new Error('Offline patient refresh failed'));
    mocks.mutateOfflineRegisteredPatients.mockRejectedValueOnce(new Error('Registration queue refresh failed'));
    const modalProps = await openRemovalConfirmation();
    expect(modalProps.onConfirm()).toBeUndefined();

    await waitFor(() => {
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Offline patient removal was incomplete',
        subtitle: 'The local list may have changed. Review it, verify your session, and try again.',
      });
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveError);
  });

  it('waits for every removal operation to settle before refreshing either patient list', async () => {
    const deferredRemoval = createDeferredRemoval();
    mocks.getDynamicOfflineDataEntries.mockResolvedValueOnce([
      { identifier: 'synthetic-patient-uuid' },
      { identifier: 'second-synthetic-patient-uuid' },
    ]);
    mocks.removeDynamicOfflineData
      .mockRejectedValueOnce(new Error('First removal failed'))
      .mockImplementationOnce(() => deferredRemoval.promise);
    const modalProps = await openRemovalConfirmation();

    expect(modalProps.onConfirm()).toBeUndefined();
    await waitFor(() => expect(mocks.removeDynamicOfflineData).toHaveBeenCalledTimes(2));
    expect(mocks.mutateOfflinePatients).not.toHaveBeenCalled();
    expect(mocks.mutateOfflineRegisteredPatients).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();

    deferredRemoval.resolve();

    await waitFor(() => {
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Offline patient removal was incomplete',
        subtitle: 'The local list may have changed. Review it, verify your session, and try again.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('warns when removal succeeds but either patient list cannot be refreshed', async () => {
    mocks.getDynamicOfflineDataEntries.mockResolvedValueOnce([
      { identifier: 'synthetic-patient-uuid' },
      { identifier: 'second-synthetic-patient-uuid' },
    ]);
    mocks.mutateOfflinePatients.mockRejectedValueOnce(new Error('Offline patient refresh failed'));
    const modalProps = await openRemovalConfirmation();

    expect(modalProps.onConfirm()).toBeUndefined();

    await waitFor(() => {
      expect(mocks.removeDynamicOfflineData).toHaveBeenCalledTimes(2);
      expect(mocks.mutateOfflinePatients).toHaveBeenCalledTimes(1);
      expect(mocks.mutateOfflineRegisteredPatients).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith({
        kind: 'warning',
        title: 'Offline patient list could not be refreshed',
        subtitle:
          'The removal request completed, but this page may be out of date. Reload it before taking another action.',
      });
    });
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
  });
});
