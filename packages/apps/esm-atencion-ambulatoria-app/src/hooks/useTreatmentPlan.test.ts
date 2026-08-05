import { renderHook } from '@testing-library/react';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useTreatmentPlan } from './useTreatmentPlan';

vi.mock('./useClinicalHistoryPagination', () => ({
  useMergedClinicalHistoryPagination: vi.fn(),
  toEncounterTypeSources: (value: string | Array<string | Record<string, string>> | undefined | null) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((source) => (typeof source === 'string' ? { encounterTypeUuid: source } : source)),
}));

const LEGACY_ENCOUNTER_NOTE_UUID = '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const THERAPEUTIC_INDICATIONS_UUID = 'b762afd0-dfc6-430d-8963-0be05f77a12a';

interface ObsFixture {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | null;
  formFieldPath?: string;
}

interface EncounterFixture {
  uuid: string;
  encounterDatetime: string;
  form?: { uuid: string };
  encounterProviders: Array<{ display: string }>;
  obs: ObsFixture[];
}

const mockUseClinicalHistoryPagination = vi.mocked(useMergedClinicalHistoryPagination<EncounterFixture>);

function obs(conceptUuid: string, value: string, formFieldPath?: string): ObsFixture {
  return {
    uuid: `obs-${formFieldPath ?? conceptUuid}`,
    concept: { uuid: conceptUuid, display: conceptUuid },
    value,
    ...(formFieldPath ? { formFieldPath } : {}),
  };
}

function renderWithObs(
  encounterObs: ObsFixture[],
  concepts: Record<string, string> = { therapeuticIndicationsUuid: THERAPEUTIC_INDICATIONS_UUID },
  legacyFieldPaths: Record<string, string> = {},
  encounterFormUuid?: string,
  encounterType: string | Array<string | { encounterTypeUuid: string; formUuid?: string }> = 'external-consultation',
) {
  mockUseClinicalHistoryPagination.mockReturnValue({
    data: [
      {
        uuid: 'encounter-1',
        encounterDatetime: '2026-08-05T10:00:00.000Z',
        ...(encounterFormUuid ? { form: { uuid: encounterFormUuid } } : {}),
        encounterProviders: [{ display: 'Dra. Perez - Clinician' }],
        obs: encounterObs,
      },
    ],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
  });

  return renderHook(() => useTreatmentPlan('patient-uuid', encounterType, concepts, legacyFieldPaths));
}

