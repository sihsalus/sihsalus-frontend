import { type VisitType } from '@openmrs/esm-framework';

import { type VisitTypeEligibilityRule } from '../../config-schema';

function normalizeGender(gender?: string) {
  const normalizedGender = gender?.trim().toLowerCase();

  if (normalizedGender === 'm' || normalizedGender === 'male' || normalizedGender === 'masculino') {
    return 'M';
  }

  if (normalizedGender === 'f' || normalizedGender === 'female' || normalizedGender === 'femenino') {
    return 'F';
  }

  return normalizedGender?.toUpperCase();
}

export function filterVisitTypesByEligibility(
  visitTypes: Array<VisitType>,
  rules: Array<VisitTypeEligibilityRule>,
  locationUuid?: string,
  patientGender?: string,
) {
  if (!locationUuid || !rules?.length) {
    return visitTypes;
  }

  const locationRules = rules.filter((rule) => rule.locationUuid === locationUuid);
  if (!locationRules.length) {
    return visitTypes;
  }

  const normalizedPatientGender = normalizeGender(patientGender);

  return visitTypes.filter((visitType) =>
    locationRules.some((rule) => {
      if (!rule.visitTypeUuids.includes(visitType.uuid)) {
        return false;
      }

      if (!rule.allowedGenders?.length) {
        return true;
      }

      return Boolean(
        normalizedPatientGender &&
          rule.allowedGenders.some((allowedGender) => normalizeGender(allowedGender) === normalizedPatientGender),
      );
    }),
  );
}
