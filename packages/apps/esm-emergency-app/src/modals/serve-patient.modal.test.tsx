import { getDefaultsFromConfigSchema, launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../config-schema';
import { WORKSPACES } from '../constants';
import {
  type EmergencyQueueEntry,
  transitionToAttentionQueue,
  updateEmergencyQueueEntry,
} from '../resources/emergency.resource';
import ServePatientModal from './serve-patient.modal';

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  transitionToAttentionQueue: vi.fn(),
  updateEmergencyQueueEntry: vi.fn(),
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
    mockUseConfig.mockReturnValue(config);
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
});
