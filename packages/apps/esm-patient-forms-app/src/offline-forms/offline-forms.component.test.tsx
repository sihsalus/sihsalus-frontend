import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Form } from '../types';

import { useDynamicFormDataEntries } from './offline-form-helpers';
import { updateOfflineFormAvailability } from './offline-form-membership';
import { OfflineFormToggle } from './offline-forms.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('./offline-form-helpers', () => ({
  useDynamicFormDataEntries: vi.fn(),
}));

vi.mock('./offline-form-membership', () => ({
  updateOfflineFormAvailability: vi.fn(),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUpdateOfflineFormAvailability = vi.mocked(updateOfflineFormAvailability);
const mockUseDynamicFormDataEntries = vi.mocked(useDynamicFormDataEntries);
const mockUseSession = vi.mocked(useSession);

const form: Form = {
  uuid: 'form-uuid',
  name: 'Synthetic clinical form',
  version: '1',
  published: true,
  retired: false,
  resources: [],
};

describe('OfflineFormToggle', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockReset();
    mutate.mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
      user: { uuid: 'user-uuid' },
    } as ReturnType<typeof useSession>);
    mockUpdateOfflineFormAvailability.mockResolvedValue(undefined);
    mockUseDynamicFormDataEntries.mockReturnValue({
      data: [],
      isValidating: false,
      mutate,
    } as unknown as ReturnType<typeof useDynamicFormDataEntries>);
  });

  it('consumes a failed availability update and allows retry', async () => {
    const user = userEvent.setup();
    mockUpdateOfflineFormAvailability
      .mockRejectedValueOnce(new Error('Failed to cache private form UUID form-uuid'))
      .mockResolvedValueOnce(undefined);
    mutate.mockRejectedValueOnce(new Error('IndexedDB refresh failed for private form UUID form-uuid'));

    render(<OfflineFormToggle form={form} disabled={false} />);

    const toggle = screen.getByRole('switch', { name: 'Offline toggle' });
    await user.click(toggle);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Offline form update failed',
        subtitle: "The form's offline availability could not be changed. Please try again.",
      });
      expect(toggle).toBeEnabled();
    });
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('form-uuid');

    await user.click(toggle);

    await waitFor(() => {
      expect(mockUpdateOfflineFormAvailability).toHaveBeenCalledTimes(2);
      expect(mockUpdateOfflineFormAvailability).toHaveBeenCalledWith('user-uuid', 'form-uuid', true);
      expect(mutate).toHaveBeenCalledTimes(2);
    });
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
  });

  it('warns once when an update succeeds but its local status cannot be refreshed', async () => {
    const user = userEvent.setup();
    const sensitiveError = 'IndexedDB refresh failed for private form UUID form-uuid';
    mutate.mockRejectedValueOnce(new Error(sensitiveError));

    render(<OfflineFormToggle form={form} disabled={false} />);

    const toggle = screen.getByRole('switch', { name: 'Offline toggle' });
    await user.click(toggle);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        kind: 'warning',
        title: 'Offline form status could not be refreshed',
        subtitle: 'The update completed, but this page may be out of date. Reload it before taking another action.',
      });
      expect(toggle).toBeEnabled();
    });
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain(sensitiveError);
  });
});
