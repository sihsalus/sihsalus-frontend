import { type DataTableSortState } from '@carbon/react';
import { fhirBaseUrl, openmrsFetch, restBaseUrl, useConfig, useFhirFetchAll } from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  buildAntecedentTypeCategory,
  buildAntecedentTypeNote,
  type FhirConditionCategory,
  type FhirConditionNote,
  getAntecedentTypeFromCondition,
  getConditionCategoryDisplay,
  getConditionNoteText,
} from '@openmrs/esm-patient-common-lib';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { type FHIRCondition } from './types';

export type Condition = {
  clinicalStatus: string;
  conceptId: string;
  display: string;
  onsetDateTime: string;
  recordedDate: string;
  id: string;
  abatementDateTime?: string;
  antecedentType?: AntecedentTypeCode;
  categoryText?: string;
  noteText?: string;
};

export interface ConditionDataTableRow {
  cells: Array<{
    id: string;
    value: string;
    info: {
      header: string;
    };
  }>;
  id: string;
}

export type CodedCondition = {
  display: string;
  uuid: string;
};

type CreatePayload = {
  clinicalStatus: {
    coding: [
      {
        system: string;
        code: string;
      },
    ];
  };
  code: {
    coding: [
      {
        code: string;
        display: string;
      },
    ];
  };
  onsetDateTime?: string;
  recordedDate: string;
  resourceType: string;
  subject: {
    reference: string;
  };
  abatementDateTime?: string;
  category?: Array<FhirConditionCategory>;
  note?: Array<FhirConditionNote>;
};

type EditPayload = CreatePayload & {
  id: string;
};

export type FormFields = {
  clinicalStatus: string;
  conceptId: string;
  display: string;
  abatementDateTime?: string | null;
  onsetDateTime?: string | null;
  patientId: string;
  providerUuid: string;
  recordedDate?: string;
  antecedentType?: AntecedentTypeCode | string;
  category?: string;
  note?: string;
};

// Tipos para ConceptSet
export type OpenmrsConceptName = {
  display: string;
  name: string;
  locale: string;
  localePreferred: boolean;
  conceptNameType: string;
};

export type OpenmrsConceptMember = {
  uuid: string;
  name: OpenmrsConceptName;
};

export type OpenmrsConcept = {
  uuid: string;
  display?: string;
  setMembers?: Array<OpenmrsConceptMember>;
};

// Hook para obtener conditions filtradas por ConceptSet. El concepto genérico
// de texto libre ("Otros") no es miembro del set, así que debe admitirse
// explícitamente o los antecedentes libres guardados nunca aparecerían.
export function useConditionsFromConceptSet(
  patientUuid: string,
  conceptSetUuid: string,
  freeTextFallbackConceptUuid?: string,
) {
  const conditionsUrl = `${fhirBaseUrl}/Condition?patient=${patientUuid}&_count=100`;

  // Obtenemos todas las conditions del paciente
  const {
    data: conditionsData,
    error: conditionsError,
    isLoading: conditionsLoading,
    isValidating,
    mutate,
  } = useFhirFetchAll<FHIRCondition>(patientUuid ? conditionsUrl : null);

  // Obtenemos el ConceptSet con la estructura correcta
  const conceptSetUrl = `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(setMembers:(uuid,name))`;

  const {
    data: conceptSetData,
    error: conceptSetError,
    isLoading: conceptSetLoading,
  } = useSWR<{ data: OpenmrsConcept }, Error>(conceptSetUuid ? conceptSetUrl : null, openmrsFetch);

  const formattedConditions = useMemo(() => {
    if (!conditionsData || !conceptSetData?.data?.setMembers) {
      return null;
    }

    const conceptSet = conceptSetData.data;
    const allowedConceptUuids = new Set(conceptSet.setMembers.map((member) => member.uuid));
    if (freeTextFallbackConceptUuid) {
      allowedConceptUuids.add(freeTextFallbackConceptUuid);
    }

    return conditionsData
      .map(mapConditionProperties)
      .filter((condition) => allowedConceptUuids.has(condition.conceptId))
      .map((condition) =>
        // Los antecedentes libres comparten el concepto genérico; el texto del
        // clínico (guardado en la nota) es su único nombre distinguible.
        condition.conceptId === freeTextFallbackConceptUuid && condition.noteText
          ? { ...condition, display: condition.noteText }
          : condition,
      )
      .sort((a, b) => (b.onsetDateTime > a.onsetDateTime ? 1 : -1));
  }, [conditionsData, conceptSetData, freeTextFallbackConceptUuid]);

  return {
    conditions: formattedConditions,
    conceptSet: conceptSetData?.data || null,
    error: conditionsError || conceptSetError,
    isLoading: conditionsLoading || conceptSetLoading,
    isValidating,
    mutate,
  };
}

