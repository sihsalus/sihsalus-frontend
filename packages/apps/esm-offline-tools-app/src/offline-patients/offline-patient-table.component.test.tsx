import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OfflinePatientTable from './offline-patient-table.component';

const mocks = vi.hoisted(() => ({
  deleteSynchronizationItem: vi.fn(),
  getDynamicOfflineDataEntries: vi.fn(),
  getFullSynchronizationItems: vi.fn(),
  mutateOfflinePatients: vi.fn(),
  mutateOfflineRegisteredPatients: vi.fn(),
  removeDynamicOfflineData: vi.fn(),
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', () => ({
  age: vi.fn(),
  deleteSynchronizationItem: mocks.deleteSynchronizationItem,
  getDynamicOfflineDataEntries: mocks.getDynamicOfflineDataEntries,
  getFullSynchronizationItems: mocks.getFullSynchronizationItems,
  getUserFacingErrorMessage: vi.fn(),
  isDesktop: () => true,
  removeDynamicOfflineData: mocks.removeDynamicOfflineData,
  showModal: mocks.showModal,
  showSnackbar: mocks.showSnackbar,
  syncDynamicOfflineData: vi.fn(),
  useLayoutType: () => 'desktop',
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

describe('OfflinePatientTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showModal.mockReturnValue(vi.fn());
    mocks.mutateOfflinePatients.mockResolvedValue(undefined);
    mocks.mutateOfflineRegisteredPatients.mockResolvedValue(undefined);
  });

  it('consumes a removal rejection, shows fixed feedback, and refreshes both patient lists', async () => {
    const user = userEvent.setup();
    const sensitiveError =
      'IndexedDB failure for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    mocks.getDynamicOfflineDataEntries.mockResolvedValueOnce([]);
    mocks.getFullSynchronizationItems.mockRejectedValueOnce(new Error(sensitiveError));
    mocks.mutateOfflinePatients.mockRejectedValueOnce(new Error('Offline patient refresh failed'));
    mocks.mutateOfflineRegisteredPatients.mockRejectedValueOnce(new Error('Registration queue refresh failed'));
    render(<OfflinePatientTable isInteractive showHeader={false} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select row' }));
    await user.click(screen.getByRole('button', { name: /Remove from list/ }));

    const modalProps = mocks.showModal.mock.calls[0]?.[1] as {
      onConfirm: () => void;
    };
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
    expect(JSON.stringify(mocks.showSnackbar.mock.calls)).not.toContain(sensitiveError);
  });
});
