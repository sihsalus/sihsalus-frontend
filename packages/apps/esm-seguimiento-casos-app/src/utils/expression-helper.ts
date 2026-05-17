import { type PatientProgram, safeEvaluateExpression } from '@openmrs/esm-patient-common-lib';

/**
 * Evaluates a given expression using patient data and their program enrollments.
 */
export const evaluateExpression = (
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

export function replaceAll(str: string, find: string, replace: string): string {
  return str.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
}

export function extractNameString(formattedString: string): string {
  if (!formattedString) {
    return '';
  }
  const parts = formattedString.split(' - ');
  return parts.length > 1 ? parts[1] : '';
}

export const formatPatientName = (patient): string => {
  if (!patient || !patient.name || patient.name.length === 0) {
    return '';
  }

  const nameObj = patient.name[0];
  if (nameObj.text) {
    return nameObj.text;
  }

  const givenNames = nameObj.given ? nameObj.given.join(' ') : '';
  const familyName = nameObj.family || '';

  return `${familyName} ${givenNames}`.trim();
};

export const uppercaseText = (text): string => {
  return text.toUpperCase();
};
