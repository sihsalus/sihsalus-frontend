import { launchWorkspace2, userHasAccess } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchLabOrderResult } from '../../laboratory-results.resource';
import { resultObservation, resultOrder } from '../../laboratory-results.test-fixtures';
import { useInvalidateLabOrders } from '../../laboratory.resource';
import EditLabResultsModal from './edit-lab-results-modal.component';

vi.mock('../../laboratory-results.resource', async (original) => ({
  ...(await original()),
  fetchLabOrderResult: vi.fn(),
}));
vi.mock('../../laboratory.resource', () => ({ useInvalidateLabOrders: vi.fn() }));
const fetchResult = vi.mocked(fetchLabOrderResult);
const launch = vi.mocked(launchWorkspace2);
const closeModal = vi.fn();
const invalidate = vi.fn();

beforeEach(() => {
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(useInvalidateLabOrders).mockReturnValue(invalidate);
  fetchResult.mockReset().mockResolvedValue({ order: resultOrder, observation: resultObservation });
  launch.mockReset().mockResolvedValue(true);
});

it('opens the existing v2 form using the verified order and its patient, encounter and visit', async () => {
  render(<EditLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
  expect(fetchResult).toHaveBeenCalledWith(resultOrder, ['COMPLETED', 'ON_HOLD'], expect.any(AbortSignal));
  expect(launch).toHaveBeenCalledWith(
    'lab-app-test-results-form-workspace',
    {
      patient: resultOrder.patient,
      order: resultOrder,
      invalidateLabOrders: invalidate,
      labOrderWorkspaceName: 'lab-app-test-results-add-lab-order-workspace',
    },
    {
      patient: resultOrder.patient,
      patientUuid: resultOrder.patient.uuid,
      encounterUuid: resultOrder.encounter.uuid,
      visitContext: resultOrder.encounter.visit,
    },
  );
});

it('requires an explicit selection when more than one order is eligible', async () => {
  const second = { ...resultOrder, uuid: 'second', orderNumber: 'SYN-LAB-002' };
  fetchResult.mockResolvedValue({ order: second, observation: { ...resultObservation, order: { uuid: second.uuid } } });
  render(<EditLabResultsModal orders={[resultOrder, second]} closeModal={closeModal} />);
  expect(screen.getByRole('button', { name: 'Open result' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByRole('combobox'), 'second');
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  expect(fetchResult).toHaveBeenCalledWith(second, expect.any(Array), expect.any(AbortSignal));
  await waitFor(() =>
    expect(launch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ order: second }),
      expect.any(Object),
    ),
  );
});

it.each(['permission', 'patient', 'state'])('blocks opening for invalid %s', async (reason) => {
  if (reason === 'permission') vi.mocked(userHasAccess).mockReturnValue(false);
  const orders =
    reason === 'patient'
      ? [resultOrder, { ...resultOrder, uuid: 'other', patient: { ...resultOrder.patient, uuid: 'other' } }]
      : reason === 'state'
        ? [{ ...resultOrder, fulfillerStatus: 'IN_PROGRESS' as const }]
        : [resultOrder];
  render(<EditLabResultsModal orders={orders} closeModal={closeModal} />);
  expect(screen.getByRole('button', { name: 'Open result' })).toBeDisabled();
  expect(fetchResult).not.toHaveBeenCalled();
  expect(launch).not.toHaveBeenCalled();
});

it('shows a safe error and retries the read without closing or opening an empty form', async () => {
  fetchResult
    .mockRejectedValueOnce(new Error('secret-patient server stack'))
    .mockResolvedValueOnce({ order: resultOrder, observation: resultObservation });
  render(<EditLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  expect(
    await screen.findByText('Could not open the saved result. Refresh the list or try again.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/secret-patient/)).not.toBeInTheDocument();
  expect(launch).not.toHaveBeenCalled();
  expect(closeModal).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
});

it('keeps the selector open when the workspace declines to replace unsaved work', async () => {
  launch.mockResolvedValue(false);
  render(<EditLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  await waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(closeModal).not.toHaveBeenCalled();
});

it('aborts the read on close and does not launch after the selector unmounts', async () => {
  let resolve: (value: Awaited<ReturnType<typeof fetchLabOrderResult>>) => void;
  fetchResult.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { unmount } = render(<EditLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open result' }));
  unmount();
  expect(fetchResult.mock.calls[0][2].aborted).toBe(true);
  resolve({ order: resultOrder, observation: resultObservation });
  await Promise.resolve();
  expect(launch).not.toHaveBeenCalled();
});
