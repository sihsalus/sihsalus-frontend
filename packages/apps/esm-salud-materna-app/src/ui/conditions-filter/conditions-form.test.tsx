import { useConfig, useSession } from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import {
  type Condition,
  createCondition,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import ConditionsForm, { createSchema } from './conditions-form.workspace';

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
const mockUseSession = vi.mocked(useSession);

const patientUuid = 'patient-1';

const matchingCondition: Condition = {
  source: {
    uuid: 'condition-1',
    patient: { uuid: 'patient-1' },
    condition: { coded: { uuid: 'concept-asma', display: 'Asma' }, nonCoded: null },
    clinicalStatus: 'ACTIVE',
    onsetDate: '2026-01-01T00:00:00.000Z',
    endDate: null,
    additionalDetail: null,
    auditInfo: { dateCreated: '2026-01-01T00:00:00.000Z' },
    voided: false,
  },
  id: 'condition-1',
  conceptId: 'concept-asma',
  display: 'Asma',
  clinicalStatus: 'Active',
  onsetDateTime: '2026-01-01T00:00:00.000Z',
  recordedDate: '2026-01-01T00:00:00.000Z',
};

function renderForm(overrides: { condition?: Condition; formContext?: 'creating' | 'editing' } = {}) {
  const closeWorkspace = vi.fn();

  const element = () => (
    <ConditionsForm
      closeWorkspace={closeWorkspace as never}
      closeWorkspaceWithSavedChanges={vi.fn()}
      promptBeforeClosing={vi.fn()}
      setTitle={vi.fn()}
      formContext={overrides.formContext ?? 'creating'}
      condition={overrides.condition}
      workspaceProps={{ patientUuid } as never}
    />
  );

  const view = render(element());
  return { closeWorkspace, rerender: () => view.rerender(element()) };
}

describe('ConditionsForm (Salud Materna)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      currentProvider: { uuid: 'provider-1' },
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);
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
    mockUpdateCondition.mockResolvedValue(undefined);
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
      expect.objectContaining({
        conceptId: 'concept-asma',
        display: 'Asma',
        providerUuid: expect.any(String),
        recordedDate: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('al editar sin datos resueltos bloquea el guardado con error visible', async () => {
    mockUseConditions.mockReturnValue({
      conditions: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    renderForm({ condition: matchingCondition, formContext: 'editing' });

    expect(screen.getByRole('alert')).toHaveTextContent(/antecedent data could not be loaded/i);
    expect(screen.queryByRole('button', { name: /Save.*close/i })).not.toBeInTheDocument();
    expect(mockUpdateCondition).not.toHaveBeenCalled();
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
      expect.objectContaining({
        conceptId: 'concept-asma',
        display: 'Asma',
        patientId: patientUuid,
        providerUuid: expect.any(String),
      }),
    );
  });
  it.each([
    'creating',
    'editing',
  ] as const)('keeps an unconfirmed %s write locked without claiming success', async (formContext) => {
    const write = formContext === 'creating' ? mockCreateCondition : mockUpdateCondition;
    write.mockRejectedValueOnce(
      Object.assign(new Error('Synthetic unconfirmed response'), { code: 'CONDITION_WRITE_UNCONFIRMED' }),
    );
    const user = userEvent.setup();
    const { closeWorkspace } = renderForm({
      formContext,
      condition: formContext === 'editing' ? matchingCondition : undefined,
    });
    if (formContext === 'creating') {
      await user.type(screen.getByRole('searchbox'), 'Asma');
      await user.click(screen.getByRole('button', { name: 'Asma' }));
      await user.click(screen.getByRole('radio', { name: 'Active' }));
    }
    const form = screen.getByRole('button', { name: /save.*close/i }).closest('form');
    await user.click(screen.getByRole('button', { name: /save.*close/i }));
    expect(screen.getByRole('button', { name: 'Save unconfirmed' })).toBeDisabled();
    expect(screen.getByText(/The save could not be confirmed.*reload the history/)).toBeInTheDocument();
    expect(screen.queryByText('Antecedent saved')).not.toBeInTheDocument();
    fireEvent.submit(form);
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(closeWorkspace).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('waits for the verified record and initializes edit values after asynchronous loading', async () => {
    const response = {
      conditions: [matchingCondition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    };
    mockUseConditions.mockReturnValue({ ...response, conditions: null, isLoading: true });
    const view = renderForm({ condition: matchingCondition, formContext: 'editing' });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    mockUseConditions.mockReturnValue(response);
    view.rerender();
    expect(await screen.findByRole('radio', { name: 'Active' })).toBeChecked();
    await userEvent.setup().click(screen.getByRole('button', { name: /Save.*close/i }));
    expect(mockUpdateCondition).toHaveBeenCalledExactlyOnceWith(
      'condition-1',
      expect.objectContaining({
        originalCondition: matchingCondition.source,
        clinicalStatus: 'active',
        onsetDateTime: undefined,
      }),
    );
  });

  it('shows a safe read-only explanation for an unsupported historical status', () => {
    const historicalCondition: Condition = {
      ...matchingCondition,
      clinicalStatus: 'History_of',
      source: { ...matchingCondition.source, clinicalStatus: 'HISTORY_OF' },
    };
    mockUseConditions.mockReturnValue({
      conditions: [historicalCondition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderForm({ condition: historicalCondition, formContext: 'editing' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This historical clinical status cannot be edited from this form.',
    );
    expect(screen.queryByRole('button', { name: /save.*close/i })).not.toBeInTheDocument();
    expect(mockUpdateCondition).not.toHaveBeenCalled();
  });

  it('rejects an edit whose original resource belongs to another patient', () => {
    mockUseConditions.mockReturnValue({
      conditions: [
        {
          ...matchingCondition,
          source: { ...matchingCondition.source, patient: { uuid: 'other-synthetic-patient' } },
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    renderForm({ condition: matchingCondition, formContext: 'editing' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockUpdateCondition).not.toHaveBeenCalled();
  });

  it.each([
    { clinicalStatus: '' },
    { abatementDateTime: new Date('2999-01-01') },
    { abatementDateTime: new Date('2025-01-01') },
  ])('rejects invalid clinical values: %j', (invalid) => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    expect(
      createSchema('editing', t).safeParse({
        conditionName: '',
        clinicalStatus: 'inactive',
        onsetDateTime: new Date('2026-01-01'),
        abatementDateTime: null,
        antecedentScope: 'personal',
        personalCategory: 'pathological',
        ...invalid,
      }).success,
    ).toBe(false);
  });
  it('shows a safe search error instead of claiming there are no matching concepts', async () => {
    mockUseConditionsSearch.mockReturnValue({
      searchResults: [],
      conceptSet: null,
      error: new Error('Synthetic private search detail'),
      isSearching: false,
    });
    renderForm();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'Synthetic query');
    expect(screen.getByRole('alert')).toHaveTextContent('Antecedent search is unavailable. Please try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Synthetic private search detail');
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
  });
  it.each(['creating', 'editing'] as const)('accepts the real Workspace2 contract when %s', async (formContext) => {
    const props: PatientWorkspace2DefinitionProps<{
      condition?: Condition;
      formContext: 'creating' | 'editing';
      patientUuid?: string;
    }> = {
      closeWorkspace: vi.fn().mockResolvedValue(true),
      launchChildWorkspace: vi.fn(),
      groupProps: {
        patientUuid: 'patient-1',
        patient: { resourceType: 'Patient', id: 'patient-1' },
        visitContext: null,
        mutateVisitContext: null,
      },
      workspaceProps: { formContext, condition: formContext === 'editing' ? matchingCondition : undefined },
      windowProps: {},
      workspaceName: 'synthetic-workspace',
      windowName: 'synthetic-window',
      isRootWorkspace: true,
      showActionMenu: false,
    };
    const user = userEvent.setup();
    render(<ConditionsForm {...props} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (formContext === 'creating') {
      await user.type(screen.getByRole('searchbox'), 'Asma');
      await user.click(screen.getByRole('button', { name: 'Asma' }));
      await user.click(screen.getByRole('radio', { name: 'Active' }));
    } else {
      expect(screen.getByText('Asma')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    }
    await user.click(screen.getByRole('button', { name: /save.*close/i }));
    if (formContext === 'creating') {
      expect(mockCreateCondition).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ patientId: 'patient-1' }));
      expect(mockUpdateCondition).not.toHaveBeenCalled();
    } else {
      expect(mockUpdateCondition).toHaveBeenCalledExactlyOnceWith(
        matchingCondition.id,
        expect.objectContaining({ patientId: 'patient-1', originalCondition: matchingCondition.source }),
      );
      expect(mockCreateCondition).not.toHaveBeenCalled();
    }
    expect(props.closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  });

  it('rejects a Workspace2 payload whose patient differs from the active group', () => {
    render(
      <ConditionsForm
        closeWorkspace={vi.fn().mockResolvedValue(true)}
        launchChildWorkspace={vi.fn()}
        groupProps={{ patientUuid: 'patient-1', patient: null, visitContext: null, mutateVisitContext: null }}
        workspaceProps={{ formContext: 'creating', patientUuid: 'other-synthetic-patient' }}
        windowProps={{}}
        workspaceName="synthetic-workspace"
        windowName="synthetic-window"
        isRootWorkspace
        showActionMenu={false}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save.*close/i })).not.toBeInTheDocument();
    expect(mockCreateCondition).not.toHaveBeenCalled();
  });
});

it('reports a clinical-status error when a new active antecedent retains an end date', () => {
  const t = ((_key: string, fallback: string) => fallback) as TFunction;
  const result = createSchema('creating', t).safeParse({
    conditionName: 'Synthetic antecedent',
    antecedentType: 'pathological',
    antecedentScope: 'personal',
    personalCategory: 'pathological',
    clinicalStatus: 'active',
    onsetDateTime: new Date('2020-01-01'),
    abatementDateTime: new Date('2021-01-01'),
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ['clinicalStatus'],
        message: 'An active antecedent cannot have an end date. Review its clinical status and end date.',
      }),
    );
  }
});
