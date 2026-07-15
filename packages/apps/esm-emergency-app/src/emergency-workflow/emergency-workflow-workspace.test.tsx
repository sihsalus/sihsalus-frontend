import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Config } from '../config-schema';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import {
  createEmergencyQueueEntry,
  EmergencyQueueEntryCreationRejectedError,
  reconcileEmergencyQueueEntryCreation,
} from '../resources/emergency.resource';
import EmergencyWorkflowWorkspace from './emergency-workflow-workspace';
import { useEmergencyVisit } from './hooks/useEmergencyVisit';

vi.mock('../hooks/usePriorityConfig', () => ({
  useEmergencyConfig: vi.fn(),
}));

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  createEmergencyQueueEntry: vi.fn(),
  reconcileEmergencyQueueEntryCreation: vi.fn(),
}));

vi.mock('./hooks/useEmergencyVisit', () => ({
  useEmergencyVisit: vi.fn(),
}));

vi.mock('./patient-search-registration.component', () => ({
  default: ({ onPatientQueued, submissionBlocked }) => (
    <button
      type="button"
      disabled={submissionBlocked}
      onClick={() =>
        onPatientQueued(
          'patient-uuid',
          {
            uuid: 'patient-uuid',
            display: 'Paciente de prueba',
            identifiers: [],
            person: { display: 'Paciente de prueba', gender: 'F' },
          },
          'emergency',
        )
      }
    >
      Enviar paciente de prueba
    </button>
  ),
}));

const mockCreateEmergencyQueueEntry = vi.mocked(createEmergencyQueueEntry);
const mockReconcileEmergencyQueueEntryCreation = vi.mocked(reconcileEmergencyQueueEntryCreation);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseEmergencyConfig = vi.mocked(useEmergencyConfig);
const mockUseEmergencyVisit = vi.mocked(useEmergencyVisit);
const mockGetOrCreateEmergencyVisit = vi.fn();
const workspaceProps = {
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

describe('EmergencyWorkflowWorkspace queue failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseConfig.mockReturnValue({
      concepts: {
        priorityIConceptUuid: 'priority-i-uuid',
        emergencyConceptUuid: 'emergency-concept-uuid',
        urgencyConceptUuid: 'urgency-concept-uuid',
      },
    } as Config);
    mockUseEmergencyConfig.mockReturnValue({
      emergencyAttentionQueueUuid: 'attention-queue-uuid',
      emergencyTriageQueueUuid: 'triage-queue-uuid',
      queueStatuses: { inService: 'in-service-uuid', waiting: 'waiting-uuid' },
    } as ReturnType<typeof useEmergencyConfig>);
    mockGetOrCreateEmergencyVisit.mockResolvedValue('visit-uuid');
    mockUseEmergencyVisit.mockReturnValue({
      getOrCreateEmergencyVisit: mockGetOrCreateEmergencyVisit,
    } as unknown as ReturnType<typeof useEmergencyVisit>);
    mockReconcileEmergencyQueueEntryCreation.mockResolvedValue(null);
  });

  it('does not expose backend details when queue entry creation is ambiguous', async () => {
    const user = userEvent.setup();
    mockCreateEmergencyQueueEntry.mockRejectedValue(
      new Error('POST /ws/rest/v1/visit-queue-entry returned SQLSTATE 40001'),
    );

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enviar paciente de prueba' }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle:
            'No se pudo confirmar el ingreso del paciente a la cola. Revise la cola y no vuelva a enviarlo hasta verificar su estado.',
        }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeDisabled();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });

  it('does not declare success for a 2xx response without a verified queue UUID', async () => {
    const user = userEvent.setup();
    mockCreateEmergencyQueueEntry.mockResolvedValue({ data: {} } as Awaited<
      ReturnType<typeof createEmergencyQueueEntry>
    >);

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enviar paciente de prueba' }));

    expect(await screen.findByText('Ingreso a cola pendiente de verificación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeDisabled();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('keeps an ambiguous queue submission blocked after remount', async () => {
    const user = userEvent.setup();
    mockCreateEmergencyQueueEntry.mockRejectedValueOnce(new Error('network response lost'));
    const firstRender = render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enviar paciente de prueba' }));
    expect(await screen.findByText('Ingreso a cola pendiente de verificación')).toBeInTheDocument();
    firstRender.unmount();

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    expect(await screen.findByText('Ingreso a cola pendiente de verificación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeDisabled();
    expect(mockCreateEmergencyQueueEntry).toHaveBeenCalledOnce();
    expect(mockReconcileEmergencyQueueEntryCreation).toHaveBeenCalledOnce();
  });

  it('automatically reconciles a persisted pending submission when the exact entry exists', async () => {
    sessionStorage.setItem(
      'openmrs:emergency-queue-submission:v1',
      JSON.stringify({
        version: 1,
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        priorityUuid: 'priority-i-uuid',
        statusUuid: 'in-service-uuid',
        queueUuid: 'attention-queue-uuid',
      }),
    );
    mockReconcileEmergencyQueueEntryCreation.mockResolvedValueOnce({ data: { uuid: 'queue-entry-uuid' } } as Awaited<
      ReturnType<typeof reconcileEmergencyQueueEntryCreation>
    >);

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeEnabled());
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Ingreso a cola confirmado' }),
    );
    expect(sessionStorage.getItem('openmrs:emergency-queue-submission:v1')).toBeNull();
  });

  it('removes a stale block only after two valid empty reconciliations', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'openmrs:emergency-queue-submission:v1',
      JSON.stringify({
        version: 1,
        patientUuid: 'patient-uuid',
        visitUuid: 'visit-uuid',
        priorityUuid: 'priority-i-uuid',
        statusUuid: 'in-service-uuid',
        queueUuid: 'attention-queue-uuid',
      }),
    );

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar que no existe ingreso' })).toBeInTheDocument(),
    );
    expect(mockReconcileEmergencyQueueEntryCreation).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Confirmar que no existe ingreso' }));

    await waitFor(() => expect(mockReconcileEmergencyQueueEntryCreation).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeEnabled();
    expect(sessionStorage.getItem('openmrs:emergency-queue-submission:v1')).toBeNull();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'No se encontró un ingreso pendiente' }),
    );
  });

  it('allows retry after an explicit 400 rejection with no ambiguous write', async () => {
    const user = userEvent.setup();
    mockCreateEmergencyQueueEntry.mockRejectedValueOnce(
      new EmergencyQueueEntryCreationRejectedError({
        response: { status: 400 },
        message: 'SQLSTATE 23514 /ws/rest/v1/visit-queue-entry',
      }),
    );

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enviar paciente de prueba' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeEnabled());
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'El servidor rechazó el ingreso y no confirmó una entrada nueva. Revise los datos y permisos antes de reintentar.',
      }),
    );
    expect(sessionStorage.getItem('openmrs:emergency-queue-submission:v1')).toBeNull();
  });

  it('keeps the checkpoint when post-write verification fails with a 4xx read', async () => {
    const user = userEvent.setup();
    mockCreateEmergencyQueueEntry.mockRejectedValueOnce({
      response: { status: 403 },
      message: 'GET verification failed after POST success',
    });

    render(<EmergencyWorkflowWorkspace {...workspaceProps} closeWorkspace={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enviar paciente de prueba' }));

    expect(await screen.findByText('Ingreso a cola pendiente de verificación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar paciente de prueba' })).toBeDisabled();
    expect(sessionStorage.getItem('openmrs:emergency-queue-submission:v1')).not.toBeNull();
  });
});
