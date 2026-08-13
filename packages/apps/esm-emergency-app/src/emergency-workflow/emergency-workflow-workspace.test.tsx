import { getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { safeCopyFinanciadorToVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config } from '../config-schema';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import { createEmergencyQueueEntry, useMutateEmergencyQueueEntries } from '../resources/emergency.resource';
import EmergencyWorkflowWorkspace from './emergency-workflow-workspace';
import { useEmergencyVisit } from './hooks/useEmergencyVisit';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  safeCopyFinanciadorToVisit: vi.fn(),
}));

vi.mock('../hooks/usePriorityConfig', () => ({ useEmergencyConfig: vi.fn() }));
vi.mock('../resources/emergency.resource', () => ({
  createEmergencyQueueEntry: vi.fn(),
  useMutateEmergencyQueueEntries: vi.fn(),
}));
vi.mock('./hooks/useEmergencyVisit', () => ({ useEmergencyVisit: vi.fn() }));
vi.mock('./patient-search-registration.component', () => ({
  default: ({ onPatientQueued }) => (
    <button
      type="button"
      onClick={() =>
        onPatientQueued(
          'patient-uuid',
          {
            uuid: 'patient-uuid',
            display: 'Emergency patient',
            emergencyRegistrationContext: {
              arrivalDateTime: '2026-08-12T14:00:00.000Z',
              administrativeNotes: 'Ingreso por SAMU',
            },
          },
          'urgency',
        )
      }
    >
      Queue patient
    </button>
  ),
}));

const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseEmergencyConfig = vi.mocked(useEmergencyConfig);
const mockUseEmergencyVisit = vi.mocked(useEmergencyVisit);
const mockCreateEmergencyQueueEntry = vi.mocked(createEmergencyQueueEntry);
const mockUseMutateEmergencyQueueEntries = vi.mocked(useMutateEmergencyQueueEntries);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockSafeCopyFinanciadorToVisit = vi.mocked(safeCopyFinanciadorToVisit);

describe('EmergencyWorkflowWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      concepts: {
        priorityIConceptUuid: 'priority-i',
        emergencyConceptUuid: 'emergency-priority',
        urgencyConceptUuid: 'urgency-priority',
      },
    } as Config);
    mockUseEmergencyConfig.mockReturnValue({
      emergencyAttentionQueueUuid: 'attention-queue',
      emergencyTriageQueueUuid: 'triage-queue',
      queueStatuses: { inService: 'in-service', waiting: 'waiting', finishedService: 'finished' },
    } as ReturnType<typeof useEmergencyConfig>);
    mockUseMutateEmergencyQueueEntries.mockReturnValue({ mutateEmergencyQueueEntries: vi.fn() });
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({ ok: true } as never);
    mockGetUserFacingErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('handles a failed visit lookup or guard without attempting queue creation', async () => {
    const workflowError = new TypeError('network unavailable');
    mockUseEmergencyVisit.mockReturnValue({
      isCreatingVisit: false,
      checkActiveEmergencyVisit: vi.fn(),
      createEmergencyVisit: vi.fn(),
      getOrCreateEmergencyVisit: vi.fn().mockRejectedValue(workflowError),
    });
    const user = userEvent.setup();
    render(
      <EmergencyWorkflowWorkspace
        closeWorkspace={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        promptBeforeClosing={vi.fn()}
        setTitle={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Queue patient' }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        title: 'Error al crear visita',
        subtitle: 'No se pudo preparar una visita segura para la atención de emergencia.',
        kind: 'error',
      }),
    );
    expect(mockShowSnackbar).toHaveBeenCalledOnce();
    expect(mockCreateEmergencyQueueEntry).not.toHaveBeenCalled();
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
  });
});
