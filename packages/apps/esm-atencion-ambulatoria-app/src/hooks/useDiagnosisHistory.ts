import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { ConfigObject } from '../config-schema';

export interface DiagnosisEntry {
  uuid: string;
  display: string;
  encounterDatetime: string;
  cie10Code: string | null;
  certainty: 'CONFIRMED' | 'PROVISIONAL';
  occurrence: 'NEW' | 'REPEAT';
  /** Tipo según NTS-139: P (Presuntivo), D (Definitivo), R (Repetido) */
  tipoNts: 'P' | 'D' | 'R';
}

interface ConceptMapping {
  display?: string;
}

interface EncounterObs {
  concept: { uuid: string };
  value?: { uuid?: string } | string;
  formFieldNamespace?: string;
  formFieldPath?: string;
}

interface EncounterDiagnosis {
  uuid: string;
  display: string;
  diagnosis: {
    coded?: { uuid?: string; display: string; mappings?: ConceptMapping[] };
    nonCoded?: string;
  };
  certainty: string;
  rank: number;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  diagnoses: EncounterDiagnosis[];
  obs: EncounterObs[];
}

export function useDiagnosisHistory(patientUuid: string, encounterTypeUuid: string) {
  const { concepts } = useConfig<ConfigObject>();
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}` +
        `&v=custom:(uuid,encounterDatetime,` +
        `diagnoses:(uuid,display,diagnosis:(coded:(uuid,display,mappings:(display))),certainty,rank),` +
        `obs:(concept:(uuid),value:(uuid),formFieldNamespace,formFieldPath))&limit=20`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Encounter[] } }>(url, openmrsFetch);

  const diagnoses: DiagnosisEntry[] = (data?.data?.results ?? []).flatMap((encounter) => {
    // Build a map: codedUuid → tipoAnswerUuid from visit-notes tipo OBS
    const tipoMap: Record<string, string> = {};
    (encounter.obs ?? []).forEach((obs) => {
      if (
        obs.concept?.uuid === concepts.diagnosisTypeConceptUuid &&
        obs.formFieldNamespace === 'visit-notes' &&
        typeof obs.formFieldPath === 'string' &&
        obs.formFieldPath.startsWith('tipo-dx-')
      ) {
        const codedUuid = obs.formFieldPath.replace('tipo-dx-', '');
        const valueUuid = typeof obs.value === 'object' && obs.value !== null ? obs.value.uuid : undefined;
        if (codedUuid && valueUuid) tipoMap[codedUuid] = valueUuid;
      }
    });

    return (encounter.diagnoses ?? []).map((dx) => {
      const mappings = dx.diagnosis?.coded?.mappings ?? [];
      const cie10Mapping = mappings.find((m: ConceptMapping) => m.display?.startsWith('ICD-10'));
      const cie10Code = cie10Mapping?.display?.split(': ')?.[1] ?? null;

      const codedUuid = dx.diagnosis?.coded?.uuid ?? '';
      const tipoUuid = tipoMap[codedUuid];

      let tipoNts: 'P' | 'D' | 'R' = 'P';
      if (tipoUuid === concepts.definitiveDiagnosisTypeUuid) {
        tipoNts = 'D';
      } else if (tipoUuid === concepts.repeatDiagnosisTypeUuid) {
        tipoNts = 'R';
      }

      return {
        uuid: dx.uuid,
        display: dx.diagnosis?.coded?.display ?? dx.display ?? '',
        encounterDatetime: encounter.encounterDatetime,
        cie10Code,
        certainty: dx.certainty === 'CONFIRMED' ? 'CONFIRMED' : 'PROVISIONAL',
        occurrence: tipoNts === 'R' ? 'REPEAT' : 'NEW',
        tipoNts,
      };
    });
  });

  return {
    diagnoses,
    isLoading,
    error,
    mutate,
  };
}
