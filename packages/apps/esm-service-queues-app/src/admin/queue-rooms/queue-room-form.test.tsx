import { openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import QueueRoomForm from './queue-room-form.workspace';

const mutate = vi.hoisted(() => vi.fn());
vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  useSWRConfig: () => ({ mutate }),
}));
vi.mock('../../create-queue-entry/hooks/useQueueLocations', () => ({
  useQueueLocations: () => ({ queueLocations: [{ id: 'synthetic-upss', name: 'Synthetic UPSS' }] }),
}));
vi.mock('../../hooks/useQueues', () => ({
  useQueues: () => ({ queues: [{ uuid: 'synthetic-queue', display: 'Synthetic queue' }] }),
}));

const closeWorkspace = vi.fn();
const queueRoom = {
  uuid: 'synthetic-room',
  name: 'Synthetic room',
  description: 'Primer piso, ambiente accesible',
  queue: { uuid: 'synthetic-queue', display: 'Synthetic queue' },
};

function renderForm(edit = false) {
  const props: ComponentProps<typeof QueueRoomForm> = {
    workspaceProps: edit ? { queueRoom } : {},
    closeWorkspace,
    launchChildWorkspace: vi.fn().mockResolvedValue(true),
    windowProps: {},
    groupProps: {},
    workspaceName: 'service-queues-room-workspace',
    windowName: 'add-queue-room',
    isRootWorkspace: true,
    showActionMenu: false,
  };
  return render(<QueueRoomForm {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(openmrsFetch).mockResolvedValue(Object.assign(new Response(null, { status: 201 }), { data: queueRoom }));
});

test('creates a room with its description through the existing Queue REST resource and refreshes room lists', async () => {
  const user = userEvent.setup();
  renderForm();
  await user.type(screen.getByLabelText('Queue room name'), queueRoom.name);
  await user.selectOptions(screen.getByLabelText('Queue UPSS'), 'synthetic-upss');
  await user.selectOptions(screen.getByLabelText('Queue'), queueRoom.queue.uuid);
  await user.type(screen.getByLabelText('Description'), queueRoom.description);
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
  expect(openmrsFetch).toHaveBeenCalledExactlyOnceWith(
    `${restBaseUrl}/queue-room`,
    expect.objectContaining({
      method: 'POST',
      body: { name: queueRoom.name, description: queueRoom.description, queue: { uuid: queueRoom.queue.uuid } },
    }),
  );
  const matchesRoomList = mutate.mock.calls[0][0];
  expect(matchesRoomList(`${restBaseUrl}/queue-room?v=full`)).toBe(true);
  expect(matchesRoomList(`${restBaseUrl}/queue-room?queue=synthetic-queue`)).toBe(true);
  expect(matchesRoomList(`${restBaseUrl}/queue?v=full`)).toBe(false);
  expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
});

test('loads the existing description and edits the same room without creating another record', async () => {
  const user = userEvent.setup();
  renderForm(true);
  expect(screen.getByLabelText('Description')).toHaveValue(queueRoom.description);
  expect(screen.getByLabelText('Queue')).toHaveValue(queueRoom.queue.uuid);
  await user.clear(screen.getByLabelText('Description'));
  await user.type(screen.getByLabelText('Description'), 'Segundo piso');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
  expect(openmrsFetch).toHaveBeenCalledExactlyOnceWith(
    `${restBaseUrl}/queue-room/${queueRoom.uuid}`,
    expect.objectContaining({
      method: 'POST',
      body: { name: queueRoom.name, description: 'Segundo piso', queue: { uuid: queueRoom.queue.uuid } },
    }),
  );
});

test('can explicitly clear an existing description', async () => {
  const user = userEvent.setup();
  renderForm(true);
  await user.clear(screen.getByLabelText('Description'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
  expect(openmrsFetch).toHaveBeenCalledWith(
    `${restBaseUrl}/queue-room/${queueRoom.uuid}`,
    expect.objectContaining({ body: expect.objectContaining({ description: '' }) }),
  );
});

test('keeps required name, UPSS and queue validation before creating a room', async () => {
  const user = userEvent.setup();
  renderForm();
  await user.type(screen.getByLabelText('Description'), 'Synthetic description');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Queue room name is required')).toBeInTheDocument();
  expect(screen.getByText('Queue UPSS is required')).toBeInTheDocument();
  expect(screen.getByText('Queue is required')).toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(closeWorkspace).not.toHaveBeenCalled();
});

test('a rejected save keeps entered values for recovery and does not claim success', async () => {
  const user = userEvent.setup();
  vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('SYNTHETIC-PRIVATE-DETAIL'));
  renderForm(true);
  await user.type(screen.getByLabelText('Description'), ' — corregida');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(screen.getByLabelText('Description')).toHaveValue(`${queueRoom.description} — corregida`);
  expect(closeWorkspace).not.toHaveBeenCalled();
  expect(mutate).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('SYNTHETIC-PRIVATE-DETAIL');
});

test('cancel closes without writing a room', async () => {
  const user = userEvent.setup();
  renderForm(true);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(closeWorkspace).toHaveBeenCalledOnce();
  expect(openmrsFetch).not.toHaveBeenCalled();
});
