import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  useConfig,
  useLayoutType,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession, mockVisitAlice } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';

import QueueFields from './queue-fields.component';
import { postQueueEntry } from './queue-fields.resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);

vi.mock('../hooks/useQueueLocations', () => ({
  useQueueLocations: vi.fn(() => ({
    queueLocations: [{ id: '1', name: 'Location 1' }],
  })),
}));

vi.mock('../../hooks/useQueues', () => {
  return {
    useQueues: vi.fn().mockReturnValue({
      queues: [
        {
          uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
          name: 'Service 1',
          allowedPriorities: [{ uuid: '197852c7-5fd4-4b33-89cc-7bae6848c65a', display: 'High' }],
          allowedStatuses: [{ uuid: '176052c7-5fd4-4b33-89cc-7bae6848c65a', display: 'In Progress' }],
        },
      ],
    }),
  };
});

vi.mock('./queue-fields.resource', () => {
  return {
    postQueueEntry: vi.fn(),
  };
});
const mockPostQueueEntry = vi.mocked(postQueueEntry).mockResolvedValue({
  created: true,
  response: {} as FetchResponse,
});

describe('QueueFields', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
    });
  });

  it('renders the form fields and returns the set values', async () => {
    const user = userEvent.setup();
    let onSubmit: ((visit: Visit) => Promise<unknown>) | undefined;
    const setOnSubmit = (callback: (visit: Visit) => Promise<unknown>) => {
      onSubmit = callback;
    };
    render(<QueueFields setOnSubmit={setOnSubmit} />);

    expect(screen.getByLabelText('Select a queue location')).toBeInTheDocument();
    expect(screen.getByLabelText('Select a service')).toBeInTheDocument();

    const queueUuid = 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90';
    const serviceSelect = screen.getByLabelText('Select a service').closest('select');
    expect(serviceSelect).not.toBeNull();
    await user.selectOptions(serviceSelect, queueUuid);

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('High')).toBeChecked());

    expect(onSubmit).toBeDefined();
    if (!onSubmit) {
      throw new Error('onSubmit callback was not set');
    }
    await onSubmit(mockVisitAlice);
    expect(mockPostQueueEntry).toHaveBeenCalledWith(
      mockVisitAlice.uuid,
      queueUuid, // queueUuid
      mockVisitAlice.patient.uuid,
      '197852c7-5fd4-4b33-89cc-7bae6848c65a', // priority
      '176052c7-5fd4-4b33-89cc-7bae6848c65a', // status
      0, // sortWeight
      '1', // locationUuid
      null, // visitQueueNumberAttributeUuid
    );
  });
});