describe('useTreatmentPlan therapeutic indications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads indications recorded under the dedicated concept', () => {
    const { result } = renderWithObs([
      obs(THERAPEUTIC_INDICATIONS_UUID, 'Reposo relativo por 48 horas', 'rfe-forms-indicacionesTerapeuticas'),
    ]);

    expect(result.current.treatmentPlans[0].therapeuticIndications).toBe('Reposo relativo por 48 horas');
  });

  it('keeps reading indications recorded under the legacy encounter-note concept', () => {
    const { result } = renderWithObs([
      obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Paracetamol condicional a fiebre', 'rfe-forms-indicacionesTerapeuticas'),
    ]);

    expect(result.current.treatmentPlans[0].therapeuticIndications).toBe('Paracetamol condicional a fiebre');
  });

  it('keeps reading legacy indications recorded without a form field path', () => {
    const { result } = renderWithObs([obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Control en 7 días')]);

    expect(result.current.treatmentPlans[0].therapeuticIndications).toBe('Control en 7 días');
  });

  it('keeps a legacy procedure-only encounter in the treatment history', () => {
    const procedureObs = obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Curación de herida', 'procedures');
    const { result } = renderWithObs([procedureObs]);
    const isRelevant = mockUseClinicalHistoryPagination.mock.calls.at(-1)?.[1];

    expect(result.current.treatmentPlans[0].procedures).toBe('Curación de herida');
    expect(
      isRelevant?.({
        uuid: 'procedure-only',
        encounterDatetime: '2026-08-05T10:00:00.000Z',
        encounterProviders: [],
        obs: [procedureObs],
      }),
    ).toBe(true);
  });

  it('never reports the free-text diagnosis as therapeutic indications', () => {
    // Both fields shared the legacy concept, so matching it by concept alone would
    // surface the diagnosis in the treatment plan.
    const { result } = renderWithObs([
      obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Faringitis aguda', 'rfe-forms-diagnosticoPrincipal'),
    ]);

    expect(result.current.treatmentPlans).toHaveLength(0);
  });

  it('never reports a pathless Visit Note narrative as therapeutic indications', () => {
    const visitNoteFormUuid = 'c75f120a-04ec-11e3-8780-2b40bef9a44b';
    const { result } = renderWithObs(
      [obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Nota clínica narrativa')],
      {},
      {},
      visitNoteFormUuid,
      [{ encounterTypeUuid: 'visit-note', formUuid: visitNoteFormUuid }],
    );
    const isRelevant = mockUseClinicalHistoryPagination.mock.calls.at(-1)?.[1];

    expect(result.current.treatmentPlans).toHaveLength(0);
    expect(
      isRelevant?.({
        uuid: 'visit-note-clinical-note',
        encounterDatetime: '2026-08-05T10:00:00.000Z',
        form: { uuid: visitNoteFormUuid },
        encounterProviders: [],
        obs: [obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Nota clínica narrativa')],
      }),
    ).toBe(false);
  });

  it('prefers the dedicated concept over a legacy value in the same encounter', () => {
    const { result } = renderWithObs([
      obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Indicación antigua', 'rfe-forms-indicacionesTerapeuticas'),
      obs(THERAPEUTIC_INDICATIONS_UUID, 'Indicación vigente', 'rfe-forms-indicacionesTerapeuticas'),
    ]);

    expect(result.current.treatmentPlans[0].therapeuticIndications).toBe('Indicación vigente');
  });

  it('reads every plan field written by the published CE-001 form', () => {
    const { result } = renderWithObs(
      [
        obs('f0000204-0000-4000-8000-000000000204', 'Hemograma', 'rfe-forms-ordenesLaboratorio'),
        obs('f0000206-0000-4000-8000-000000000206', 'Curación', 'rfe-forms-procedimientos'),
        obs('f0000215-0000-4000-8000-000000000215', 'Paracetamol', 'rfe-forms-prescripciones'),
        obs('f0000205-0000-4000-8000-000000000205', 'Cardiología', 'rfe-forms-referencia'),
        obs('f0000004-0000-4000-8000-000000000004', '2026-08-12', 'rfe-forms-proximaCita'),
      ],
      {
        labOrdersUuid: 'f0000204-0000-4000-8000-000000000204',
        proceduresUuid: 'f0000206-0000-4000-8000-000000000206',
        prescriptionsUuid: 'f0000215-0000-4000-8000-000000000215',
        referralUuid: 'f0000205-0000-4000-8000-000000000205',
        nextAppointmentUuid: 'f0000004-0000-4000-8000-000000000004',
      },
    );

    expect(result.current.treatmentPlans[0]).toMatchObject({
      labOrders: 'Hemograma',
      procedures: 'Curación',
      prescriptions: 'Paracetamol',
      referral: 'Cardiología',
      nextAppointment: '2026-08-12',
    });
  });

  it('distinguishes compatibility-mapped CE-001 fields by formFieldPath', () => {
    const { result } = renderWithObs(
      [
        obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Hemograma', 'rfe-forms-ordenesLaboratorio'),
        obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Ibuprofeno', 'rfe-forms-prescripciones'),
        obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Neurología', 'rfe-forms-referencia'),
        obs(LEGACY_ENCOUNTER_NOTE_UUID, '2026-08-20', 'rfe-forms-proximaCita'),
      ],
      {},
      {
        labOrders: 'ordenesLaboratorio',
        prescriptions: 'prescripciones',
        referral: 'referencia',
        nextAppointment: 'proximaCita',
      },
    );

    expect(result.current.treatmentPlans[0]).toMatchObject({
      labOrders: 'Hemograma',
      prescriptions: 'Ibuprofeno',
      referral: 'Neurología',
      nextAppointment: '2026-08-20',
    });
  });
});
