import { type DataTableSortState } from '@carbon/react';
import { fhirBaseUrl, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  buildAntecedentTypeCategory,
  buildAntecedentTypeNote,
  type FhirConditionCategory,
  type FhirConditionNote,
  getAntecedentTypeFromCondition,
  getConditionCategoryDisplay,
  getConditionNoteText,
} from '@sihsalus/esm-sihsalus-shared';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { type FHIRCondition, type FHIRConditionResponse } from './types';

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
  onsetDateTime: string;
  recorder: {
    reference: string;
  };
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
  abatementDateTime: string;
  onsetDateTime: string;
  patientId: string;
  userId: string;
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

// Hook para obtener conditions filtradas por ConceptSet
export function useConditionsFromConceptSet(patientUuid: string, conceptSetUuid: string) {
  const conditionsUrl = `${fhirBaseUrl}/Condition?patient=${patientUuid}&_count=100`;

  // Obtenemos todas las conditions del paciente
  const {
    data: conditionsData,
    error: conditionsError,
    isLoading: conditionsLoading,
    isValidating,
    mutate,
  } = useSWR<{ data: FHIRConditionResponse }, Error>(patientUuid ? conditionsUrl : null, openmrsFetch);

  // Obtenemos el ConceptSet con la estructura correcta
  const conceptSetUrl = `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(setMembers:(uuid,name))`;

  const {
    data: conceptSetData,
    error: conceptSetError,
    isLoading: conceptSetLoading,
  } = useSWR<{ data: OpenmrsConcept }, Error>(conceptSetUuid ? conceptSetUrl : null, openmrsFetch);

  const formattedConditions = useMemo(() => {
    if (!conditionsData?.data?.total || !conceptSetData?.data?.setMembers) {
      return null;
    }

    const conceptSet = conceptSetData.data;
    const allowedConceptUuids = new Set(conceptSet.setMembers.map((member) => member.uuid));

    return conditionsData.data.entry
      .map((entry) => entry.resource ?? [])
      .map(mapConditionProperties)
      .filter((condition) => allowedConceptUuids.has(condition.conceptId))
      .sort((a, b) => (b.onsetDateTime > a.onsetDateTime ? 1 : -1));
  }, [conditionsData, conceptSetData]);

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
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: FHIRConditionResponse }, Error>(
    patientUuid ? conditionsUrl : null,
    openmrsFetch,
  );

  const formattedConditions =
    data?.data?.total > 0
      ? data?.data?.entry
          .map((entry) => entry.resource ?? [])
          .map(mapConditionProperties)
          .sort((a, b) => (b.onsetDateTime > a.onsetDateTime ? 1 : -1))
      : null;

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

  const completePayload: CreatePayload = {
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
    abatementDateTime: payload.abatementDateTime,
    onsetDateTime: payload.onsetDateTime,
    recorder: {
      reference: `Practitioner/${payload.userId}`,
    },
    recordedDate: new Date().toISOString(),
    resourceType: 'Condition',
    subject: {
      reference: `Patient/${payload.patientId}`,
    },
    category: buildAntecedentTypeCategory(payload.antecedentType ?? payload.category),
    note: buildAntecedentTypeNote(payload.antecedentType ?? payload.category, payload.note),
  };

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

export async function updateCondition(conditionId, payload: FormFields) {
  const controller = new AbortController();
  const url = `${fhirBaseUrl}/Condition/${conditionId}`;

  const completePayload: EditPayload = {
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
    abatementDateTime: payload.abatementDateTime,
    id: conditionId,
    onsetDateTime: payload.onsetDateTime,
    recorder: {
      reference: `Practitioner/${payload.userId}`,
    },
    recordedDate: new Date().toISOString(),
    resourceType: 'Condition',
    subject: {
      reference: `Patient/${payload.patientId}`,
    },
    category: buildAntecedentTypeCategory(payload.antecedentType ?? payload.category),
    note: buildAntecedentTypeNote(payload.antecedentType ?? payload.category, payload.note),
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
