import { launchWorkspace2, useConfig, usePatient, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useEncountersCRED from '../../../hooks/useEncountersCRED';
import CREDControlsWorkspace from './well-child-controls-form.workspace';

vi.mock('../../../hooks/useEncountersCRED');
vi.mock('../../../hooks/useAgeGroups', () => ({
  useAgeGroups: () => ({
    getAgeGroupForForms: () => ({ label: 'Synthetic age group' }),
  }),
}));
vi.mock('../../../hooks/useCREDFormsForAgeGroup', () => ({
  useCREDFormsForAgeGroup: () => [],
}));
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }) => children,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({});
  vi.mocked(usePatient).mockReturnValue({
    patient: {
      resourceType: 'Patient',
      id: 'synthetic-child',
      birthDate: '2026-09-01',
    },
    patientUuid: 'synthetic-child',
    isLoading: false,
    error: null,
  });
  vi.mocked(useVisit).mockReturnValue({
    currentVisit: {
      uuid: 'synthetic-visit',
      startDatetime: '2026-09-01T00:00:00Z',
    },
  } as ReturnType<typeof useVisit>);
  vi.mocked(useEncountersCRED).mockReturnValue({
    encounters: [],
    error: null,
    controlNumberError: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

function renderWorkspace() {
  return render(<CREDControlsWorkspace patientUuid="synthetic-child" closeWorkspace={vi.fn()} />);
}

it.each([
  'patient',
  'encounters',
  'controlNumbers',
] as const)('does not start a control when %s failed to load', (source) => {
  const error = new Error('Synthetic internal read failure');
  if (source === 'patient')
    vi.mocked(usePatient).mockReturnValue({
      ...usePatient('synthetic-child'),
      error,
    });
  else
    vi.mocked(useEncountersCRED).mockReturnValue({
      ...useEncountersCRED('synthetic-child'),
      [source === 'encounters' ? 'error' : 'controlNumberError']: error,
    });
  renderWorkspace();
  expect(screen.queryByRole('button', { name: 'Empezar Control' })).not.toBeInTheDocument();
  expect(screen.getByText('Selección de Formularios Crecimiento y Desarrollo')).toBeVisible();
  expect(screen.queryByText(error.message)).not.toBeInTheDocument();
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

it('retries the history before allowing the user to continue', async () => {
  const mutate = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useEncountersCRED).mockReturnValue({
    ...useEncountersCRED('synthetic-child'),
    controlNumberError: new Error('Synthetic failure'),
    mutate,
  });
  const { rerender } = renderWorkspace();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(mutate).toHaveBeenCalledOnce();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  vi.mocked(useEncountersCRED).mockReturnValue({
    ...useEncountersCRED('synthetic-child'),
    controlNumberError: null,
  });
  rerender(<CREDControlsWorkspace patientUuid="synthetic-child" closeWorkspace={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Empezar Control' })).toBeEnabled();
});

it('preserves the entered time across a failed history refresh', async () => {
  const { rerender } = renderWorkspace();
  const time = screen.getByLabelText('Start time');
  await userEvent.clear(time);
  expect(time).toHaveValue('');
  await userEvent.type(time, '09:30');
  expect(time).toHaveValue('09:30');
  vi.mocked(useEncountersCRED).mockReturnValue({
    ...useEncountersCRED('synthetic-child'),
    error: new Error('Synthetic refresh failure'),
  });
  rerender(<CREDControlsWorkspace patientUuid="synthetic-child" closeWorkspace={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Empezar Control' })).not.toBeInTheDocument();
  vi.mocked(useEncountersCRED).mockReturnValue({ ...useEncountersCRED('synthetic-child'), error: null });
  rerender(<CREDControlsWorkspace patientUuid="synthetic-child" closeWorkspace={vi.fn()} />);
  expect(screen.getByLabelText('Start time')).toHaveValue('09:30');
});
