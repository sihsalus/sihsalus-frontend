import {
  getDefaultsFromConfigSchema,
  launchWorkspace,
  launchWorkspace2,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../config-schema';
import { WORKSPACES } from '../constants';
import {
  assertEmergencyQueueEntryActive,
  type EmergencyQueueEntry,
  transitionToAttentionQueue,
  updateEmergencyQueueEntry,
} from '../resources/emergency.resource';
import ServePatientModal from './serve-patient.modal';

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  assertEmergencyQueueEntryActive: vi.fn(),
  transitionToAttentionQueue: vi.fn(),
  updateEmergencyQueueEntry: vi.fn(),
}));

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockLaunchWorkspace = vi.mocked(launchWorkspace);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockAssertEmergencyQueueEntryActive = vi.mocked(assertEmergencyQueueEntryActive);
const mockTransitionToAttentionQueue = vi.mocked(transitionToAttentionQueue);
const mockUpdateEmergencyQueueEntry = vi.mocked(updateEmergencyQueueEntry);
const mockUseConfig = vi.mocked(useConfig<Config>);

const attentionQueueUuid = 'attention-queue-uuid';
const priorityIVConceptUuid = 'priority-iv-concept-uuid';
const triageEncounterTypeUuid = 'triage-encounter-type-uuid';
const triageQueueUuid = 'triage-queue-uuid';
const inServiceStatusUuid = 'in-service-status-uuid';
const waitingStatusUuid = 'waiting-status-uuid';

const config: Config = {
  ...(getDefaultsFromConfigSchema(configSchema) as Config),
  emergencyAttentionQueueUuid: attentionQueueUuid,
  emergencyTriageQueueUuid: triageQueueUuid,
  concepts: {
    ...(getDefaultsFromConfigSchema(configSchema) as Config).concepts,
    priorityIVConceptUuid,
  },
  priorityConfigs: [
    {
      code: 'PRIORITY_IV',
      conceptUuid: priorityIVConceptUuid,
      label: 'Prioridad IV',
      description: 'Prioridad IV',
      color: 'green',
      style: null,
      sortWeight: 4,
      maxWaitTimeMinutes: 120,
    },
  ],
  queueStatuses: {
    ...(getDefaultsFromConfigSchema(configSchema) as Config).queueStatuses,
    inServiceUuid: inServiceStatusUuid,
    waitingUuid: waitingStatusUuid,
  },
  triageEncounter: {
    ...(getDefaultsFromConfigSchema(configSchema) as Config).triageEncounter,
    encounterTypeUuid: triageEncounterTypeUuid,
  },
};

const queueEntry = {
  uuid: 'queue-entry-uuid',
  patient: {
    uuid: 'patient-uuid',
    display: 'Test Patient',
    person: {
      uuid: 'person-uuid',
      display: 'Test Patient',
      gender: 'M',
      age: 30,
      birthdate: '1996-01-01',
    },
    identifiers: [],
  },
  priority: {
    uuid: 'priority-uuid',
    display: 'Priority I',
  },
  status: {
    uuid: 'waiting-status-uuid',
    display: 'Waiting',
  },
  queue: {
    uuid: triageQueueUuid,
    display: 'Triage',
  },
  visit: {
    uuid: 'visit-uuid',
    display: 'Emergency visit',
    startDatetime: '2026-06-11T10:00:00.000Z',
  },
  startedAt: '2026-06-11T10:00:00.000Z',
  sortWeight: 1,
} satisfies EmergencyQueueEntry;

