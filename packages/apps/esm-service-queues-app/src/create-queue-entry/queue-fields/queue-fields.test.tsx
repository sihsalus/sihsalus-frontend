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
import { serviceQueuesEditPrivilege } from '../../constants';
import { useQueues } from '../../hooks/useQueues';
import { AddPatientToQueueContext } from '../create-queue-entry.workspace';
import { useQueueLocations } from '../hooks/useQueueLocations';

import QueueFields, { type QueueFieldsCallbacks } from './queue-fields.component';
import { postQueueEntry, postQueueEntryWithoutVisit } from './queue-fields.resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);

vi.mock('../hooks/useQueueLocations', () => ({ useQueueLocations: vi.fn() }));

vi.mock('../../hooks/useQueues', () => ({ useQueues: vi.fn() }));

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
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueues = vi.mocked(useQueues);

const queueLocations = [
  { id: '1', name: 'Location 1' },
  { id: 'obstetric-location', name: 'UPSS - CENTRO OBSTÉTRICO' },
] as Array<fhir.Location>;
const queues = [
  {
    uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
    display: 'Service 1',
    name: 'Service 1',
    location: { uuid: '1', display: 'Location 1' },
    allowedPriorities: [{ uuid: '197852c7-5fd4-4b33-89cc-7bae6848c65a', display: 'High' }],
    allowedStatuses: [{ uuid: '176052c7-5fd4-4b33-89cc-7bae6848c65a', display: 'In Progress' }],
  },
];

