import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  useConfig,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession, mockVisitAlice } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';

import QueueFields, { type QueueFieldsCallbacks } from './queue-fields.component';
import { postQueueEntry, postQueueEntryWithoutVisit } from './queue-fields.resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);

vi.mock('../hooks/useQueueLocations', () => ({
  useQueueLocations: vi.fn(() => ({
    queueLocations: [
      { id: '1', name: 'Location 1' },
      { id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
    ],
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
    postQueueEntryWithoutVisit: vi.fn(),
  };
});
const mockPostQueueEntry = vi.mocked(postQueueEntry).mockResolvedValue({
  created: true,
  response: {} as FetchResponse,
});
const mockPostQueueEntryWithoutVisit = vi.mocked(postQueueEntryWithoutVisit).mockResolvedValue({
  created: true,
  response: {} as FetchResponse,
  queueEntry: { uuid: 'queue-entry-uuid' },
} as Awaited<ReturnType<typeof postQueueEntryWithoutVisit>>);

describe('QueueFields', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      visitQueueNumberAttributeUuid: 'queue-number-attribute-uuid',
    });
  });

  it('renders the form fields and returns the set values', async () => {
    const user = userEvent.setup();
    let callbacks: QueueFieldsCallbacks | undefined;
    render(<QueueFields setCallbacks={(value) => (callbacks = value)} />);

    expect(screen.getByLabelText('Select a queue location')).toBeInTheDocument();
    expect(screen.getByLabelText('Select a service')).toBeInTheDocument();

    const queueUuid = 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90';
    const serviceSelect = screen.getByLabelText('Select a service').closest('select');
    expect(serviceSelect).not.toBeNull();
    await user.selectOptions(serviceSelect, queueUuid);

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('High')).toBeChecked());

    expect(callbacks).toBeDefined();
    if (!callbacks) {
      throw new Error('Queue field callbacks were not set');
    }
    expect(callbacks.onBeforeVisitSave()).toBe(true);
    await callbacks.onVisitCreatedOrUpdated(mockVisitAlice);
    expect(mockPostQueueEntry).toHaveBeenCalledWith(
      mockVisitAlice.uuid,
      queueUuid, // queueUuid
      mockVisitAlice.patient.uuid,
      '197852c7-5fd4-4b33-89cc-7bae6848c65a', // priority
      '176052c7-5fd4-4b33-89cc-7bae6848c65a', // status
      0, // sortWeight
      '1', // locationUuid
      'queue-number-attribute-uuid',
      mockVisitAlice.startDatetime,
    );
  });

  it('blocks submission until a service is selected', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;
    render(<QueueFields setCallbacks={(value) => (callbacks = value)} />);

    expect(callbacks).toBeDefined();
    await act(async () => expect(callbacks?.onBeforeVisitSave()).toBe(false));
    expect(mockPostQueueEntry).not.toHaveBeenCalled();
  });

  it('creates an administrative queue entry without requiring a visit or queue ticket configuration', async () => {
    const user = userEvent.setup();
    let callbacks: QueueFieldsCallbacks | undefined;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      visitQueueNumberAttributeUuid: null,
    });

    render(
      <QueueFields
        patientUuid="patient-without-visit"
        setCallbacks={(value) => (callbacks = value)}
        visitRequired={false}
      />,
    );

    const queueUuid = 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90';
    await user.selectOptions(screen.getByLabelText('Select a service'), queueUuid);
    await waitFor(() => expect(callbacks?.onBeforeVisitSave()).toBe(true));
    await callbacks?.onVisitCreatedOrUpdated();

    expect(mockPostQueueEntryWithoutVisit).toHaveBeenCalledWith(
      queueUuid,
      'patient-without-visit',
      '197852c7-5fd4-4b33-89cc-7bae6848c65a',
      '176052c7-5fd4-4b33-89cc-7bae6848c65a',
      0,
    );
    expect(mockPostQueueEntry).not.toHaveBeenCalled();
    expect(screen.queryByText(/queue ticket/i)).not.toBeInTheDocument();
  });

  it('uses the appointment queue location while the session location is unavailable', async () => {
    const user = userEvent.setup();
    let callbacks: QueueFieldsCallbacks | undefined;
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      sessionLocation: null,
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields currentQueueLocationUuid="1" setCallbacks={(value) => (callbacks = value)} />);

    await waitFor(() => expect(screen.getByLabelText('Select a queue location')).toHaveValue('1'));

    const queueUuid = 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90';
    await user.selectOptions(screen.getByLabelText('Select a service'), queueUuid);
    await waitFor(() => expect(callbacks?.onBeforeVisitSave()).toBe(true));
    await callbacks?.onVisitCreatedOrUpdated(mockVisitAlice);

    expect(mockPostQueueEntry).toHaveBeenCalledWith(
      mockVisitAlice.uuid,
      queueUuid,
      mockVisitAlice.patient.uuid,
      '197852c7-5fd4-4b33-89cc-7bae6848c65a',
      '176052c7-5fd4-4b33-89cc-7bae6848c65a',
      0,
      '1',
      'queue-number-attribute-uuid',
      mockVisitAlice.startDatetime,
    );
  });

  it('falls back to the first queue location while the session location is unavailable', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      sessionLocation: null,
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields setCallbacks={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Select a queue location')).toHaveValue('1'));
  });

  it('hides obstetric locations for male patients', () => {
    render(<QueueFields patientGender="M" setCallbacks={vi.fn()} />);

    expect(screen.queryByRole('option', { name: 'UPSS - CENTRO OBSTÉTRICO' })).not.toBeInTheDocument();
  });
});
