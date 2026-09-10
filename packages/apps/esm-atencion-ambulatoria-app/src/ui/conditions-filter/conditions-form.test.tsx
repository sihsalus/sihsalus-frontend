import { getUserFacingErrorMessage, useConfig, useSession } from '@openmrs/esm-framework';
import {
  buildConditionUpdatePatch,
  type DefaultPatientWorkspaceProps,
  launchPatientWorkspace,
  mapConditionProperties,
} from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFunction } from 'i18next';
import {
  type Condition,
  createCondition,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import ConditionsForm, { createSchema } from './conditions-form.workspace';

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
const mockUseSession = vi.mocked(useSession);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);

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

  const element = () => (
    <ConditionsForm
      {...workspaceProps}
      formContext={overrides.formContext ?? 'creating'}
      condition={overrides.condition}
    />
  );

  const view = render(element());
  return { closeWorkspaceWithSavedChanges, rerender: () => view.rerender(element()) };
}

describe('ConditionsForm (antecedentes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      currentProvider: { uuid: 'provider-1' },
      user: { uuid: 'user-1' },
    } as ReturnType<typeof useSession>);
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
    mockUpdateCondition.mockResolvedValue(undefined);
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
      expect.objectContaining({
        conceptId: 'concept-asma',
        display: 'Asma',
        clinicalStatus: 'active',
        providerUuid: expect.any(String),
      }),
    );
    expect(closeWorkspaceWithSavedChanges).toHaveBeenCalled();
  });

  it('records Otro as a native non-coded antecedent without a fallback concept', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('radio', { name: /other|otro/i }));
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveAttribute('maxlength', '255');
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Antecedente sintético narrativo');
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /Save.*close/i }));
    expect(mockCreateCondition).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        conceptId: '',
        nonCodedText: 'Antecedente sintético narrativo',
        antecedentType: 'other',
      }),
    );
  });

  it('edits the status of coded Other without requiring a note or changing its representation', async () => {
    const originalSource = {
      ...matchingCondition.source,
      additionalDetail: '__sihsalus_antecedent_type:other',
    };
    const otherCondition = mapConditionProperties(structuredClone(originalSource));
    mockUseConditions.mockReturnValue({
      conditions: [otherCondition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    const user = userEvent.setup();
    const { closeWorkspaceWithSavedChanges } = renderForm({ condition: otherCondition, formContext: 'editing' });
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveValue('');
    await user.click(screen.getByRole('radio', { name: 'Inactive' }));
    await user.click(screen.getByRole('button', { name: /Save.*close/i }));

    expect(mockUpdateCondition).toHaveBeenCalledExactlyOnceWith(
      otherCondition.id,
      expect.objectContaining({
        originalCondition: originalSource,
        conceptId: matchingCondition.conceptId,
        clinicalStatus: 'inactive',
        note: undefined,
        antecedentType: undefined,
      }),
    );
    const [conditionId, payload] = mockUpdateCondition.mock.calls[0];
    expect(buildConditionUpdatePatch(conditionId, payload)).toEqual({ clinicalStatus: 'INACTIVE' });
    expect(otherCondition.source).toEqual(originalSource);
    expect(mockCreateCondition).not.toHaveBeenCalled();
    expect(closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
  });

  it.each(['', '   '])('requires a description for new narrative Other: %j', (freeText) => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    const result = createSchema('creating', t).safeParse({
      abatementDateTime: null,
      clinicalStatus: 'active',
      conditionName: '',
      onsetDateTime: null,
      antecedentScope: 'personal',
      personalCategory: 'other',
      freeText,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['freeText'], message: 'Required' }));
    }
  });

  it('limits a new native description without rejecting an unchanged long historical narrative', () => {
    const t = ((_key: string, fallback: string) => fallback) as TFunction;
    const data = {
      abatementDateTime: null,
      clinicalStatus: 'active',
      conditionName: '',
      onsetDateTime: null,
      antecedentScope: 'personal',
      personalCategory: 'other',
      freeText: 'x'.repeat(256),
    };
    expect(createSchema('creating', t).safeParse(data).success).toBe(false);
    expect(createSchema('creating', t).safeParse({ ...data, freeText: 'x'.repeat(255) }).success).toBe(true);
  });

  it('edits the status of a native narrative without inventing or changing its concept', async () => {
    const nonCodedText = 'Antecedente sintético narrativo '.repeat(12);
    const narrativeCondition: Condition = {
      ...matchingCondition,
      conceptId: '',
      display: nonCodedText,
      nonCodedText,
      antecedentType: 'other',
      source: {
        ...matchingCondition.source,
        condition: { coded: null, nonCoded: nonCodedText },
      },
    };
    mockUseConditions.mockReturnValue({
      conditions: [narrativeCondition],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    const user = userEvent.setup();
    renderForm({ condition: narrativeCondition, formContext: 'editing' });
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveValue(nonCodedText);
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveAttribute('readonly');
    await user.click(screen.getByRole('radio', { name: 'Inactive' }));
    await user.click(screen.getByRole('button', { name: /Save.*close/i }));
    expect(mockUpdateCondition).toHaveBeenCalledExactlyOnceWith(
      narrativeCondition.id,
      expect.objectContaining({
        originalCondition: narrativeCondition.source,
        conceptId: '',
        clinicalStatus: 'inactive',
        note: undefined,
      }),
    );
  });

  it('al editar muestra el nombre del antecedente y envía su concepto real', async () => {
    const user = userEvent.setup();
    renderForm({ condition: matchingCondition, formContext: 'editing' });

    expect(screen.getByText('Asma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save & close/i }));

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

  it('provides a safe reopen message for an antecedent changed by another editor', async () => {
    mockUpdateCondition.mockRejectedValue(
      Object.assign(new Error('Synthetic server detail must stay private'), { code: 'CONDITION_CHANGED' }),
    );
    renderForm({ condition: matchingCondition, formContext: 'editing' });
    await userEvent.setup().click(screen.getByRole('button', { name: /save.*close/i }));
    expect(getUserFacingErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONDITION_CHANGED' }),
      expect.any(String),
      expect.objectContaining({
        codeMessages: expect.objectContaining({
          CONDITION_CHANGED: 'This antecedent changed. Close this form and reopen it before editing.',
        }),
      }),
    );
    expect(await screen.findByRole('alert')).not.toHaveTextContent('Synthetic server detail');
  });

  it('crea un encounter nuevo al abrir el formulario de antecedente social', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: 'Social' }));
    await user.click(screen.getByRole('button', { name: /Save & close/i }));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        formInfo: expect.objectContaining({
          encounterUuid: '',
          formUuid: 'form-1',
          patientUuid: 'patient-1',
        }),
      }),
    );
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

  it('keeps the original editing snapshot when the history refreshes with another editor changes', async () => {
    const user = userEvent.setup();
    const view = renderForm({ condition: matchingCondition, formContext: 'editing' });
    await user.click(screen.getByRole('radio', { name: 'Inactive' }));
    mockUseConditions.mockReturnValue({
      conditions: [
        {
          ...matchingCondition,
          conceptId: 'synthetic-changed-concept',
          display: 'Synthetic changed display',
          clinicalStatus: 'Resolved',
          abatementDateTime: '2026-02-02T00:00:00.000Z',
          source: {
            ...matchingCondition.source,
            condition: {
              coded: { uuid: 'synthetic-changed-concept', display: 'Synthetic changed display' },
              nonCoded: null,
            },
            clinicalStatus: 'RESOLVED',
            endDate: '2026-02-02T00:00:00.000Z',
          },
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
    view.rerender();
    expect(screen.getByText('Asma')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Inactive' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /save.*close/i }));
    expect(mockUpdateCondition).toHaveBeenCalledExactlyOnceWith(
      matchingCondition.id,
      expect.objectContaining({
        originalCondition: matchingCondition.source,
        conceptId: matchingCondition.conceptId,
        display: matchingCondition.display,
        clinicalStatus: 'inactive',
      }),
    );
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