// Hook para búsqueda en ConceptSet
export function useConditionsSearchFromConceptSet(conditionToLookup: string, conceptSetUuid: string) {
  // Usamos el UUID correcto y la estructura de datos correcta
  const conceptSetUrl = `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(setMembers:(uuid,name))`;

  const {
    data: conceptSetData,
    error,
    isLoading,
  } = useSWR<{ data: OpenmrsConcept }, Error>(conceptSetUuid ? conceptSetUrl : null, openmrsFetch);

  // Búsqueda local en los miembros del ConceptSet
  const searchResults = useMemo(() => {
    if (!conditionToLookup || !conceptSetData?.data?.setMembers) {
      return [];
    }

    const searchTerm = conditionToLookup.toLowerCase();

    return conceptSetData.data.setMembers
      .filter(
        (member) =>
          member.name.display.toLowerCase().includes(searchTerm) ||
          member.name.name.toLowerCase().includes(searchTerm) ||
          member.uuid.toLowerCase().includes(searchTerm),
      )
      .map((member) => ({
        uuid: member.uuid,
        display: member.name.display,
      }));
  }, [conditionToLookup, conceptSetData]);

  return {
    searchResults,
    conceptSet: conceptSetData?.data || null,
    error,
    isSearching: isLoading,
  };
}

export function useConditions(patientUuid: string) {
  const conditionsUrl = `${fhirBaseUrl}/Condition?patient=${patientUuid}&_count=100`;
  const { data, error, isLoading, isValidating, mutate } = useFhirFetchAll<FHIRCondition>(
    patientUuid ? conditionsUrl : null,
  );

  const formattedConditions = data
    ?.map(mapConditionProperties)
    .sort((a, b) => (b.onsetDateTime > a.onsetDateTime ? 1 : -1));

  return {
    conditions: data ? formattedConditions : null,
    error: error,
    isLoading,
    isValidating,
    mutate,
  };
}

export function useConditionsSearch(conditionToLookup: string) {
  const config = useConfig();
  const conditionConceptClassUuid = config?.conditionConceptClassUuid;
  const conditionsSearchUrl = `${restBaseUrl}/concept?name=${conditionToLookup}&searchType=fuzzy&class=${conditionConceptClassUuid}&v=custom:(uuid,display)`;

  const { data, error, isLoading } = useSWR<{ data: { results: Array<CodedCondition> } }, Error>(
    conditionToLookup ? conditionsSearchUrl : null,
    openmrsFetch,
  );

  return {
    searchResults: data?.data?.results ?? [],
    error,
    isSearching: isLoading,
  };
}

