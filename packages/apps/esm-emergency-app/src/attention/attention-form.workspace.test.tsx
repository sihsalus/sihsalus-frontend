import { getDefaultsFromConfigSchema, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Config, configSchema } from '../config-schema';
import {
  assertEmergencyQueueEntryActive,
  type EmergencyQueueEntry,
  EmergencyQueueEntryInactiveError,
  endEmergencyQueueEntry,
} from '../resources/emergency.resource';
import {
  AttentionEncounterVerificationError,
  createAttentionEncounter,
  verifyAttentionEncounter,
} from './attention-form.resource';
import AttentionFormWorkspace from './attention-form.workspace';

vi.mock('../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../resources/emergency.resource')),
  assertEmergencyQueueEntryActive: vi.fn(),
  endEmergencyQueueEntry: vi.fn(),
}));

vi.mock('./attention-form.resource', async () => ({
  ...(await vi.importActual('./attention-form.resource')),
  createAttentionEncounter: vi.fn(),
  verifyAttentionEncounter: vi.fn(),
}));

vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  mutate: vi.fn(),
}));

const mockCreateAttentionEncounter = vi.mocked(createAttentionEncounter);
const mockVerifyAttentionEncounter = vi.mocked(verifyAttentionEncounter);
const mockAssertEmergencyQueueEntryActive = vi.mocked(assertEmergencyQueueEntryActive);
const mockEndEmergencyQueueEntry = vi.mocked(endEmergencyQueueEntry);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);
const workspaceProps = {
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

const config: Config = {
  ...(getDefaultsFromConfigSchema(configSchema) as Config),
  emergencyLocationUuid: 'emergency-location-uuid',
  attentionEncounter: {
    encounterTypeUuid: 'attention-encounter-type-uuid',
    concepts: {
      diagnosisUuid: 'diagnosis-concept-uuid',
      treatmentUuid: 'treatment-concept-uuid',
      auxiliaryExamsUuid: 'auxiliary-exams-concept-uuid',
    },
  },
};

const queueEntry = {
  uuid: 'queue-entry-uuid',
  patient: {
    uuid: 'patient-uuid',
    display: 'Paciente de prueba',
    person: {
      uuid: 'person-uuid',
      display: 'Paciente de prueba',
      gender: 'F',
      age: 35,
      birthdate: '1991-01-01',
    },
    identifiers: [],
  },
  priority: { uuid: 'priority-uuid', display: 'Prioridad II' },
  status: { uuid: 'in-service-status-uuid', display: 'En atención' },
  queue: { uuid: 'attention-queue-uuid', display: 'Atención' },
  visit: {
    uuid: 'visit-uuid',
    display: 'Consulta de emergencia',
    startDatetime: '2026-07-15T12:00:00.000Z',
  },
  startedAt: '2026-07-15T12:00:00.000Z',
  sortWeight: 2,
} satisfies EmergencyQueueEntry;

async function fillAndSubmitAttention() {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Diagnóstico(s) del paciente' }), 'Neumonía');
  await user.type(screen.getByRole('textbox', { name: 'Plan de tratamiento' }), 'Antibiótico y control');
  await user.click(screen.getByRole('button', { name: 'Guardar atención' }));
  return user;
}

describe('AttentionFormWorkspace save reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseConfig.mockReturnValue(config);
    mockAssertEmergencyQueueEntryActive.mockResolvedValue({ data: { uuid: queueEntry.uuid } } as Awaited<
      ReturnType<typeof assertEmergencyQueueEntryActive>
    >);
    mockCreateAttentionEncounter.mockResolvedValue({ data: { uuid: 'encounter-uuid' } } as Awaited<
      ReturnType<typeof createAttentionEncounter>
    >);
    mockVerifyAttentionEncounter.mockResolvedValue({ data: { uuid: 'encounter-uuid' } } as Awaited<
      ReturnType<typeof verifyAttentionEncounter>
    >);
    mockEndEmergencyQueueEntry.mockResolvedValue({ status: 200 } as Awaited<ReturnType<typeof endEmergencyQueueEntry>>);
  });

  it('retries only the queue update after the clinical encounter was saved', async () => {
    const closeWorkspace = vi.fn();
    mockEndEmergencyQueueEntry.mockRejectedValueOnce(new Error('POST /ws/rest/v1/queue-entry returned SQLSTATE 40001'));

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={closeWorkspace} />);
    const user = await fillAndSubmitAttention();

    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledOnce());
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'La atención clínica fue guardada, pero no se pudo actualizar la cola. Verifique su estado antes de reintentar.',
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Diagnóstico(s) del paciente' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Plan de tratamiento' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Verificar atención y cerrar cola' }));

    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledTimes(2));
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(mockVerifyAttentionEncounter).toHaveBeenCalledTimes(2);
    expect(closeWorkspace).toHaveBeenCalledOnce();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });

  it('blocks a blind retry when encounter persistence is ambiguous', async () => {
    mockCreateAttentionEncounter.mockRejectedValue(
      new Error('POST /ws/rest/v1/encounter timed out after SQLSTATE 57014'),
    );

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    await fillAndSubmitAttention();

    expect(
      await screen.findByText(
        'No se pudo confirmar si la atención clínica fue guardada. Revise la historia del paciente antes de repetir la acción.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar atención' })).toBeDisabled();
    expect(mockEndEmergencyQueueEntry).not.toHaveBeenCalled();
    expect(screen.queryByText(/SQLSTATE|\/ws\/rest/u)).not.toBeInTheDocument();
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });

  it('keeps an ambiguous-create checkpoint blocked after remount', async () => {
    mockCreateAttentionEncounter.mockRejectedValueOnce(new Error('network response lost after POST'));
    const firstRender = render(
      <AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />,
    );
    await fillAndSubmitAttention();
    expect(await screen.findByText('Verifique el registro clínico antes de continuar')).toBeInTheDocument();
    firstRender.unmount();

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    expect(await screen.findByText('Verifique el registro clínico antes de continuar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar atención' })).toBeDisabled();
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
  });

  it('treats a create response without an encounter UUID as unverified', async () => {
    mockCreateAttentionEncounter.mockResolvedValue({ data: {} } as Awaited<
      ReturnType<typeof createAttentionEncounter>
    >);

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    await fillAndSubmitAttention();

    expect(
      await screen.findByText(
        'No se pudo confirmar si la atención clínica fue guardada. Revise la historia del paciente antes de repetir la acción.',
      ),
    ).toBeInTheDocument();
    expect(mockEndEmergencyQueueEntry).not.toHaveBeenCalled();
  });

  it('keeps a saved-encounter checkpoint across unmount and never posts it again', async () => {
    mockEndEmergencyQueueEntry.mockRejectedValueOnce(new Error('queue close response lost'));
    const firstCloseWorkspace = vi.fn();
    const firstRender = render(
      <AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={firstCloseWorkspace} />,
    );
    await fillAndSubmitAttention();
    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledOnce());
    firstRender.unmount();

    const secondCloseWorkspace = vi.fn();
    const user = userEvent.setup();
    render(
      <AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={secondCloseWorkspace} />,
    );

    expect(screen.getByText('Atención pendiente de conciliación')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Diagnóstico(s) del paciente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Verificar atención y cerrar cola' }));

    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledTimes(2));
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(mockVerifyAttentionEncounter).toHaveBeenCalledTimes(2);
    expect(secondCloseWorkspace).toHaveBeenCalledOnce();
  });

  it('uses a synchronous mutex to ignore a second submit while create is pending', async () => {
    let resolveCreate: (value: Awaited<ReturnType<typeof createAttentionEncounter>>) => void = () => undefined;
    mockCreateAttentionEncounter.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico(s) del paciente' }), 'Neumonía');
    await user.type(screen.getByRole('textbox', { name: 'Plan de tratamiento' }), 'Antibiótico y control');
    const form = screen.getByRole('button', { name: 'Guardar atención' }).closest('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);
    await waitFor(() => expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce());
    resolveCreate({ data: { uuid: 'encounter-uuid' } } as Awaited<ReturnType<typeof createAttentionEncounter>>);

    await waitFor(() => expect(mockEndEmergencyQueueEntry).toHaveBeenCalledOnce());
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
  });

  it('does not create an encounter when the queue entry is already inactive', async () => {
    mockAssertEmergencyQueueEntryActive.mockRejectedValueOnce(new EmergencyQueueEntryInactiveError());

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    await fillAndSubmitAttention();

    expect(await screen.findByText('La entrada de cola cambió')).toBeInTheDocument();
    expect(mockCreateAttentionEncounter).not.toHaveBeenCalled();
    expect(mockEndEmergencyQueueEntry).not.toHaveBeenCalled();
  });

  it('allows a corrected retry after an explicit 400 rejection', async () => {
    mockCreateAttentionEncounter.mockRejectedValueOnce({
      response: { status: 400 },
      message: 'SQLSTATE 23514 /ws/rest/v1/encounter',
    });

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    const user = await fillAndSubmitAttention();

    await waitFor(() => expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce());
    const saveButton = screen.getByRole('button', { name: 'Guardar atención' });
    expect(saveButton).toBeEnabled();
    expect(screen.queryByText('Verifique el registro clínico antes de continuar')).not.toBeInTheDocument();
    expect(mockShowSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        subtitle:
          'El servidor rechazó el registro y no confirmó una atención nueva. Revise los datos y permisos antes de reintentar.',
      }),
    );
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );

    mockCreateAttentionEncounter.mockResolvedValueOnce({ data: { uuid: 'encounter-uuid' } } as Awaited<
      ReturnType<typeof createAttentionEncounter>
    >);
    await user.click(saveButton);
    await waitFor(() => expect(mockCreateAttentionEncounter).toHaveBeenCalledTimes(2));
  });

  it('never closes the queue when the returned encounter identity does not match', async () => {
    mockVerifyAttentionEncounter.mockRejectedValue(new AttentionEncounterVerificationError());

    render(<AttentionFormWorkspace {...workspaceProps} queueEntry={queueEntry} closeWorkspace={vi.fn()} />);
    const user = await fillAndSubmitAttention();

    expect(await screen.findByText('Atención pendiente de conciliación')).toBeInTheDocument();
    expect(mockEndEmergencyQueueEntry).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Verificar atención y cerrar cola' }));
    await waitFor(() => expect(mockVerifyAttentionEncounter).toHaveBeenCalledTimes(2));
    expect(mockCreateAttentionEncounter).toHaveBeenCalledOnce();
    expect(mockEndEmergencyQueueEntry).not.toHaveBeenCalled();
  });
});
