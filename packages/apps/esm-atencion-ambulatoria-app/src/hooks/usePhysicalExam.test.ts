import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { mapPhysicalExamEntry, type PhysicalExamEncounter, usePhysicalExam } from './usePhysicalExam';

vi.mock('swr', () => ({ default: vi.fn() }));

const mockUseSWR = vi.mocked(useSWR);

const concepts = {
  soapSubjectiveUuid: 'subjective',
  soapObjectiveUuid: 'objective',
  soapAssessmentUuid: 'assessment',
  soapPlanUuid: 'plan',
};

describe('mapPhysicalExamEntry', () => {
  it('maps repeated physical-exam observations by form field path', () => {
    const encounter: PhysicalExamEncounter = {
      uuid: 'encounter-uuid',
      encounterDatetime: '2026-08-24T10:00:00.000-05:00',
      encounterProviders: [{ display: 'Dra. Sintética - Clínica' }],
      obs: [
        {
          uuid: 'general-state',
          concept: { uuid: 'objective', display: 'Physical examination findings' },
          value: 'Buen estado general',
          display: 'Buen estado general',
          formFieldPath: 'rfe-forms-estadoGeneral',
        },
        {
          uuid: 'head-and-neck',
          concept: { uuid: 'head-and-neck-concept', display: 'Head and neck' },
          value: 'Sin hallazgos de alarma',
          display: 'Sin hallazgos de alarma',
          formFieldPath: 'rfe-forms-cabezaCuello',
        },
        {
          uuid: 'other-findings',
          concept: { uuid: 'objective', display: 'Physical examination findings' },
          value: 'Hallazgo adicional sintético',
          display: 'Hallazgo adicional sintético',
          formFieldPath: 'rfe-forms-soapObjetivo',
        },
      ],
    };

    const entry = mapPhysicalExamEntry(encounter, concepts);

    expect(entry.provider).toBe('Dra. Sintética');
    expect(entry.legacyObjective).toBe('Hallazgo adicional sintético');
    expect(entry.physicalExam.generalState).toBe('Buen estado general');
    expect(entry.physicalExam.headAndNeck).toBe('Sin hallazgos de alarma');
  });

  it('keeps the legacy unsegmented objective readable', () => {
    const encounter: PhysicalExamEncounter = {
      uuid: 'legacy-encounter',
      encounterDatetime: '2026-08-23T10:00:00.000-05:00',
      encounterProviders: [],
      obs: [
        {
          uuid: 'legacy-objective',
          concept: { uuid: 'objective', display: 'Physical examination findings' },
          value: 'Examen físico histórico',
          display: 'Examen físico histórico',
        },
      ],
    };

    expect(mapPhysicalExamEntry(encounter, concepts).legacyObjective).toBe('Examen físico histórico');
  });
});

describe('usePhysicalExam', () => {
  it('excludes unrelated and empty notes before paginating the physical examination history', () => {
    const makeEncounter = (
      uuid: string,
      conceptUuid: string,
      value: string,
      formFieldPath?: string,
    ): PhysicalExamEncounter => ({
      uuid,
      encounterDatetime: '2026-09-02T10:00:00.000-05:00',
      encounterProviders: [],
      obs: [
        {
          uuid: `${uuid}-obs`,
          concept: { uuid: conceptUuid, display: 'Synthetic concept' },
          value,
          display: value,
          formFieldPath,
        },
      ],
    });
    const unrelatedNotes = Array.from({ length: 12 }, (_, index) =>
      makeEncounter(`unrelated-${index}`, ['subjective', 'assessment', 'plan'][index % 3], 'Texto sintético'),
    );
    const segmentedExam = makeEncounter(
      'segmented-exam',
      'head-and-neck',
      'Hallazgo segmentado',
      'rfe-forms-cabezaCuello',
    );
    const legacyExam = makeEncounter('legacy-exam', 'objective', 'Examen físico histórico');
    mockUseSWR.mockReturnValue({
      data: {
        encounters: [...unrelatedNotes, makeEncounter('empty-exam', 'objective', ''), segmentedExam, legacyExam],
        sourceErrors: [],
        truncated: false,
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => usePhysicalExam('synthetic-patient', 'external-consultation', concepts));

    expect(result.current.physicalExamEntries.map((entry) => entry.encounterUuid)).toEqual([
      'segmented-exam',
      'legacy-exam',
    ]);
    expect(result.current.pagination).toMatchObject({ currentPage: 1, totalPages: 1 });
  });
});
