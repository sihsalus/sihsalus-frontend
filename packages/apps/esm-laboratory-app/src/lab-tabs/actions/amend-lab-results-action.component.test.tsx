import { type Order, showModal, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resultOrder } from '../../laboratory-results.test-fixtures';
import AmendLabResultsAction from './amend-lab-results-action.component';

beforeEach(() => {
  vi.mocked(userHasAccess).mockReturnValue(true);
});

it('passes completed and pending-review orders to the registered selector and wires dismissal', async () => {
  const dispose = vi.fn();
  vi.mocked(showModal).mockReturnValue(dispose);
  const pending = { ...resultOrder, uuid: 'pending', fulfillerStatus: 'ON_HOLD' } as Order;
  render(
    <AmendLabResultsAction
      order={resultOrder as Order}
      orders={[resultOrder as Order, pending, { ...resultOrder, uuid: 'new', fulfillerStatus: 'IN_PROGRESS' } as Order]}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Amend lab results/ }));
  expect(showModal).toHaveBeenCalledWith('edit-lab-results-modal', {
    orders: [resultOrder, pending],
    closeModal: expect.any(Function),
  });
  (vi.mocked(showModal).mock.lastCall[1] as { closeModal: () => void }).closeModal();
  expect(dispose).toHaveBeenCalledOnce();
});

it('hides amendment without its editing privilege', () => {
  vi.mocked(userHasAccess).mockReturnValue(false);
  render(<AmendLabResultsAction order={resultOrder as Order} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
