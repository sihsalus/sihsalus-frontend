import { useConfig } from '@openmrs/esm-framework';
import type { DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type Condition,
  createCondition,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import ConditionsForm from './conditions-form.workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('./conditions.resource', async () => {
  const actual = await vi.importActual('./conditions.resource');

  return {
    ...actual,
    createCondition: vi.fn(),
    updateCondition: vi.fn(),
    useConditions: vi.fn(),
    useConditionsSearchFromConceptSet: vi.fn(),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    launchPatientWorkspace: vi.fn(),
  };
});

const mockCreateCondition = vi.mocked(createCondition);
const mockUpdateCondition = vi.mocked(updateCondition);
const mockUseConditions = vi.mocked(useConditions);
const mockUseConditionsSearch = vi.mocked(useConditionsSearchFromConceptSet);
const mockUseConfig = vi.mocked(useConfig);

const matchingCondition: Condition = {
  id: 'condition-1',
  conceptId: 'concept-asma',
  display: 'Asma',
  clinicalStatus: 'Active',
  onsetDateTime: '2026-01-01T00:00:00.000Z',
  recordedDate: '2026-01-01T00:00:00.000Z',
  antecedentType: 'pathological',
};

function renderForm(overrides: { condition?: Condition; formContext?: 'creating' | 'editing' } = {}) {
  const closeWorkspaceWithSavedChanges = vi.fn();
  const workspaceProps = {
    closeWorkspace: vi.fn(),
    closeWorkspaceWithSavedChanges,
    promptBeforeClosing: vi.fn(),
    patientUuid: 'patient-1',
    setTitle: vi.fn(),
  } as unknown as DefaultPatientWorkspaceProps;

  render(
    <ConditionsForm
      {...workspaceProps}
      formContext={overrides.formContext ?? 'creating'}
      condition={overrides.condition}
    />,
  );

  return { closeWorkspaceWithSavedChanges };
}

describe('ConditionsForm (antecedentes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      conditionConceptSets: { antecedentesPatologicos: { uuid: 'set-1' } },
      conditionFreeTextFallbackConceptUuid: 'fallback-1',
      clinicalEncounterUuid: 'encounter-type-1',
      formsList: { clinicalEncounterFormUuid: 'form-1' },
    } as unknown as ReturnType<typeof useConfig>);
    mockUseConditions.mockReturnValue({
      conditions: [matchingCondition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseConditionsSearch.mockReturnValue({
      searchResults: [{ uuid: 'concept-asma', display: 'Asma' }],
      conceptSet: null,
      error: undefined,
      isSearching: false,
    });
    mockCreateCondition.mockResolvedValue({} as Awaited<ReturnType<typeof createCondition>>);
    mockUpdateCondition.mockResolvedValue({} as Awaited<ReturnType<typeof updateCondition>>);
  });

  it('bloquea el guardado con error visible si se escribió texto sin elegir un resultado', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /patol[oó]gico|pathological/i }));
    await user.type(screen.getByRole('searchbox'), 'Asma');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /Save & close/i }));

    expect(await screen.findByText(/Seleccione un antecedente de los resultados/i)).toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Save & close/i })).toBeEnabled();
  });

  it('crea el antecedente con el concepto seleccionado de la búsqueda', async () => {
    const user = userEvent.setup();
    const { closeWorkspaceWithSavedChanges } = renderForm();

    await user.click(screen.getByRole('radio', { name: /patol[oó]gico|pathological/i }));
    await user.type(screen.getByRole('searchbox'), 'Asma');
    await user.click(screen.getByRole('button', { name: 'Asma' }));
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /Save & close/i }));

    expect(mockCreateCondition).toHaveBeenCalledTimes(1);
    expect(mockCreateCondition).toHaveBeenCalledWith(
      expect.objectContaining({ conceptId: 'concept-asma', display: 'Asma', clinicalStatus: 'active' }),
    );
    expect(closeWorkspaceWithSavedChanges).toHaveBeenCalled();
  });

  it('al editar muestra el nombre del antecedente y envía su concepto real', async () => {
    const user = userEvent.setup();
    renderForm({ condition: matchingCondition, formContext: 'editing' });

    expect(screen.getByText('Asma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save & close/i }));

    expect(mockUpdateCondition).toHaveBeenCalledTimes(1);
    expect(mockUpdateCondition).toHaveBeenCalledWith(
      'condition-1',
      expect.objectContaining({ conceptId: 'concept-asma', display: 'Asma' }),
    );
  });

  it('al editar sin datos resueltos bloquea el guardado con error visible', async () => {
    const user = userEvent.setup();
    mockUseConditions.mockReturnValue({
      conditions: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderForm({ condition: matchingCondition, formContext: 'editing' });

    await user.click(screen.getByRole('radio', { name: /patol[oó]gico|pathological/i }));
    await user.click(screen.getByRole('button', { name: /Save & close/i }));

    expect(await screen.findByText(/No se pudo cargar el antecedente a editar/i)).toBeInTheDocument();
    expect(mockUpdateCondition).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Save & close/i })).toBeEnabled();
  });
});
