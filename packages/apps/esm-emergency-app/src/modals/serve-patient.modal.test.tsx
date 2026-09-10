import {
  getDefaultsFromConfigSchema,
  launchWorkspace,
  launchWorkspace2,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../config-schema';
import { WORKSPACES } from '../constants';
import {
  type EmergencyQueueEntry,
  transitionToAttentionQueue,
  updateEmergencyQueueEntry,
} from '../resources/emergency.resource';
import ServePatientModal from './serve-patient.modal';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  transitionToAttentionQueue: vi.fn(),
  updateEmergencyQueueEntry: vi.fn(),
  useMutateEmergencyQueueEntries: () => ({ mutateEmergencyQueueEntries: refresh }),
}));

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
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
  startedAt: '2026-06-11T10:00:00.000Z',
  sortWeight: 1,
} satisfies EmergencyQueueEntry;

describe('ServePatientModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
    mockUseConfig.mockReturnValue(config);
    mockLaunchWorkspace2.mockResolvedValue(true);
    vi.mocked(launchWorkspace).mockImplementation(() => undefined);
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
      queueEntry.uuid,
      queueEntry.patient.uuid,
      'visit-uuid',
      priorityIVConceptUuid,
      attentionQueueUuid,
      waitingStatusUuid,
      4,
    );
  });

  it.each([
    'cancelled',
    'rejected',
  ] as const)('keeps a recovery action when opening triage is %s without repeating the status write', async (outcome) => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    if (outcome === 'cancelled') mockLaunchWorkspace2.mockResolvedValueOnce(false);
    else mockLaunchWorkspace2.mockRejectedValueOnce(new Error('Synthetic internal workspace failure'));
    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /^atender$/i }));
    const retry = await screen.findByRole('button', { name: /reintentar abrir formulario/i });
    expect(closeModal).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(screen.queryByText('Synthetic internal workspace failure')).not.toBeInTheDocument();
    await user.click(retry);
    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledTimes(1);
    expect(mockLaunchWorkspace2).toHaveBeenCalledTimes(2);
  });

  it('waits for the workspace result and prevents a second status write while opening', async () => {
    const user = userEvent.setup();
    let resolveOpen: (opened: boolean) => void;
    mockLaunchWorkspace2.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOpen = resolve;
        }),
    );
    const closeModal = vi.fn();
    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.dblClick(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(mockLaunchWorkspace2).toHaveBeenCalledTimes(1));
    expect(closeModal).not.toHaveBeenCalled();
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveOpen(true);
    });
    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
  });

  it('does not open a workspace when the status update fails', async () => {
    mockUpdateEmergencyQueueEntry.mockRejectedValueOnce(new Error('Synthetic internal queue failure'));
    const user = userEvent.setup();
    const closeModal = vi.fn();
    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await user.click(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('handles an attention workspace launch error with the same recovery flow', async () => {
    vi.mocked(launchWorkspace).mockImplementationOnce(() => {
      throw new Error('Synthetic workspace launch failure');
    });
    const user = userEvent.setup();
    const closeModal = vi.fn();
    render(
      <ServePatientModal
        queueEntry={{ ...queueEntry, queue: { uuid: attentionQueueUuid, display: 'Attention' } }}
        closeModal={closeModal}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^atender$/i }));
    await user.click(await screen.findByRole('button', { name: /reintentar abrir formulario/i }));
    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledTimes(1);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });
  it('does not open an old patient after the modal receives another queue entry', async () => {
    let finish!: (value: Awaited<ReturnType<typeof updateEmergencyQueueEntry>>) => void;
    mockUpdateEmergencyQueueEntry.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const closeModal = vi.fn();
    const view = render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await userEvent.click(screen.getByRole('button', { name: /^atender$/i }));
    const next = { ...queueEntry, uuid: 'synthetic-next-entry' };
    view.rerender(<ServePatientModal queueEntry={next} closeModal={closeModal} />);
    await act(async () => {
      finish({ status: 200 } as Awaited<ReturnType<typeof updateEmergencyQueueEntry>>);
    });
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^atender$/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenLastCalledWith(next.uuid, { statusUuid: inServiceStatusUuid });
  });

  it('opens the confirmed workspace even if refreshing the queue fails', async () => {
    refresh.mockRejectedValueOnce(new Error('Synthetic internal refresh failure'));
    const closeModal = vi.fn();
    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await userEvent.click(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledOnce();
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('Synthetic internal refresh failure');
  });

  it('opens an already attended entry without another status update', async () => {
    const closeModal = vi.fn();
    render(
      <ServePatientModal
        queueEntry={{ ...queueEntry, status: { uuid: inServiceStatusUuid, display: 'In service' } }}
        closeModal={closeModal}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(closeModal).toHaveBeenCalledOnce());
    expect(mockLaunchWorkspace2).toHaveBeenCalledOnce();
    expect(mockUpdateEmergencyQueueEntry).not.toHaveBeenCalled();
  });

  it.each([NaN, 500])('does not announce success for an unconfirmed response status %s', async (status) => {
    mockUpdateEmergencyQueueEntry.mockResolvedValueOnce({ status } as Awaited<
      ReturnType<typeof updateEmergencyQueueEntry>
    >);
    const closeModal = vi.fn();
    render(<ServePatientModal queueEntry={queueEntry} closeModal={closeModal} />);
    await userEvent.click(screen.getByRole('button', { name: /^atender$/i }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