describe('ServePatientModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseConfig.mockReturnValue(config);
    mockAssertEmergencyQueueEntryActive.mockResolvedValue({ data: { uuid: queueEntry.uuid } } as Awaited<
      ReturnType<typeof assertEmergencyQueueEntryActive>
    >);
    mockUpdateEmergencyQueueEntry.mockResolvedValue({ status: 200 } as Awaited<
      ReturnType<typeof updateEmergencyQueueEntry>
    >);
    mockTransitionToAttentionQueue.mockResolvedValue({ status: 200 } as Awaited<
      ReturnType<typeof transitionToAttentionQueue>
    >);
  });

  it('opens the shared vitals workspace with the triage encounter type after serving a triage queue patient', async () => {
    const user = userEvent.setup();

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
        WORKSPACES.TRIAGE_VITALS_FORM,
        expect.objectContaining({
          encounterTypeUuid: triageEncounterTypeUuid,
          locationUuid: config.emergencyLocationUuid,
          onVitalsSaved: expect.any(Function),
          profile: 'emergency-triage',
        }),
        null,
        { patientUuid: queueEntry.patient.uuid },
      ),
    );
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledWith(queueEntry.uuid, {
      statusUuid: inServiceStatusUuid,
    });
    expect(mockAssertEmergencyQueueEntryActive).toHaveBeenCalledTimes(2);
  });

  it('moves a triaged patient to the attention queue with the calculated priority after vitals are saved', async () => {
    const user = userEvent.setup();

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalled());
    const workspaceProps = mockLaunchWorkspace2.mock.calls[0][1] as {
      onVitalsSaved: (payload: { formData: Record<string, number>; visitUuid: string }) => Promise<void>;
    };

    await workspaceProps.onVitalsSaved({
      formData: {
        respiratoryRate: 18,
        oxygenSaturation: 98,
        systolicBloodPressure: 120,
        pulse: 72,
        temperature: 37,
      },
      visitUuid: 'visit-uuid',
    });

    expect(mockTransitionToAttentionQueue).toHaveBeenCalledWith(
      {
        sourceQueueEntryUuid: queueEntry.uuid,
        patientUuid: queueEntry.patient.uuid,
        visitUuid: 'visit-uuid',
        sourceQueueUuid: queueEntry.queue.uuid,
        sourceStatusUuid: inServiceStatusUuid,
        targetPriorityUuid: priorityIVConceptUuid,
        targetQueueUuid: attentionQueueUuid,
        targetStatusUuid: waitingStatusUuid,
      },
    );
  });

  it('does not expose backend details when serving the patient fails', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    mockUpdateEmergencyQueueEntry.mockRejectedValue(new Error('POST /ws/rest/v1/queue-entry returned SQLSTATE 40001'));
    mockAssertEmergencyQueueEntryActive
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >)
      .mockRejectedValueOnce(new Error('GET /queue-entry failed with SQLSTATE 57014'));

    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle:
            'No se pudo confirmar que el paciente pasó a atención. Verifique su estado en la cola antes de intentarlo nuevamente.',
        }),
      ),
    );
    expect(closeModal).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });

  it('treats an unsuccessful HTTP response as a serving failure', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    mockUpdateEmergencyQueueEntry.mockResolvedValue({ status: 500 } as Awaited<
      ReturnType<typeof updateEmergencyQueueEntry>
    >);
    mockAssertEmergencyQueueEntryActive
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >)
      .mockRejectedValueOnce(new Error('The target state was not persisted'));

    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(closeModal).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('reconciles a lost update response and launches the workspace only once', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    mockUpdateEmergencyQueueEntry.mockRejectedValueOnce(new Error('network response lost'));

    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    expect(mockAssertEmergencyQueueEntryActive).toHaveBeenCalledTimes(2);
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledOnce();
    expect(closeModal).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('retries only verification after a successful write cannot initially be read back', async () => {
    const user = userEvent.setup();
    mockAssertEmergencyQueueEntryActive
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >)
      .mockRejectedValueOnce(new Error('post-write read unavailable'))
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >);

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    const reconcileButton = await screen.findByRole('button', { name: 'Verificar estado y continuar' });
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    await user.click(reconcileButton);

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledOnce();
    expect(mockAssertEmergencyQueueEntryActive).toHaveBeenCalledTimes(3);
  });

  it('preserves a pending update across remount and never posts it again', async () => {
    const user = userEvent.setup();
    mockAssertEmergencyQueueEntryActive
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >)
      .mockRejectedValueOnce(new Error('post-write read unavailable'))
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >);

    const firstRender = render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));
    expect(await screen.findByText('Atención pendiente de verificación')).toBeInTheDocument();
    firstRender.unmount();

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Verificar estado y continuar' }));

    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledOnce());
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledOnce();
  });

  it('passes the verified in-service status to the attention workspace', async () => {
    const user = userEvent.setup();
    const attentionEntry: EmergencyQueueEntry = {
      ...queueEntry,
      queue: { ...queueEntry.queue, uuid: attentionQueueUuid, display: 'Attention' },
    };

    render(<ServePatientModal queueEntry={attentionEntry} closeModal={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() =>
      expect(mockLaunchWorkspace).toHaveBeenCalledWith(WORKSPACES.ATTENTION_FORM, {
        queueEntry: expect.objectContaining({
          uuid: attentionEntry.uuid,
          status: expect.objectContaining({ uuid: inServiceStatusUuid }),
        }),
      }),
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('clears the retry checkpoint only when an explicit rejection and the original state are both verified', async () => {
    const user = userEvent.setup();
    mockUpdateEmergencyQueueEntry.mockRejectedValueOnce({ response: { status: 400 } });
    mockAssertEmergencyQueueEntryActive
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >)
      .mockRejectedValueOnce(new Error('target state absent'))
      .mockResolvedValueOnce({ data: { uuid: queueEntry.uuid } } as Awaited<
        ReturnType<typeof assertEmergencyQueueEntryActive>
      >);

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /atender/i }));

    expect(await screen.findByRole('button', { name: 'Atender' })).toBeEnabled();
    expect(screen.queryByText('Atención pendiente de verificación')).not.toBeInTheDocument();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });
});
