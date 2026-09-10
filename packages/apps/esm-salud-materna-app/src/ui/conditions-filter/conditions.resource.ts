import { useConditionConceptSet, usePatientConditions } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';

export {
  type CodedCondition,
  type Condition,
  createCondition,
  deleteCondition,
  type FormFields,
  syncConditionCache,
  updateCondition,
  useConditionsSearchFromConceptSet,
  useConditionTableSorting as useConditionsSorting,
} from '@openmrs/esm-patient-common-lib';

// Hook para obtener conditions filtradas por ConceptSet
export function useConditionsFromConceptSet(patientUuid: string, conceptSetUuid: string) {
  // Obtenemos todas las conditions del paciente
  const {
    conditions: conditionsData,
    error: conditionsError,
    isLoading: conditionsLoading,
    isValidating,
    mutate,
  } = usePatientConditions(patientUuid);

  const { conceptSet, error: conceptSetError, isLoading: conceptSetLoading } = useConditionConceptSet(conceptSetUuid);

  const formattedConditions = useMemo(() => {
    if (!conditionsData || !conceptSet) {
      return null;
    }

    const allowedConceptUuids = new Set(conceptSet.setMembers.map((member) => member.uuid));

    return conditionsData.filter((condition) => allowedConceptUuids.has(condition.conceptId));
  }, [conditionsData, conceptSet]);

  return {
    conditions: formattedConditions,
    conceptSet: conceptSet,
    error: conditionsError || conceptSetError,
    isLoading: conditionsLoading || conceptSetLoading,
    isValidating,
    mutate,
  };
}

export function useConditions(patientUuid: string) {
  return usePatientConditions(patientUuid);
}
