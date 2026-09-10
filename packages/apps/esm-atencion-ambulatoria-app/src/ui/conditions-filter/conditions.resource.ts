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

// Conserva los miembros del set, el fallback codificado histórico y los
// antecedentes narrativos "Otros" registrados por este flujo.
export function useConditionsFromConceptSet(
  patientUuid: string,
  conceptSetUuid: string,
  freeTextFallbackConceptUuid?: string,
) {
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
    if (freeTextFallbackConceptUuid) {
      allowedConceptUuids.add(freeTextFallbackConceptUuid);
    }

    return conditionsData
      .filter(
        (condition) =>
          allowedConceptUuids.has(condition.conceptId) ||
          (condition.antecedentType === 'other' && !condition.conceptId && Boolean(condition.nonCodedText?.trim())),
      )
      .map((condition) =>
        // Los antecedentes libres comparten el concepto genérico; el texto del
        // clínico (guardado en la nota) es su único nombre distinguible.
        condition.conceptId === freeTextFallbackConceptUuid && condition.noteText
          ? { ...condition, display: condition.noteText }
          : condition,
      );
  }, [conditionsData, conceptSet, freeTextFallbackConceptUuid]);

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
