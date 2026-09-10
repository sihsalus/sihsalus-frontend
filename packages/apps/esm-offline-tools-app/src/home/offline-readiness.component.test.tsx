import { clearOfflineDownloads, getOfflineReadiness, showModal } from '@openmrs/esm-framework';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import ConfirmationModal, { type ConfirmationModalProps } from '../components/confirmation.modal';
import OfflineReadiness from './offline-readiness.component';

vi.mock('../hooks/use-offline-owner', () => ({ useOfflineOwnerId: () => 'synthetic-owner' }));
vi.mock('@openmrs/esm-framework', () => ({
  clearOfflineDownloads: vi.fn(),
  getOfflineReadiness: vi.fn(),
  showModal: vi.fn(),
}));
const ready = {
  ready: true,
  profile: 'ready' as const,
  storage: 'available' as const,
  persistent: false,
  patients: 2,
  forms: 1,
  incomplete: 0,
};
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <OfflineReadiness />
    </SWRConfig>,
  );
}
beforeEach(() => {
  vi.mocked(getOfflineReadiness).mockResolvedValue(ready);
});
it('reports verified downloads and does not request storage persistence automatically', async () => {
  const persist = vi.fn(async () => true);
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist } });
  mount();
  expect(await screen.findByText('Selected downloads verified')).toBeInTheDocument();
  expect(persist).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Request persistent storage' }));
  await waitFor(() => expect(persist).toHaveBeenCalledOnce());
});
it('shows a safe failure and allows preparation to be checked again', async () => {
  vi.mocked(getOfflineReadiness).mockRejectedValueOnce(new Error('private-identifier'));
  mount();
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-identifier');
  await userEvent.click(screen.getByRole('button', { name: 'Check preparation' }));
  expect(await screen.findByText('Selected downloads verified')).toBeInTheDocument();
});
it('requires explicit confirmation and reports a refused cleanup without claiming completion', async () => {
  mount();
  await screen.findByText('Selected downloads verified');
  await userEvent.click(screen.getByRole('button', { name: /Clear downloaded copies$/ }));
  expect(clearOfflineDownloads).not.toHaveBeenCalled();
  vi.mocked(clearOfflineDownloads).mockRejectedValueOnce(new Error('private pending item'));
  const props = vi.mocked(showModal).mock.calls.at(-1)?.[1] as { onConfirm: () => void };
  await act(async () => props.onConfirm());
  expect(await screen.findByRole('alert')).toHaveTextContent('The operation could not be completed');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private pending item');
});

it('closes the real confirmation dialog before cleanup and supports cancelling it', async () => {
  const dispose = vi.fn();
  vi.mocked(showModal).mockReturnValue(dispose);
  mount();
  await screen.findByText('Selected downloads verified');
  await userEvent.click(screen.getByRole('button', { name: /Clear downloaded copies$/ }));
  const props = vi.mocked(showModal).mock.calls.at(-1)?.[1] as unknown as ConfirmationModalProps;
  const modal = render(<ConfirmationModal {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(dispose).toHaveBeenCalledOnce();
  expect(clearOfflineDownloads).not.toHaveBeenCalled();
  modal.unmount();

  const confirmation = render(<ConfirmationModal {...props} />);
  await userEvent.click(within(confirmation.container).getByRole('button', { name: /Clear downloaded copies$/ }));
  await waitFor(() => expect(clearOfflineDownloads).toHaveBeenCalledOnce());
  expect(dispose).toHaveBeenCalledTimes(2);
});