describe('QueueFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          { uuid: 'queue-edit', display: serviceQueuesEditPrivilege, name: serviceQueuesEditPrivilege, links: [] },
        ],
      },
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      visitQueueNumberAttributeUuid: 'queue-number-attribute-uuid',
    });
    mockUseQueueLocations.mockReturnValue({ queueLocations, isLoading: false, error: undefined });
    mockUseQueues.mockReturnValue({ queues, isLoading: false, error: undefined } as ReturnType<typeof useQueues>);
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
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          { uuid: 'queue-edit', display: serviceQueuesEditPrivilege, name: serviceQueuesEditPrivilege, links: [] },
        ],
      },
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields currentQueueLocationUuid="1" setCallbacks={(value) => (callbacks = value)} />);

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Queue location' })).toHaveValue('Location 1'));

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
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          { uuid: 'queue-edit', display: serviceQueuesEditPrivilege, name: serviceQueuesEditPrivilege, links: [] },
        ],
      },
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields setCallbacks={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Select a queue location')).toHaveValue('1'));
  });

  it('hides obstetric locations for male patients', () => {
    render(<QueueFields patientGender="M" setCallbacks={vi.fn()} />);

    expect(screen.queryByRole('option', { name: 'UPSS - CENTRO OBSTÉTRICO' })).not.toBeInTheDocument();
  });

  it('shows fixed queue context as read-only values', async () => {
    const queueUuid = 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90';

    render(
      <AddPatientToQueueContext.Provider value={{ currentQueueLocationUuid: '1', currentServiceQueueUuid: queueUuid }}>
        <QueueFields setCallbacks={vi.fn()} />
      </AddPatientToQueueContext.Provider>,
    );

    const location = await screen.findByRole('textbox', { name: 'Queue location' });
    const service = await screen.findByRole('textbox', { name: 'Service' });

    expect(location).toHaveValue('Location 1');
    expect(location).toHaveAttribute('readonly');
    expect(service).toHaveValue('Service 1');
    expect(service).toHaveAttribute('readonly');
    expect(screen.queryByRole('combobox', { name: 'Select a queue location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select a service' })).not.toBeInTheDocument();
  });

  it('shows a contextual error instead of a stale fixed Queue Location UUID', () => {
    render(<QueueFields currentQueueLocationUuid="missing-location" setCallbacks={vi.fn()} />);

    expect(screen.getByText('This queue location is not available')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('missing-location')).not.toBeInTheDocument();
  });

  it('shows a contextual error instead of a stale fixed service UUID', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;
    render(
      <QueueFields
        currentQueueLocationUuid="1"
        currentServiceQueueUuid="missing-service"
        setCallbacks={(value) => (callbacks = value)}
      />,
    );

    expect(screen.getByText('The selected service is not available at this location')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('missing-service')).not.toBeInTheDocument();
    expect(screen.queryByText('No priorities available')).not.toBeInTheDocument();
    await waitFor(() => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });

  it('clears an editable service when the Queue Location changes', async () => {
    const user = userEvent.setup();
    const otherQueue = {
      ...queues[0],
      uuid: 'other-queue-uuid',
      name: 'Other service',
      location: { uuid: 'obstetric-location', display: 'UPSS - CENTRO OBSTÉTRICO' },
    };
    mockUseQueues.mockImplementation(
      (queueLocationUuid) =>
        ({
          queues: queueLocationUuid === 'obstetric-location' ? [otherQueue] : queues,
          isLoading: false,
          error: undefined,
        }) as ReturnType<typeof useQueues>,
    );

    render(<QueueFields setCallbacks={vi.fn()} />);

    const service = screen.getByLabelText('Select a service');
    await user.selectOptions(service, queues[0].uuid);
    expect(service).toHaveValue(queues[0].uuid);

    await user.selectOptions(screen.getByLabelText('Select a queue location'), 'obstetric-location');
    await waitFor(() => expect(service).toHaveValue(''));
  });

  it('keeps the workflow Queue Location authoritative regardless of role or session location', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      sessionLocation: { ...mockSession.data.sessionLocation, uuid: '1', display: 'Stale display' },
      user: { ...mockSession.data.user, privileges: [], roles: [{ display: 'SIHSALUS Admision' }] },
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields currentQueueLocationUuid="obstetric-location" setCallbacks={vi.fn()} />);

    expect(await screen.findByRole('textbox', { name: 'Queue location' })).toHaveValue('UPSS - CENTRO OBSTÉTRICO');
    expect(screen.queryByRole('combobox', { name: 'Select a queue location' })).not.toBeInTheDocument();
  });

  it('requires a workflow context when the user cannot select queue locations', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: { ...mockSession.data.user, privileges: [], roles: [{ display: 'Any operational role' }] },
    } as unknown as ReturnType<typeof useSession>);

    render(<QueueFields setCallbacks={(value) => (callbacks = value)} />);

    expect(screen.getByText('A queue location is required for this workflow')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select a queue location' })).not.toBeInTheDocument();
    await waitFor(() => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });

  it('rejects a fixed queue UUID that belongs to a different Queue Location', async () => {
    let callbacks: QueueFieldsCallbacks | undefined;

    render(
      <QueueFields
        currentQueueLocationUuid="obstetric-location"
        currentServiceQueueUuid={queues[0].uuid}
        setCallbacks={(value) => (callbacks = value)}
      />,
    );

    expect(screen.getByText('The selected service is not available at this location')).toBeInTheDocument();
    await waitFor(() => expect(callbacks?.onBeforeVisitSave()).toBe(false));
  });

  it('distinguishes a queue-location loading failure from missing configuration', () => {
    mockUseQueueLocations.mockReturnValue({
      queueLocations: [],
      isLoading: false,
      error: new Error('network unavailable'),
    });

    render(<QueueFields setCallbacks={vi.fn()} />);

    expect(screen.getByText('Queue locations could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No queue locations are configured')).not.toBeInTheDocument();
  });

  it('shows when no queue locations are configured', () => {
    mockUseQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: undefined });

    render(<QueueFields setCallbacks={vi.fn()} />);

    expect(screen.getByText('No queue locations are configured')).toBeInTheDocument();
    expect(screen.queryByText('Queue locations could not be loaded')).not.toBeInTheDocument();
  });

  it('distinguishes a services loading failure from missing configuration', () => {
    mockUseQueues.mockReturnValue({
      queues: [],
      isLoading: false,
      error: new Error('network unavailable'),
    } as ReturnType<typeof useQueues>);

    render(<QueueFields setCallbacks={vi.fn()} />);

    expect(screen.getByText('Queue services could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No services configured')).not.toBeInTheDocument();
  });

  it('marks editable required fields for assistive technology and native validation', async () => {
    const user = userEvent.setup();
    render(<QueueFields setCallbacks={vi.fn()} />);

    const queueLocation = screen.getByRole('combobox', { name: 'Select a queue location' });
    const service = screen.getByRole('combobox', { name: 'Select a service' });
    expect(queueLocation).toBeRequired();
    expect(queueLocation).toHaveAttribute('aria-required', 'true');
    expect(service).toBeRequired();
    expect(service).toHaveAttribute('aria-required', 'true');

    await user.selectOptions(service, queues[0].uuid);
    const priority = await screen.findByLabelText('High');
    expect(priority.closest('fieldset')).toHaveAttribute('aria-required', 'true');
  });
});
