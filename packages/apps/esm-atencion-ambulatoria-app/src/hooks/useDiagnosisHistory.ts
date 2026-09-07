import { restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import type { ConfigObject } from '../config-schema';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

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
  conceptReferenceTerm?: {
    code?: string;
    display?: string;
    conceptSource?: {
      name?: string;
      display?: string;
    };
  };
}

interface ConceptName {
  display?: string;
  name?: string;
  conceptNameType?: string;
}

interface CodedDiagnosisConcept {
  uuid?: string;
  display: string;
  mappings?: ConceptMapping[];
  names?: ConceptName[];
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
    coded?: CodedDiagnosisConcept;
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

const cie10CodePattern = /^[A-Z][0-9][A-Z0-9.]{1,5}$/i;
const cie10SourcePattern = /icd[-\s]?10|cie[-\s]?10/i;

function getMappingSource(mapping: ConceptMapping): string {
  return (
    mapping.conceptReferenceTerm?.conceptSource?.name?.trim() ||
    mapping.conceptReferenceTerm?.conceptSource?.display?.trim() ||
    mapping.display?.split(':', 1)[0]?.trim() ||
    ''
  );
}

function getMappingCode(mapping: ConceptMapping): string | undefined {
  const structuredCode = mapping.conceptReferenceTerm?.code?.trim();
  if (structuredCode) {
    return structuredCode;
  }

  const display = mapping.conceptReferenceTerm?.display?.trim() ?? mapping.display?.trim();
  if (!display) {
    return undefined;
  }

  const separatorIndex = display.lastIndexOf(':');
  return (separatorIndex >= 0 ? display.slice(separatorIndex + 1) : display).trim() || undefined;
}

export function getCie10Code(coded?: CodedDiagnosisConcept): string | null {
  if (!coded) {
    return null;
  }

  const mappedCode = (coded.mappings ?? []).find((mapping) => {
    const code = getMappingCode(mapping);
    return cie10SourcePattern.test(getMappingSource(mapping)) && Boolean(code && cie10CodePattern.test(code));
  });
  const mappingCode = mappedCode ? getMappingCode(mappedCode) : undefined;
  if (mappingCode) {
    return mappingCode.toLocaleUpperCase('es-PE');
  }

  const shortName = (coded.names ?? []).find((name) => {
    const value = (name.display ?? name.name)?.trim();
    return name.conceptNameType === 'SHORT' && Boolean(value && cie10CodePattern.test(value));
  });
  const shortNameCode = (shortName?.display ?? shortName?.name)?.trim();

  return shortNameCode ? shortNameCode.toLocaleUpperCase('es-PE') : null;
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

export function useDiagnosisHistory(
  patientUuid: string,
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
) {
  const { concepts } = useConfig<ConfigObject>();
  const encounterTypes = toEncounterTypeSources(encounterType);
  const sources = patientUuid
    ? encounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
        url:
          `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}` +
          `&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),` +
          `diagnoses:(uuid,display,diagnosis:(coded:(uuid,display,mappings:(display,conceptReferenceTerm:(code,display,conceptSource:(name,display))),names:(display,name,conceptNameType))),certainty,rank),` +
          `obs:(concept:(uuid),value:(uuid,display),formFieldNamespace,formFieldPath))&order=desc`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback((encounter: Encounter) => Boolean(encounter.diagnoses?.length), []);
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<Encounter>(sources, isRelevant);

  const diagnoses: DiagnosisEntry[] = data.flatMap((encounter) => {
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
      const cie10Code = getCie10Code(dx.diagnosis?.coded);

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
    pagination,
    sourceErrors,
  };
}
