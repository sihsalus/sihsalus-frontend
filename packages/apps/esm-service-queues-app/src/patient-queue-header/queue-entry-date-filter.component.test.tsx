import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { serializeQueueEntryDate } from '../store/queue-entry-date';
import { updateSelectedQueueEntryDate, updateSelectedQueueLocationUuid, useServiceQueuesStore } from '../store/store';
import QueueEntryDateFilter from './queue-entry-date-filter.component';

function FilterWithState() {
  const { selectedQueueEntryDate } = useServiceQueuesStore();
  return (
    <>
      <QueueEntryDateFilter />
      <output>{selectedQueueEntryDate ?? 'all dates'}</output>
    </>
  );
}

beforeEach(() => act(() => updateSelectedQueueEntryDate(null)));

it('selects a date, retains it after remount and UPSS changes, and clears the session filter', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<FilterWithState />);
  expect(screen.getByRole('button', { name: 'Clear date' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Queue entry date'), { target: { value: '2026-10-09' } });
  expect(screen.getByRole('status')).toHaveTextContent('2026-10-09');
  expect(sessionStorage.getItem('queueEntryDate')).toBe('2026-10-09');

  act(() => updateSelectedQueueLocationUuid('synthetic-upss'));
  unmount();
  render(<FilterWithState />);
  expect(screen.getByLabelText('Queue entry date')).toHaveValue('09/10/2026');
  await user.click(screen.getByRole('button', { name: 'Clear date' }));
  expect(screen.getByRole('status')).toHaveTextContent('all dates');
  expect(screen.getByLabelText('Queue entry date')).toHaveValue('');
  expect(sessionStorage.getItem('queueEntryDate')).toBeNull();
});

it('uses the local calendar day for Today without changing other queue filters', async () => {
  const user = userEvent.setup();
  render(<FilterWithState />);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  expect(screen.getByRole('status')).toHaveTextContent(serializeQueueEntryDate(new Date()));
  expect(sessionStorage.getItem('queueEntryDate')).toBe(serializeQueueEntryDate(new Date()));
});
