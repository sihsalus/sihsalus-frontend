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
import { postQueueEntry } from './queue-fields.resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);
const mockQueueLocations = vi.fn(() => ({
  queueLocations: [{ id: '1', name: 'Location 1' }],
  error: undefined,
  isLoading: false,
}));
const mockQueues = vi.fn(() => ({
  queues: [
    {
      uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
      name: 'Service 1',
      allowedPriorities: [{ uuid: '197852c7-5fd4-4b33-89cc-7bae6848c65a', display: 'High' }],
      allowedStatuses: [{ uuid: '176052c7-5fd4-4b33-89cc-7bae6848c65a', display: 'In Progress' }],
    },
  ],
  error: undefined,
  isLoading: false,
}));

vi.mock('../hooks/useQueueLocations', () => ({
  useQueueLocations: () => mockQueueLocations(),
}));

vi.mock('../../hooks/useQueues', () => {
  return {
    useQueues: () => mockQueues(),
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
    mockQueueLocations.mockReturnValue({
      queueLocations: [{ id: '1', name: 'Location 1' }],
      error: undefined,
      isLoading: false,
    });
    mockQueues.mockReturnValue({
      queues: [
        {
          uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
          name: 'Service 1',
          allowedPriorities: [{ uuid: '197852c7-5fd4-4b33-89cc-7bae6848c65a', display: 'High' }],
          allowedStatuses: [{ uuid: '176052c7-5fd4-4b33-89cc-7bae6848c65a', display: 'In Progress' }],
        },
      ],
      error: undefined,
      isLoading: false,
    });
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
    mockQueueLocations.mockReturnValue({
      queueLocations: [
        { id: '1', name: 'Location 1' },
        { id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
      ],
      error: undefined,
      isLoading: false,
    });

    render(<QueueFields patientGender="M" setCallbacks={vi.fn()} />);

    expect(screen.queryByRole('option', { name: 'UPSS - CENTRO OBSTÉTRICO' })).not.toBeInTheDocument();
  });

  it('requires an explicit choice when several queue locations exist and none matches the session', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      sessionLocation: null,
    } as unknown as ReturnType<typeof useSession>);
    mockQueueLocations.mockReturnValue({
      queueLocations: [
        { id: '1', name: 'Location 1' },
        { id: '2', name: 'Location 2' },
      ],
      error: undefined,
      isLoading: false,
    });
    let callbacks: QueueFieldsCallbacks | undefined;

    render(<QueueFields setCallbacks={(value) => (callbacks = value)} />);

    await waitFor(() => expect(screen.getByLabelText('Select a queue location')).toHaveValue(''));
    await act(async () => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });

  it('blocks a forced queue location that is absent from the configured catalog', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;

    render(<QueueFields currentQueueLocationUuid="missing-location" setCallbacks={(value) => (callbacks = value)} />);

    expect(
      await screen.findByText(
        'La ubicación requerida no está configurada como ubicación de cola. Contacte al administrador.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select a queue location')).toHaveValue('');
    await act(async () => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });

  it('blocks a forced service that is absent from the selected queue location', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;

    render(<QueueFields currentServiceQueueUuid="missing-service" setCallbacks={(value) => (callbacks = value)} />);

    expect(
      await screen.findByText(
        'El servicio requerido no está configurado para esta ubicación de cola. Contacte al administrador.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select a service')).toHaveValue('');
    await act(async () => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });
});
