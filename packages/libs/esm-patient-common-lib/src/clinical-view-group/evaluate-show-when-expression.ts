import { safeEvaluateExpression } from '../expression-evaluator';
import type { PatientProgram } from '../types';

/**
 * Evaluates a given expression using patient data and their program enrollments.
 */
export const evaluateShowWhenExpression = (
  expression: string,
  patient: fhir.Patient | null | undefined,
  enrollments: Array<PatientProgram> | null | undefined,
): boolean => {
  if (!expression) {
    return true;
  }

  if (expression.includes('patient') && !patient) {
    return false;
  }

  const enrollment = enrollments ? enrollments.flatMap((e) => e?.program?.['name']).filter(Boolean) : [];
  const programUuids = enrollments ? enrollments.flatMap((e) => e?.program?.['uuid']).filter(Boolean) : [];

  return safeEvaluateExpression(expression, {
    patient: patient ?? {},
    enrollment,
    programUuids,
  });
};
