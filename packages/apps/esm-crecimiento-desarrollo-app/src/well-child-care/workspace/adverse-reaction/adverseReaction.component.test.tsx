import { showSnackbar, useConfig, useVisit } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAdverseReaction } from './adverse-reaction.resource';
import AdverseReactionFormWorkspace from './adverseReaction.component';

vi.mock('./adverse-reaction.resource', () => ({ saveAdverseReaction: vi.fn() }));
vi.mock('@sihsalus/esm-rbac', () => ({ RequirePrivilege: ({ children }) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key, fallback) => fallback }) }));

const closeWorkspace = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({});
  vi.mocked(useVisit).mockReturnValue({
    activeVisit: { uuid: 'synthetic-visit', location: { uuid: 'synthetic-location' } },
  } as ReturnType<typeof useVisit>);
  vi.mocked(saveAdverseReaction).mockResolvedValue({} as never);
});

function renderForm() {
  return render(<AdverseReactionFormWorkspace patientUuid="synthetic-child" closeWorkspace={closeWorkspace} />);
}

async function fillVaccineSeverityAndDate() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/Vacuna/), 'BCG');
  await user.selectOptions(screen.getByLabelText(/Severidad/), 'mild');
  fireEvent.change(screen.getByLabelText(/Fecha de ocurrencia/), { target: { value: '2026-01-02' } });
  return user;
}

it('marks all four fields as required', () => {
  renderForm();
  for (const label of ['Vacuna *', 'Descripción de la reacción *', 'Severidad *', 'Fecha de ocurrencia del evento *']) {
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

it('saves after the four required fields are completed', async () => {
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
        occurrenceDate: expect.any(Date),
      }),
    ),
  );
  expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
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
});
