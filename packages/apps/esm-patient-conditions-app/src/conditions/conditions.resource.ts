import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type CodedCondition, type Condition, usePatientConditions } from '@openmrs/esm-patient-common-lib';

import useSWR from 'swr';

export {
  type CodedCondition,
  type Condition,
  createCondition,
  deleteCondition,
  type FormFields,
  type OpenmrsCondition,
  syncConditionCache,
  updateCondition,
  useConditionTableSorting as useConditionsSorting,
} from '@openmrs/esm-patient-common-lib';

export function useConditions(patientUuid: string) {
  return usePatientConditions(patientUuid);
}

export function useConditionsSearch(conditionToLookup: string) {
  const config = useConfig();
  const conditionConceptClassUuid = config?.conditionConceptClassUuid;
  const conditionsSearchUrl = `${restBaseUrl}/concept?name=${encodeURIComponent(conditionToLookup)}&searchType=fuzzy&class=${encodeURIComponent(conditionConceptClassUuid ?? '')}&v=custom:(uuid,display)`;

  const { data, error, isLoading } = useSWR<{ data: { results: Array<CodedCondition> } }, Error>(
    conditionToLookup && conditionConceptClassUuid ? conditionsSearchUrl : null,
    (url: string) => openmrsFetch<{ results: Array<CodedCondition> }>(url, { rejectOnAuthFailure: true }),
  );

  return {
    searchResults: data?.data?.results ?? [],
    error,
    isSearching: isLoading,
  };
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
