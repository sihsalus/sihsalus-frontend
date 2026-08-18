import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import {
  type Condition,
  createCondition,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import ConditionsForm from './conditions-form.workspace';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

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

const mockCreateCondition = vi.mocked(createCondition);
const mockUpdateCondition = vi.mocked(updateCondition);
const mockUseConditions = vi.mocked(useConditions);
const mockUseConditionsSearch = vi.mocked(useConditionsSearchFromConceptSet);
const mockUseConfig = vi.mocked(useConfig);

const patientUuid = 'patient-1';

const matchingCondition: Condition = {
  id: 'condition-1',
  conceptId: 'concept-asma',
  display: 'Asma',
  clinicalStatus: 'Active',
  onsetDateTime: '2026-01-01T00:00:00.000Z',
  recordedDate: '2026-01-01T00:00:00.000Z',
};

function renderForm(overrides: { condition?: Condition; formContext?: 'creating' | 'editing' } = {}) {
  const closeWorkspace = vi.fn();

  render(
    <ConditionsForm
      closeWorkspace={closeWorkspace as never}
      closeWorkspaceWithSavedChanges={vi.fn()}
      promptBeforeClosing={vi.fn()}
      setTitle={vi.fn()}
      formContext={overrides.formContext ?? 'creating'}
      condition={overrides.condition}
      workspaceProps={{ patientUuid } as never}
    />,
  );

  return { closeWorkspace };
}

describe('ConditionsForm (Salud Materna)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      conditionConceptSets: { antecedentesPatologicos: { uuid: 'set-1' } },
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

  it('al editar muestra el nombre de la condición y envía su concepto real', async () => {
    const user = userEvent.setup();
    renderForm({ condition: matchingCondition, formContext: 'editing' });

    // Regresión: leía conditionToEdit.cells (formato DataTable) y el nombre
    // quedaba vacío, con el PUT saliendo sin display.
    expect(screen.getByText('Asma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save and close|Guardar y Cerrar/i }));

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

    await user.click(screen.getByRole('button', { name: /Save and close|Guardar y Cerrar/i }));

    expect(await screen.findByText(/No se pudo cargar la condición a editar/i)).toBeInTheDocument();
    expect(mockUpdateCondition).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Save and close|Guardar y Cerrar/i })).toBeEnabled();
  });

  it('crea la condición con el concepto seleccionado de la búsqueda', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole('searchbox'), 'Asma');
    await user.click(screen.getByRole('button', { name: 'Asma' }));
    await user.click(screen.getByRole('radio', { name: /^(Active|Activo)$/i }));
    await user.click(screen.getByRole('button', { name: /Save and close|Guardar y Cerrar/i }));

    expect(mockCreateCondition).toHaveBeenCalledTimes(1);
    expect(mockCreateCondition).toHaveBeenCalledWith(
      expect.objectContaining({ conceptId: 'concept-asma', display: 'Asma', patientId: patientUuid }),
    );
  });
});
