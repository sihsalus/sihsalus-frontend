import { showModal, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice, mockSession } from 'test-utils';

import { mapVisitQueueEntryProperties, serveQueueEntry } from '../active-visits/active-visits-table.resource';
import TransitionMenu from './transition-entry.component';

const mockServeQueueEntry = vi.mocked(serveQueueEntry);
const mockShowModal = vi.mocked(showModal);
const mockUseSession = vi.mocked(useSession);

vi.mock('../active-visits/active-visits-table.resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../active-visits/active-visits-table.resource')>();
  return { ...actual, serveQueueEntry: vi.fn() };
});

describe('TransitionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          { display: 'app:home.colasAtencion.editar', name: 'app:home.colasAtencion.editar' },
        ],
      },
    } as ReturnType<typeof useSession>);
  });

  it('disables calling and does not open the modal when the entry has no visit ticket', async () => {
    const user = userEvent.setup();
    const visitlessEntry = mapVisitQueueEntryProperties(
      { ...mockQueueEntryAlice, visit: null },
      'queue-number-visit-attr-type-uuid',
    );

    render(<TransitionMenu queueEntry={visitlessEntry} />);

    const callButton = screen.getByRole('button');
    expect(callButton).toBeDisabled();
    await user.click(callButton);
    expect(mockServeQueueEntry).not.toHaveBeenCalled();
    expect(mockShowModal).not.toHaveBeenCalled();
  });
});
