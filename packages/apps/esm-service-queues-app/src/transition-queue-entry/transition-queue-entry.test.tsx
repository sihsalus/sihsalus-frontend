import { getDefaultsFromConfigSchema, navigate, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type MappedVisitQueueEntry,
  serveQueueEntry,
  updateQueueEntry,
} from '../active-visits/active-visits-table.resource';
import { type ConfigObject, configSchema } from '../config-schema';

import TransitionQueueEntryModal from './transition-queue-entry.modal';
import { requeueQueueEntry } from './transition-queue-entry.resource';

const mockNavigate = vi.mocked(navigate);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

vi.mock('../active-visits/active-visits-table.resource', () => ({
  serveQueueEntry: vi.fn().mockResolvedValue({ status: 200 }),
  updateQueueEntry: vi.fn().mockResolvedValue({ status: 201 }),
}));

vi.mock('../hooks/useQueueEntries', () => ({
  useMutateQueueEntries: () => ({ mutateQueueEntries: vi.fn() }),
}));

vi.mock('./transition-queue-entry.resource', () => ({
  requeueQueueEntry: vi.fn().mockResolvedValue({ status: 200 }),
}));

describe('TransitionQueueEntryModal', () => {
  const queueEntry = {
    visitUuid: 'c90386ff-ae85-45cc-8a01-25852099c5ae',
    identifiers: [
      {
        identifier: '100GEJ',
        display: 'OpenMRS ID',
        uuid: 'ac1f1f1e-6b0e-4d4e-8f0b-0b0e4e6b1fac',
      },
    ],
    queueUuid: 'fa1e98f1-f002-4174-9e55-34d60951e710',
    queueEntryUuid: '712289ab-32c0-430f-87b6-d9c1e4e4686e',
    patientUuid: 'cc75ad73-c24b-499c-8db9-a7ef4fc0b36d',
    priorityUuid: 'f9684018-a4d3-4d6f-9dd5-b4b1e89af3e7',
    queue: {
      name: 'Triage Queue',
    },
    name: 'John Doe',
  } as unknown as MappedVisitQueueEntry;

  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      concepts: {
        defaultTransitionStatus: 'some-default-transition-status',
      },
      defaultIdentifierTypes: ['05ee9cf4-7242-4a17-b4d4-00f707265c8a', 'f85081e2-b4be-4e48-b3a4-7994b69bb101'],
    } as ConfigObject);
  });

  it('renders modal content', () => {
    const closeModal = vi.fn();
    render(<TransitionQueueEntryModal queueEntry={queueEntry} closeModal={closeModal} />);

    expect(screen.getByText(/Serve patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Patient name :/i)).toBeInTheDocument();
  });

  it('handles requeueing patient', async () => {
    const user = userEvent.setup();

    const closeModal = vi.fn();
    render(<TransitionQueueEntryModal queueEntry={queueEntry} closeModal={closeModal} />);

    await user.click(screen.getByText('Requeue'));

    expect(requeueQueueEntry).toHaveBeenCalledWith('Requeued', queueEntry.queueUuid, queueEntry.queueEntryUuid);
  });

  it('handles serving patient', async () => {
    const user = userEvent.setup();

    const closeModal = vi.fn();
    render(<TransitionQueueEntryModal queueEntry={queueEntry} closeModal={closeModal} />);

    await user.click(screen.getByText('Serve'));

    expect(updateQueueEntry).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
    expect(serveQueueEntry).toHaveBeenCalled();
  });
});
