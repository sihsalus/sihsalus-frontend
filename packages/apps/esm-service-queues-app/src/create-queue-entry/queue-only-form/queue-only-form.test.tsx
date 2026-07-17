import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';

import type { QueueFieldsProps } from '../queue-fields/queue-fields.component';
import QueueOnlyForm from './queue-only-form.component';

const mocks = vi.hoisted(() => ({
  mutateQueueEntries: vi.fn(),
  onBeforeVisitSave: vi.fn(() => true),
  onQueueEntryAdded: vi.fn(),
  onVisitCreatedOrUpdated: vi.fn().mockResolvedValue(undefined),
  queueFields: vi.fn(),
}));

vi.mock('../../hooks/useQueueEntries', () => ({
  useMutateQueueEntries: () => ({ mutateQueueEntries: mocks.mutateQueueEntries }),
}));

vi.mock('../queue-fields/queue-fields.component', () => ({
  default: (props: QueueFieldsProps) => {
    mocks.queueFields(props);
    useEffect(() => {
      props.setCallbacks({
        onBeforeVisitSave: mocks.onBeforeVisitSave,
        onVisitCreatedOrUpdated: mocks.onVisitCreatedOrUpdated,
      });
    }, [props.setCallbacks]);
    return <div>Queue fields</div>;
  },
}));

describe('QueueOnlyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onBeforeVisitSave.mockReturnValue(true);
    mocks.onVisitCreatedOrUpdated.mockResolvedValue(undefined);
  });

  it('creates the administrative queue entry without passing a visit', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn();
    const onBeforeQueueEntrySave = vi.fn(() => true);

    render(
      <QueueOnlyForm
        closeWorkspace={closeWorkspace}
        currentQueueLocationUuid="queue-location-uuid"
        currentServiceQueueUuid="queue-uuid"
        onBeforeQueueEntrySave={onBeforeQueueEntrySave}
        onQueueEntryAdded={mocks.onQueueEntryAdded}
        patientUuid="patient-uuid"
      />,
    );

    await user.click(screen.getByRole('button', { name: /add patient to queue/i }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
    expect(mocks.onVisitCreatedOrUpdated).toHaveBeenCalledWith();
    expect(onBeforeQueueEntrySave).toHaveBeenCalledOnce();
    expect(mocks.onQueueEntryAdded).toHaveBeenCalledOnce();
    expect(mocks.mutateQueueEntries).toHaveBeenCalledOnce();
    expect(mocks.queueFields).toHaveBeenCalledWith(
      expect.objectContaining({
        currentQueueLocationUuid: 'queue-location-uuid',
        currentServiceQueueUuid: 'queue-uuid',
        patientUuid: 'patient-uuid',
        visitRequired: false,
      }),
    );
  });
});
