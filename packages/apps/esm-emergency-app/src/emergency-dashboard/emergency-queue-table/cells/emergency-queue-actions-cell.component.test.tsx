import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../../../config-schema';
import { WORKSPACES } from '../../../constants';
import { saveTriageTransitionCheckpoint } from '../../../emergency-workflow/triage-transition-reconciliation-checkpoint';
import { type EmergencyQueueEntry } from '../../../resources/emergency.resource';
import { EmergencyQueueActionsCell } from './emergency-queue-actions-cell.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

const triageEncounterTypeUuid = 'triage-encounter-type-uuid';
const triageQueueUuid = 'triage-queue-uuid';
const inServiceStatusUuid = 'in-service-status-uuid';

const config: Config = {
  ...(getDefaultsFromConfigSchema(configSchema) as Config),
  emergencyTriageQueueUuid: triageQueueUuid,
  queueStatuses: {
    ...(getDefaultsFromConfigSchema(configSchema) as Config).queueStatuses,
    inServiceUuid: inServiceStatusUuid,
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
  },
  priority: {
    uuid: 'priority-uuid',
    display: 'Priority I',
  },
  status: {
    uuid: inServiceStatusUuid,
    display: 'In service',
  },
  queue: {
    uuid: triageQueueUuid,
    display: 'Triage',
  },
  visit: {
    uuid: 'visit-uuid',
    display: 'Visit',
    startDatetime: '2026-06-11T10:00:00.000Z',
    encounters: [],
  },
  startedAt: '2026-06-11T10:00:00.000Z',
  sortWeight: 1,
} satisfies EmergencyQueueEntry;

describe('EmergencyQueueActionsCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseConfig.mockReturnValue(config);
    mockUseSession.mockReturnValue({ user: { uuid: 'user-1' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('blocks another vitals submission while a prior queue transition requires reconciliation', async () => {
    expect(
      saveTriageTransitionCheckpoint({
        version: 1,
        sourceQueueEntryUuid: queueEntry.uuid,
        patientUuid: queueEntry.patient.uuid,
        visitUuid: queueEntry.visit.uuid,
        sourceQueueUuid: queueEntry.queue.uuid,
        sourceStatusUuid: queueEntry.status.uuid,
        targetQueueUuid: 'attention-queue-uuid',
        targetStatusUuid: 'waiting-status-uuid',
        targetPriorityUuid: 'priority-i-uuid',
      }),
    ).toBe(true);
    const user = userEvent.setup();

    render(<EmergencyQueueActionsCell queueEntry={queueEntry} />);
    await user.click(screen.getByRole('button', { name: /triaje/i }));

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      subtitle:
        'Los signos vitales fueron guardados, pero no se pudo confirmar el envío a atención. No vuelva a guardar los signos ni repita el triaje; revise la cola.',
      title: 'Signos vitales ya guardados',
    });
  });

  it('opens the shared vitals workspace with the triage encounter type override', async () => {
    const user = userEvent.setup();

    render(<EmergencyQueueActionsCell queueEntry={queueEntry} />);

    await user.click(screen.getByRole('button', { name: /triaje/i }));

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
    );
  });
});
