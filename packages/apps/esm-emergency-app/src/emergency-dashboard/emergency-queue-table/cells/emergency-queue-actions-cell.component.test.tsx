import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../../../config-schema';
import { WORKSPACES } from '../../../constants';
import { type EmergencyQueueEntry } from '../../../resources/emergency.resource';
import { EmergencyQueueActionsCell } from './emergency-queue-actions-cell.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
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
    mockUseConfig.mockReturnValue(config);
    mockUseSession.mockReturnValue({ user: { uuid: 'user-1' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('opens the shared vitals workspace with the triage encounter type override', async () => {
    const user = userEvent.setup();

    render(<EmergencyQueueActionsCell queueEntry={queueEntry} />);

    await user.click(screen.getByRole('button', { name: /triaje/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      WORKSPACES.TRIAGE_VITALS_FORM,
      expect.objectContaining({
        encounterTypeUuid: triageEncounterTypeUuid,
        expectedVisitTypeUuid: config.emergencyVisitTypeUuid,
        locationUuid: config.emergencyLocationUuid,
        onVitalsSaved: expect.any(Function),
        profile: 'emergency-triage',
      }),
      null,
      { patientUuid: queueEntry.patient.uuid },
    );
  });

  it('uses the canonical emergency triage default with the emergency profile and UPSS', async () => {
    const user = userEvent.setup();
    const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
    mockUseConfig.mockReturnValue({ ...config, triageEncounter: defaults.triageEncounter });

    render(<EmergencyQueueActionsCell queueEntry={queueEntry} />);
    await user.click(screen.getByRole('button', { name: /triaje/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      WORKSPACES.TRIAGE_VITALS_FORM,
      expect.objectContaining({
        encounterTypeUuid: '978deb64-358e-4c78-bbb0-04cea73df805',
        expectedVisitTypeUuid: defaults.emergencyVisitTypeUuid,
        locationUuid: defaults.emergencyLocationUuid,
        profile: 'emergency-triage',
      }),
      null,
      { patientUuid: queueEntry.patient.uuid },
    );
  });
});
