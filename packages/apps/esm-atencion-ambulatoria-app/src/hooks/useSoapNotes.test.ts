import { mapSoapEntry, type SoapEncounter } from './useSoapNotes';

const concepts = {
  soapSubjectiveUuid: 'subjective',
  soapObjectiveUuid: 'objective',
  soapAssessmentUuid: 'assessment',
  soapPlanUuid: 'plan',
};

describe('mapSoapEntry', () => {
  it('maps repeated physical-exam observations by form field path', () => {
    const encounter: SoapEncounter = {
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
          uuid: 'regional-summary',
          concept: { uuid: 'objective', display: 'Physical examination findings' },
          value: 'Sin hallazgos regionales de alarma',
          display: 'Sin hallazgos regionales de alarma',
          formFieldPath: 'rfe-forms-resumenExamenRegional',
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

    const entry = mapSoapEntry(encounter, concepts);

    expect(entry.provider).toBe('Dra. Sintética');
    expect(entry.objective).toBe('Hallazgo adicional sintético');
    expect(entry.physicalExam.generalState).toBe('Buen estado general');
    expect(entry.physicalExam.regionalSummary).toBe('Sin hallazgos regionales de alarma');
  });

  it('keeps the legacy unsegmented objective readable', () => {
    const encounter: SoapEncounter = {
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

    expect(mapSoapEntry(encounter, concepts).objective).toBe('Examen físico histórico');
  });
});
