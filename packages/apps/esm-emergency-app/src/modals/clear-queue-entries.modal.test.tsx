import { showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type EmergencyQueueEntry, endEmergencyQueueEntry } from '../resources/emergency.resource';
import ClearQueueEntriesModal from './clear-queue-entries.modal';

const mockMutate = vi.fn();

vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  endEmergencyQueueEntry: vi.fn(),
}));

const mockEndEmergencyQueueEntry = vi.mocked(endEmergencyQueueEntry);
const mockShowSnackbar = vi.mocked(showSnackbar);
const queueEntries = [{ uuid: 'first-entry' }, { uuid: 'second-entry' }] as Array<EmergencyQueueEntry>;

describe('ClearQueueEntriesModal partial failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles the cache and warns safely when only part of the queue was cleared', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    mockEndEmergencyQueueEntry
      .mockResolvedValueOnce({ data: { uuid: 'first-entry', endedAt: '2026-07-15T12:00:00Z' } } as never)
      .mockRejectedValueOnce(new Error('SQLSTATE 40001 at /ws/rest/v1/queue-entry/second-entry'));

    render(<ClearQueueEntriesModal queueEntries={queueEntries} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /Limpiar cola/u }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
    expect(mockEndEmergencyQueueEntry).toHaveBeenCalledTimes(2);
    expect(mockMutate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'No se pudo limpiar completamente la cola. Algunos registros podrían haberse retirado; actualice y revise la cola antes de repetir la acción.',
      }),
    );
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });
});
