import { getDefaultsFromConfigSchema, launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../config-schema';
import { WORKSPACES } from '../constants';
import { type EmergencyQueueEntry, updateEmergencyQueueEntry } from '../resources/emergency.resource';
import ServePatientModal from './serve-patient.modal';

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  updateEmergencyQueueEntry: vi.fn(),
}));

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUpdateEmergencyQueueEntry = vi.mocked(updateEmergencyQueueEntry);
const mockUseConfig = vi.mocked(useConfig<Config>);

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
  });

  it('opens the shared vitals workspace with the triage encounter type after serving a triage queue patient', async () => {
    const user = userEvent.setup();

    render(<ServePatientModal queueEntry={queueEntry} closeModal={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /atender/i }));

    await waitFor(() =>
      expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
        WORKSPACES.TRIAGE_VITALS_FORM,
        { encounterTypeUuid: triageEncounterTypeUuid, profile: 'emergency-triage' },
        null,
        { patientUuid: queueEntry.patient.uuid },
      ),
    );
    expect(mockUpdateEmergencyQueueEntry).toHaveBeenCalledWith(queueEntry.uuid, {
      statusUuid: inServiceStatusUuid,
    });
  });
});
