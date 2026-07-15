import { safeEvaluateExpression } from '../expression-evaluator';
import type { PatientProgram } from '../types';

/**
 * Evaluates a given expression using patient data and their program enrollments.
 */
export const evaluateShowWhenExpression = (
  expression: string | null | undefined,
  patient: fhir.Patient | null | undefined,
  enrollments: Array<PatientProgram> | null | undefined,
): boolean => {
  const normalizedExpression = expression?.trim();
  if (!normalizedExpression) {
    return true;
  }

  const enrollment = enrollments?.flatMap((item) => item?.program?.name ?? []).filter(Boolean) ?? [];
  const programUuids = enrollments?.flatMap((item) => item?.program?.uuid ?? []).filter(Boolean) ?? [];

  return safeEvaluateExpression(normalizedExpression, {
    patient: patient ?? null,
    enrollment,
    programUuids,
  });
};
