import { userHasAccess } from '@openmrs/esm-framework';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReactToPrint } from 'react-to-print';
import { renderWithSwr } from 'test-utils';
import { fetchLabOrderResults } from '../../laboratory-results.resource';
import { resultObservation, resultOrder } from '../../laboratory-results.test-fixtures';
import PrintLabResultsModal from './print-lab-results-modal.component';

vi.mock('../../laboratory-results.resource', async (original) => ({
  ...(await original()),
  fetchLabOrderResults: vi.fn(),
}));
vi.mock('react-to-print', () => ({ useReactToPrint: vi.fn() }));
const fetchResults = vi.mocked(fetchLabOrderResults);
const print = vi.fn();
const closeModal = vi.fn();

beforeEach(() => {
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(useReactToPrint).mockReturnValue(print);
  fetchResults.mockReset().mockResolvedValue([{ order: resultOrder, observation: resultObservation }]);
});

it('prints the selected patient and persisted zero, range and comment from its dedicated preview', async () => {
  renderWithSwr(<PrintLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
  expect(screen.getByText(resultOrder.patient.display)).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(within(table).getByRole('cell', { name: '0' })).toBeInTheDocument();
  expect(within(table).getByRole('cell', { name: '0 – 20' })).toBeInTheDocument();
  expect(within(table).getByRole('cell', { name: resultObservation.comment })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  expect(print).toHaveBeenCalledOnce();
  expect(vi.mocked(useReactToPrint).mock.lastCall[0].contentRef.current).toContainElement(table);
  expect(fetchResults).toHaveBeenCalledWith([resultOrder]);
});

it('prints nested coded/text results and excludes voided members without inventing a reference range', async () => {
  fetchResults.mockResolvedValue([
    {
      order: resultOrder,
      observation: {
        ...resultObservation,
        value: null,
        groupMembers: [
          {
            ...resultObservation,
            uuid: 'coded',
            value: { uuid: 'negative', display: 'Negativo' },
            referenceRange: null,
          },
          {
            ...resultObservation,
            uuid: 'group',
            value: null,
            groupMembers: [{ ...resultObservation, uuid: 'text', value: 'Resultado de texto' }],
          },
          { ...resultObservation, uuid: 'voided', value: 'Resultado anulado', voided: true },
        ],
      },
    },
  ]);
  renderWithSwr(<PrintLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  const cell = await screen.findByRole('cell', { name: 'Negativo' });
  expect(within(cell.closest('tr')).getByRole('cell', { name: '—' })).toBeInTheDocument();
  expect(screen.getByText('Resultado de texto')).toBeInTheDocument();
  expect(screen.queryByText('Resultado anulado')).not.toBeInTheDocument();
});

it('disables printing while loading and on failure, hides raw errors, then permits an explicit retry', async () => {
  let reject: (error: Error) => void;
  fetchResults.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  renderWithSwr(<PrintLabResultsModal orders={[resultOrder]} closeModal={closeModal} />);
  expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  await waitFor(() => expect(fetchResults).toHaveBeenCalledOnce());
  reject(new Error('secret patient HTTP 403'));
  expect(
    await screen.findByText('Could not load all selected results. No report is available to print.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/secret patient/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
});

it.each(['permission', 'mixed patients', 'empty', 'pending'])('does not read or print with %s', (condition) => {
  if (condition === 'permission') vi.mocked(userHasAccess).mockReturnValue(false);
  const orders =
    condition === 'empty'
      ? []
      : condition === 'mixed patients'
        ? [resultOrder, { ...resultOrder, uuid: 'other', patient: { ...resultOrder.patient, uuid: 'other' } }]
        : condition === 'pending'
          ? [{ ...resultOrder, fulfillerStatus: 'ON_HOLD' as const }]
          : [resultOrder];
  renderWithSwr(<PrintLabResultsModal orders={orders} closeModal={closeModal} />);
  expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  expect(fetchResults).not.toHaveBeenCalled();
  expect(print).not.toHaveBeenCalled();
});
