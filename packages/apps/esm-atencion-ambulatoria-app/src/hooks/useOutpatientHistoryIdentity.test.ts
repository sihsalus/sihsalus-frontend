import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { configSchema } from '../config-schema';
import { useAnamnesis } from './useAnamnesis';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useDiagnosisHistory } from './useDiagnosisHistory';
import { usePhysicalExam } from './usePhysicalExam';
import { useReferralCounterReferral } from './useReferralCounterReferral';
import { useTreatmentPlan } from './useTreatmentPlan';

vi.mock('./useClinicalHistoryPagination', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useClinicalHistoryPagination')>()),
  useMergedClinicalHistoryPagination: vi.fn(),
}));

const patientUuid = 'synthetic-patient';
const encounterTypeUuid = 'synthetic-encounter-type';
const historySource = {
  encounterTypeUuid,
  formUuid: 'synthetic-form',
  visitTypeUuid: 'synthetic-visit-type',
};

describe('Consulta Externa clinical histories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    vi.mocked(useMergedClinicalHistoryPagination).mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
      truncated: false,
    });
  });

  it.each([
    ['Anamnesis', () => useAnamnesis(patientUuid, historySource, {})],
    ['Examen físico', () => usePhysicalExam(patientUuid, historySource, {})],
    ['Diagnóstico', () => useDiagnosisHistory(patientUuid, historySource)],
    ['Plan de tratamiento', () => useTreatmentPlan(patientUuid, historySource, {})],
    ['Referencias', () => useReferralCounterReferral(patientUuid, encounterTypeUuid, {})],
  ])('%s requests and verifies patient and encounter type before displaying history', (_name, useHistory) => {
    renderHook(() => {
      useHistory();
    });

    const [sources] = vi.mocked(useMergedClinicalHistoryPagination).mock.calls[0];
    expect(sources).toHaveLength(1);
    const source = sources?.[0];
    expect(source).toMatchObject({
      expectedPatientUuid: patientUuid,
      expectedEncounterTypeUuid: encounterTypeUuid,
    });
    const url = new URL(source?.url ?? '', 'http://localhost');
    expect(url.searchParams.get('patient')).toBe(patientUuid);
    expect(url.searchParams.get('encounterType')).toBe(encounterTypeUuid);
    const representation = url.searchParams.get('v');
    expect(representation).toContain('patient:(uuid)');
    expect(representation).toContain('encounterType:(uuid)');
  });
});
