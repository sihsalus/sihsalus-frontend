import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config } from '../config-schema';
import {
  endEmergencyQueueEntry,
  stopEmergencyVisit,
  useMutateEmergencyQueueEntries,
} from '../resources/emergency.resource';
import { createAttentionEncounter } from './attention-form.resource';
import AttentionFormWorkspace from './attention-form.workspace';

vi.mock('../resources/emergency.resource', () => ({
  endEmergencyQueueEntry: vi.fn(),
  stopEmergencyVisit: vi.fn(),
  useMutateEmergencyQueueEntries: vi.fn(),
}));
vi.mock('./attention-form.resource', () => ({ createAttentionEncounter: vi.fn() }));

const mockUseConfig = vi.mocked(useConfig<Config>);
const mockCreateAttentionEncounter = vi.mocked(createAttentionEncounter);
const mockEndEmergencyQueueEntry = vi.mocked(endEmergencyQueueEntry);
const mockStopEmergencyVisit = vi.mocked(stopEmergencyVisit);
const mockUseMutateEmergencyQueueEntries = vi.mocked(useMutateEmergencyQueueEntries);
const mockShowSnackbar = vi.mocked(showSnackbar);

const queueEntry = {
  uuid: 'queue-entry-uuid',
  patient: {
    uuid: 'patient-uuid',
    display: 'Emergency patient',
    person: { uuid: 'person-uuid', display: 'Emergency patient', gender: 'F', age: 30, birthdate: '1996-01-01' },
  },
  visit: { uuid: 'visit-uuid', display: 'Emergency visit', startDatetime: '2026-08-12T14:00:00.000Z' },
  priority: { uuid: 'priority-uuid', display: 'Priority I' },
  status: { uuid: 'status-uuid', display: 'In service' },
  queue: { uuid: 'queue-uuid', display: 'Attention' },
  startedAt: '2026-08-12T14:00:00.000Z',
  sortWeight: 0,
};

describe('AttentionFormWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      emergencyLocationUuid: 'location-uuid',
      closeVisitOnDisposition: false,
      attentionEncounter: {
        encounterTypeUuid: 'encounter-type-uuid',
        concepts: {
          diagnosisUuid: 'diagnosis-concept',
          treatmentUuid: 'treatment-concept',
          auxiliaryExamsUuid: 'exam-concept',
        },
      },
    } as Config);
    mockUseMutateEmergencyQueueEntries.mockReturnValue({ mutateEmergencyQueueEntries: vi.fn() });
    mockCreateAttentionEncounter.mockResolvedValue({ data: { uuid: 'encounter-uuid' } } as never);
    mockEndEmergencyQueueEntry.mockResolvedValue({ data: { ...queueEntry, endedAt: new Date().toISOString() } } as never);
    mockStopEmergencyVisit.mockResolvedValue({ data: {} } as never);
  });

  it('retries only queue cleanup after the encounter was confirmed', async () => {
    const closeError = new TypeError('queue close response lost');
    mockEndEmergencyQueueEntry.mockRejectedValueOnce(closeError).mockResolvedValueOnce({ data: {} } as never);
    const closeWorkspace = vi.fn();
    const user = userEvent.setup();
    render(
      <AttentionFormWorkspace
        queueEntry={queueEntry}
        closeWorkspace={closeWorkspace}
        closeWorkspaceWithSavedChanges={vi.fn()}
        promptBeforeClosing={vi.fn()}
        setTitle={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Diagnóstico(s) del paciente'), 'Trauma');
    await user.type(screen.getByLabelText('Plan de tratamiento'), 'Sutura');
    await user.click(screen.getByRole('button', { name: 'Guardar atención' }));

    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledOnce());
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(closeWorkspace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Guardar atención' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(mockEndEmergencyQueueEntry).toHaveBeenCalledTimes(2);
    expect(mockShowSnackbar.mock.calls.filter(([options]) => options.kind === 'error')).toHaveLength(1);
  });
});
