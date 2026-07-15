import { type FetchResponse, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { EmergencyQueueEntry } from '../resources/emergency.resource';
import EmergencyQueueConfirmActionModal from './emergency-queue-confirm-action.modal';

const mockMutate = vi.fn();

vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const queueEntry = { uuid: 'queue-entry-uuid' } as EmergencyQueueEntry;

function renderModal(submitAction: () => Promise<FetchResponse<unknown>>) {
  return render(
    <EmergencyQueueConfirmActionModal
      queueEntry={queueEntry}
      closeModal={vi.fn()}
      modalParams={{
        modalTitle: 'Confirmar acción',
        modalInstruction: 'Confirme la acción sobre la cola.',
        submitButtonText: 'Confirmar',
        submitSuccessTitle: 'Acción completada',
        submitSuccessText: 'La cola fue actualizada.',
        submitFailureTitle: 'No se pudo actualizar la cola',
        submitAction,
      }}
    />,
  );
}

describe('EmergencyQueueConfirmActionModal errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['a rejected request', () => Promise.reject(new Error('SQLSTATE 40001 at /ws/rest/v1/queue-entry'))],
    ['an unsuccessful response', () => Promise.resolve({ status: 500 } as FetchResponse<unknown>)],
  ])('shows safe copy for %s', async (_case, submitAction) => {
    const user = userEvent.setup();
    renderModal(submitAction);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle:
            'No se pudo confirmar la acción sobre la cola. Actualice y verifique su estado antes de intentarlo nuevamente.',
        }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });
});
