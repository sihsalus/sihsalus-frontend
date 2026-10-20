import { getDefaultsFromConfigSchema, showSnackbar, useConfig, useSession, useVisit } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configSchema } from '../../../config-schema';
import { refreshAdverseReactions, saveAdverseReaction } from './adverse-reaction.resource';
import AdverseReactionFormWorkspace from './adverseReaction.component';

vi.mock('./adverse-reaction.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./adverse-reaction.resource')>()),
  saveAdverseReaction: vi.fn(),
  refreshAdverseReactions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@sihsalus/esm-rbac', () => ({ RequirePrivilege: ({ children }) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key, fallback) => fallback }) }));

const closeWorkspace = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  vi.mocked(useVisit).mockReturnValue({
    activeVisit: {
      uuid: 'synthetic-visit',
      patient: { uuid: 'synthetic-child' },
      startDatetime: '2026-01-02T09:00:00',
      location: { uuid: 'synthetic-location' },
    },
  } as ReturnType<typeof useVisit>);
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    currentProvider: { uuid: 'synthetic-provider' },
  } as never);
  vi.mocked(saveAdverseReaction).mockResolvedValue({} as never);
});

function renderForm() {
  return render(<AdverseReactionFormWorkspace patientUuid="synthetic-child" closeWorkspace={closeWorkspace} />);
}

async function fillVaccineSeverityAndDate() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/Vacuna/), 'BCG');
  await user.selectOptions(screen.getByLabelText(/Severidad/), 'mild');
  fireEvent.change(screen.getByLabelText(/Fecha del reporte/), { target: { value: '2026-01-02' } });
  fireEvent.change(screen.getByLabelText(/Hora del reporte/), { target: { value: '10:30' } });
  return user;
}

it('marks the clinical fields and both report date/time inputs as required', () => {
  renderForm();
  for (const label of [
    'Vacuna *',
    'Descripción de la reacción *',
    'Severidad *',
    'Fecha del reporte *',
    'Hora del reporte (24 horas) *',
  ]) {
    expect(screen.getByText(label)).toBeVisible();
  }
  expect(screen.getByText('Fields marked with * are required.')).toBeVisible();
  expect(screen.getByLabelText(/Descripción de la reacción/)).toBeRequired();
});

it('explains that the description is missing without saving or losing entered values', async () => {
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  expect(await screen.findByText('Debe ingresar una descripción de la reacción')).toBeVisible();
  expect(saveAdverseReaction).not.toHaveBeenCalled();
  expect(closeWorkspace).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Vacuna/)).toHaveValue('BCG');
});

it('saves after the clinical fields and report date/time are completed', async () => {
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Synthetic reaction');
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  await waitFor(() =>
    expect(saveAdverseReaction).toHaveBeenCalledWith(
      expect.objectContaining({
        patientUuid: 'synthetic-child',
        vaccineName: 'BCG',
        severity: 'mild',
        reactionDescription: 'Synthetic reaction',
        reportDatetime: new Date(2026, 0, 2, 10, 30),
      }),
    ),
  );
  expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  expect(refreshAdverseReactions).toHaveBeenCalledOnce();
});

it('keeps the form open and hides backend details after a failed save', async () => {
  vi.mocked(saveAdverseReaction).mockRejectedValue(new Error('private backend details'));
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Synthetic reaction');
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  await waitFor(() =>
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'The adverse reaction could not be confirmed as saved. Review the history before trying again.',
      }),
    ),
  );
  expect(closeWorkspace).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Descripción de la reacción/)).toHaveValue('Synthetic reaction');
  expect(refreshAdverseReactions).not.toHaveBeenCalled();
});

it.each(['missing-provider', 'missing-visit', 'another-patient', 'closed-visit'])(
  'keeps the clinical event unsaved when context is invalid: %s',
  async (condition) => {
    if (condition === 'missing-provider') {
      vi.mocked(useSession).mockReturnValue({ authenticated: true, user: { uuid: 'synthetic-user' } } as never);
    } else {
      vi.mocked(useVisit).mockReturnValue({
        activeVisit: {
          uuid: condition === 'missing-visit' ? undefined : 'synthetic-visit',
          patient: { uuid: condition === 'another-patient' ? 'other-child' : 'synthetic-child' },
          location: { uuid: 'synthetic-location' },
          stopDatetime: condition === 'closed-visit' ? '2026-01-01T00:00:00Z' : null,
        },
      } as ReturnType<typeof useVisit>);
    }
    renderForm();
    const user = await fillVaccineSeverityAndDate();
    await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Synthetic reaction');
    await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
    expect(saveAdverseReaction).not.toHaveBeenCalled();
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Descripción de la reacción/)).toHaveValue('Synthetic reaction');
    expect(
      await screen.findByText(
        condition === 'missing-provider'
          ? 'Your session must be linked to a clinical provider to record the event.'
          : 'Se requiere una visita activa con una UPSS asistencial',
      ),
    ).toBeVisible();
  },
);

it.each([
  ['2026-01-02', '00:00'],
  ['2026-01-01', '10:30'],
  ['2099-01-02', '10:30'],
])('rejects a report outside the open visit: %s %s', async (date, time) => {
  vi.mocked(useVisit).mockReturnValue({
    activeVisit: {
      uuid: 'synthetic-visit',
      patient: { uuid: 'synthetic-child' },
      location: { uuid: 'synthetic-location' },
      startDatetime: '2026-01-02T10:00:00',
      stopDatetime: null,
    },
  } as ReturnType<typeof useVisit>);
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Event began yesterday; reported today.');
  fireEvent.change(screen.getByLabelText(/Fecha del reporte/), { target: { value: date } });
  fireEvent.change(screen.getByLabelText(/Hora del reporte/), { target: { value: time } });
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  expect(
    await screen.findByText(
      'La fecha y hora del reporte debe estar dentro de la visita abierta y no puede ser futura.',
    ),
  ).toBeVisible();
  expect(saveAdverseReaction).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Hora del reporte/)).toHaveValue(time);
});
it('saves the explicit 10:30 report for a visit that started at 10:00 without changing event narrative', async () => {
  vi.mocked(useVisit).mockReturnValue({
    activeVisit: {
      uuid: 'synthetic-visit',
      patient: { uuid: 'synthetic-child' },
      location: { uuid: 'synthetic-location' },
      startDatetime: '2026-01-02T10:00:00',
      stopDatetime: null,
    },
  } as ReturnType<typeof useVisit>);
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Event began yesterday; reported today.');
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  await waitFor(() =>
    expect(saveAdverseReaction).toHaveBeenCalledWith(
      expect.objectContaining({
        reportDatetime: new Date(2026, 0, 2, 10, 30),
        reactionDescription: 'Event began yesterday; reported today.',
        visitUuid: 'synthetic-visit',
        providerUuid: 'synthetic-provider',
      }),
    ),
  );
});
it('keeps a cleared report time empty and does not silently replace it with the current time', async () => {
  renderForm();
  const user = await fillVaccineSeverityAndDate();
  await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Synthetic reaction');
  await user.clear(screen.getByLabelText(/Hora del reporte/));
  await user.click(screen.getByRole('button', { name: 'Registrar Reacción' }));
  expect(await screen.findByText('Ingrese la hora del reporte en formato de 24 horas (HH:mm).')).toBeVisible();
  expect(screen.getByLabelText(/Hora del reporte/)).toHaveValue('');
  expect(saveAdverseReaction).not.toHaveBeenCalled();
});