function mapConditionProperties(condition: FHIRCondition): Condition {
  const status = condition?.clinicalStatus?.coding[0]?.code;
  const antecedentType = getAntecedentTypeFromCondition(condition?.category, condition?.note);
  const categoryText = getConditionCategoryDisplay(condition?.category);
  const noteText = getConditionNoteText(condition?.note);
  return {
    clinicalStatus: status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '',
    conceptId: condition?.code?.coding[0]?.code,
    display: condition?.code?.coding[0]?.display,
    abatementDateTime: condition?.abatementDateTime,
    onsetDateTime: condition?.onsetDateTime,
    recordedDate: condition?.recordedDate,
    id: condition?.id,
    antecedentType,
    categoryText,
    noteText,
  };
}

export async function createCondition(payload: FormFields) {
  const controller = new AbortController();
  const url = `${fhirBaseUrl}/Condition`;

  const completePayload = buildConditionPayload(payload, new Date().toISOString());

  const res = await openmrsFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: completePayload,
    signal: controller.signal,
  });

  return res;
}

function buildConditionPayload(payload: FormFields, recordedDate: string): CreatePayload {
  if (!payload.providerUuid) {
    throw new Error('A clinical provider is required to record an antecedent.');
  }

  return {
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: payload.clinicalStatus,
        },
      ],
    },
    code: {
      coding: [
        {
          code: payload.conceptId,
          display: payload.display,
        },
      ],
    },
    ...(payload.abatementDateTime ? { abatementDateTime: payload.abatementDateTime } : {}),
    ...(payload.onsetDateTime ? { onsetDateTime: payload.onsetDateTime } : {}),
    recordedDate,
    resourceType: 'Condition',
    subject: {
      reference: `Patient/${payload.patientId}`,
    },
    category: buildAntecedentTypeCategory(payload.antecedentType ?? payload.category),
    note: buildAntecedentTypeNote(payload.antecedentType ?? payload.category, payload.note),
  };
}

export async function updateCondition(conditionId, payload: FormFields) {
  const controller = new AbortController();
  const url = `${fhirBaseUrl}/Condition/${conditionId}`;

  const completePayload: EditPayload = {
    ...buildConditionPayload(payload, payload.recordedDate ?? new Date().toISOString()),
    id: conditionId,
  };

  const res = await openmrsFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PUT',
    body: completePayload,
    signal: controller.signal,
  });

  return res;
}

export async function deleteCondition(conditionId: string) {
  const controller = new AbortController();
  const url = `${fhirBaseUrl}/Condition/${conditionId}`;

  const res = await openmrsFetch(url, {
    method: 'DELETE',
    signal: controller.signal,
  });

  return res;
}

export interface ConditionTableRow extends Condition {
  id: string;
  condition: string;
  abatementDateTime: string;
  antecedentTypeRender: string;
  onsetDateTimeRender: string;
}

export interface ConditionTableHeader {
  key: 'display' | 'antecedentTypeRender' | 'onsetDateTimeRender' | 'status';
  header: string;
  isSortable: true;
  sortFunc: (valueA: ConditionTableRow, valueB: ConditionTableRow) => number;
}

export function useConditionsSorting(tableHeaders: Array<ConditionTableHeader>, tableRows: Array<ConditionTableRow>) {
  const [sortParams, setSortParams] = useState<{
    key: ConditionTableHeader['key'] | '';
    sortDirection: DataTableSortState;
  }>({ key: '', sortDirection: 'NONE' });

  const sortRow = (_cellA, _cellB, { key, sortDirection }) => {
    setSortParams({ key, sortDirection });
    return 0;
  };

  const sortedRows = useMemo(() => {
    if (sortParams.sortDirection === 'NONE') {
      return tableRows;
    }

    const { key, sortDirection } = sortParams;
    const tableHeader = tableHeaders.find((h) => h.key === key);

    if (!tableHeader) {
      return tableRows;
    }

    return tableRows?.slice().sort((a, b) => {
      const sortingNum = tableHeader.sortFunc(a, b);
      return sortDirection === 'DESC' ? sortingNum : -sortingNum;
    });
  }, [sortParams, tableRows, tableHeaders]);

  return {
    sortedRows,
    sortRow,
  };
}
