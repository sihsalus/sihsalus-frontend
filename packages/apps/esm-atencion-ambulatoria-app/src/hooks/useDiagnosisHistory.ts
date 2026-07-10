import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { ConfigObject } from '../config-schema';

export interface DiagnosisEntry {
  uuid: string;
  display: string;
  encounterDatetime: string;
  cie10Code: string | null;
  rank: number;
  /** Tipo según NTS-139: P (Presuntivo), D (Definitivo), R (Repetitivo) */
  tipoNts: 'P' | 'D' | 'R';
}

const TIPO_DX_FORM_FIELD_NAMESPACE = 'visit-notes';
const TIPO_DX_FIELD_PREFIX = 'tipo-dx-';
type TipoNts = DiagnosisEntry['tipoNts'];

interface ConceptMapping {
  display?: string;
}

interface EncounterObs {
  concept: { uuid: string };
  value?: { uuid?: string; display?: string; name?: string } | string;
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
  certainty?: string;
  rank: number;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  diagnoses: EncounterDiagnosis[];
  obs: EncounterObs[];
}

function getTipoDxDisplay(value: EncounterObs['value']): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return value?.display ?? value?.name ?? null;
}

function getTipoNtsFromValue(value: EncounterObs['value'], concepts: ConfigObject['concepts']): TipoNts | undefined {
  const valueUuid = typeof value === 'object' && value !== null ? value.uuid : typeof value === 'string' ? value : null;
  if (valueUuid === concepts.definitiveDiagnosisTypeUuid) {
    return 'D';
  }
  if (valueUuid === concepts.repeatDiagnosisTypeUuid) {
    return 'R';
  }

  const display = getTipoDxDisplay(value)?.toLocaleLowerCase();
  if (display?.includes('definit')) {
    return 'D';
  }
  if (display?.includes('repetit')) {
    return 'R';
  }
  if (display?.includes('presunt')) {
    return 'P';
  }

  return undefined;
}

function getTipoNtsFromCertainty(certainty?: string): TipoNts | undefined {
  if (certainty === 'CONFIRMED') {
    return 'D';
  }
  if (certainty === 'PROVISIONAL') {
    return 'P';
  }

  return undefined;
}

export function useDiagnosisHistory(patientUuid: string, encounterTypeUuid: string) {
  const { concepts } = useConfig<ConfigObject>();
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}` +
        `&v=custom:(uuid,encounterDatetime,` +
        `diagnoses:(uuid,display,diagnosis:(coded:(uuid,display,mappings:(display))),certainty,rank),` +
        `obs:(concept:(uuid),value:(uuid,display),formFieldNamespace,formFieldPath))&limit=20`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Encounter[] } }>(
    url,
    openmrsFetch,
  );

  const diagnoses: DiagnosisEntry[] = (data?.data?.results ?? []).flatMap((encounter) => {
    // Mirrors patient-notes: one obs links the MINSA P/D/R type to each coded diagnosis.
    const tipoMap: Record<string, EncounterObs['value']> = {};
    (encounter.obs ?? []).forEach((obs) => {
      if (
        obs.concept?.uuid === concepts.diagnosisTypeConceptUuid &&
        obs.formFieldNamespace === TIPO_DX_FORM_FIELD_NAMESPACE &&
        typeof obs.formFieldPath === 'string' &&
        obs.formFieldPath.startsWith(TIPO_DX_FIELD_PREFIX)
      ) {
        const codedUuid = obs.formFieldPath.slice(TIPO_DX_FIELD_PREFIX.length);
        if (codedUuid && obs.value != null) tipoMap[codedUuid] = obs.value;
      }
    });

    return (encounter.diagnoses ?? []).map((dx) => {
      const mappings = dx.diagnosis?.coded?.mappings ?? [];
      const cie10Mapping = mappings.find((m: ConceptMapping) => m.display?.startsWith('ICD-10'));
      const cie10Code = cie10Mapping?.display?.split(': ')?.[1] ?? null;

      const codedUuid = dx.diagnosis?.coded?.uuid ?? '';
      const tipoNts = getTipoNtsFromValue(tipoMap[codedUuid], concepts) ?? getTipoNtsFromCertainty(dx.certainty) ?? 'P';

      return {
        uuid: dx.uuid,
        display: dx.diagnosis?.coded?.display ?? dx.diagnosis?.nonCoded ?? dx.display ?? '',
        encounterDatetime: encounter.encounterDatetime,
        cie10Code,
        rank: dx.rank,
        tipoNts,
      };
    });
  });

  return {
    diagnoses,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
