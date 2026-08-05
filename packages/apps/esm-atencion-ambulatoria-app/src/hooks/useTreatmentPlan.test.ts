import { renderHook } from '@testing-library/react';
import { useClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useTreatmentPlan } from './useTreatmentPlan';

vi.mock('./useClinicalHistoryPagination', () => ({
  useClinicalHistoryPagination: vi.fn(),
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
  encounterProviders: Array<{ display: string }>;
  obs: ObsFixture[];
}

const mockUseClinicalHistoryPagination = vi.mocked(useClinicalHistoryPagination<EncounterFixture>);

function obs(conceptUuid: string, value: string, formFieldPath?: string): ObsFixture {
  return {
    uuid: `obs-${formFieldPath ?? conceptUuid}`,
    concept: { uuid: conceptUuid, display: conceptUuid },
    value,
    ...(formFieldPath ? { formFieldPath } : {}),
  };
}

function renderWithObs(encounterObs: ObsFixture[]) {
  mockUseClinicalHistoryPagination.mockReturnValue({
    data: [
      {
        uuid: 'encounter-1',
        encounterDatetime: '2026-08-05T10:00:00.000Z',
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

  return renderHook(() =>
    useTreatmentPlan('patient-uuid', 'external-consultation', {
      therapeuticIndicationsUuid: THERAPEUTIC_INDICATIONS_UUID,
    }),
  );
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

  it('never reports the free-text diagnosis as therapeutic indications', () => {
    // Both fields shared the legacy concept, so matching it by concept alone would
    // surface the diagnosis in the treatment plan.
    const { result } = renderWithObs([
      obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Faringitis aguda', 'rfe-forms-diagnosticoPrincipal'),
    ]);

    expect(result.current.treatmentPlans).toHaveLength(0);
  });

  it('prefers the dedicated concept over a legacy value in the same encounter', () => {
    const { result } = renderWithObs([
      obs(LEGACY_ENCOUNTER_NOTE_UUID, 'Indicación antigua', 'rfe-forms-indicacionesTerapeuticas'),
      obs(THERAPEUTIC_INDICATIONS_UUID, 'Indicación vigente', 'rfe-forms-indicacionesTerapeuticas'),
    ]);

    expect(result.current.treatmentPlans[0].therapeuticIndications).toBe('Indicación vigente');
  });
});
