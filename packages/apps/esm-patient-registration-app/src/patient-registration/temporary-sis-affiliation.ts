import {
  hasTrustedSisVerificationEvidence,
  isValidInsuranceVerificationIsoDateTime,
  normalizeTemporarySisAffiliationCode,
  SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD,
  TRUSTED_SIS_VERIFICATION_METHODS,
} from '@openmrs/esm-patient-common-lib';
import type { FormValues, PatientIdentifierType } from './patient-registration.types';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationNotConsultedConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
} from './peru-registration-config';

export const peruTemporarySisSiasisVerificationMethod = SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD;

const independentSisVerificationMethods: ReadonlySet<string> = new Set(
  TRUSTED_SIS_VERIFICATION_METHODS.filter(
    (method) => method !== SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD,
  ),
);
const verifiedAccreditationStatuses = new Set([
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
]);
const siasisAdtOnlyMethod = new Set([peruTemporarySisSiasisVerificationMethod]);

// Registration keeps aliases while its callers migrate to the shared financer
// contract. They must not introduce a second normalization or date rule.
export const normalizeTemporarySisCode = normalizeTemporarySisAffiliationCode;
export const isValidIsoDateTime = isValidInsuranceVerificationIsoDateTime;
export { hasTrustedSisVerificationEvidence };

function looksLikeTemporarySisCode(value: string | undefined) {
  return /^E(?:[-\s]?\d)/i.test(value?.trim() ?? '');
}

function getTemporaryIdentifierCode(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
) {
  for (const [fieldName, identifier] of Object.entries(values?.identifiers ?? {})) {
    const configuredType = identifierTypes.find(
      (identifierType) =>
        identifierType.fieldName === fieldName || identifierType.uuid === identifier.identifierTypeUuid,
    );
    const identifierTypeUuid = identifier.identifierTypeUuid ?? configuredType?.uuid;

    if (identifierTypeUuid === peruTemporaryAffiliationPatientIdentifierTypeUuid) {
      return normalizeTemporarySisCode(identifier.identifierValue);
    }
  }

  return null;
}

function getSiasisAdtProtectedSnapshot(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
) {
  const attributes = values?.attributes ?? {};
  return {
    payer: attributes[peruInsuranceTypeAttributeTypeUuid] ?? '',
    insuranceCode: normalizeTemporarySisCode(attributes[peruInsuranceCodeAttributeTypeUuid]),
    identifierCode: getTemporaryIdentifierCode(values, identifierTypes),
    status: attributes[peruInsuranceAccreditationStatusAttributeTypeUuid] ?? '',
    checkedAt: attributes[peruInsuranceAccreditationCheckedAtAttributeTypeUuid] ?? '',
    method: attributes[peruInsuranceVerificationMethodAttributeTypeUuid] ?? '',
  };
}

function isCompleteActiveSisBundle(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
  allowedMethods: ReadonlySet<string>,
) {
  const snapshot = getSiasisAdtProtectedSnapshot(values, identifierTypes);
  return (
    snapshot.payer === peruInsuranceSisConceptUuid &&
    !!snapshot.insuranceCode &&
    snapshot.identifierCode === snapshot.insuranceCode &&
    snapshot.status === peruInsuranceAccreditationActiveConceptUuid &&
    isValidIsoDateTime(snapshot.checkedAt) &&
    allowedMethods.has(snapshot.method)
  );
}

function isCompleteIndependentVerification(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
) {
  const attributes = values?.attributes ?? {};
  const payer = attributes[peruInsuranceTypeAttributeTypeUuid];
  const insuranceCode = attributes[peruInsuranceCodeAttributeTypeUuid]?.trim();
  const status = attributes[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const checkedAt = attributes[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];
  const method = attributes[peruInsuranceVerificationMethodAttributeTypeUuid];

  if (!payer || !insuranceCode || !verifiedAccreditationStatuses.has(status) || !isValidIsoDateTime(checkedAt)) {
    return false;
  }

  if (payer === peruInsuranceSisConceptUuid) {
    const temporaryCode = normalizeTemporarySisCode(insuranceCode);
    return (
      independentSisVerificationMethods.has(method) &&
      (!looksLikeTemporarySisCode(insuranceCode) || !!temporaryCode) &&
      (!temporaryCode || getTemporaryIdentifierCode(values, identifierTypes) === temporaryCode)
    );
  }

  return method === 'siteds' && !normalizeTemporarySisCode(insuranceCode);
}

function isCleanReplacementOfSiasisAdt(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
) {
  const attributes = values?.attributes ?? {};
  const payer = attributes[peruInsuranceTypeAttributeTypeUuid];
  const insuranceCode = attributes[peruInsuranceCodeAttributeTypeUuid]?.trim() ?? '';
  const status = attributes[peruInsuranceAccreditationStatusAttributeTypeUuid] ?? '';
  const checkedAt = attributes[peruInsuranceAccreditationCheckedAtAttributeTypeUuid]?.trim() ?? '';
  const method = attributes[peruInsuranceVerificationMethodAttributeTypeUuid]?.trim() ?? '';

  if (method || checkedAt || status === peruInsuranceAccreditationActiveConceptUuid) {
    return false;
  }

  if (payer === peruInsuranceSisConceptUuid) {
    if (status !== peruInsuranceAccreditationNotConsultedConceptUuid) {
      return false;
    }

    const temporaryCode = normalizeTemporarySisCode(insuranceCode);
    return (
      (!looksLikeTemporarySisCode(insuranceCode) || !!temporaryCode) &&
      (!temporaryCode || getTemporaryIdentifierCode(values, identifierTypes) === temporaryCode)
    );
  }

  return !normalizeTemporarySisCode(insuranceCode) && !status;
}

/**
 * Active E coverage always requires a complete trusted evidence bundle.
 * Persisted `siasis-adt` is additionally protected as one attestation, so a
 * reopened form cannot keep only part of it after an edit.
 */
export function requiresSiasisAdtBundleReview(
  values: FormValues | undefined,
  identifierTypes: Array<Pick<PatientIdentifierType, 'fieldName' | 'uuid'>>,
  initialValues?: FormValues,
) {
  const attributes = values?.attributes ?? {};
  const insuranceCode = attributes[peruInsuranceCodeAttributeTypeUuid]?.trim();
  const status = attributes[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const isActiveTemporarySisCoverage =
    status === peruInsuranceAccreditationActiveConceptUuid && looksLikeTemporarySisCode(insuranceCode);

  // Active E coverage is fail-closed regardless of whether it was just entered,
  // reopened, or imported. An E code is not evidence on its own.
  if (isActiveTemporarySisCoverage) {
    const canonicalTemporaryCode = normalizeTemporarySisCode(insuranceCode);
    if (
      attributes[peruInsuranceTypeAttributeTypeUuid] !== peruInsuranceSisConceptUuid ||
      !canonicalTemporaryCode ||
      getTemporaryIdentifierCode(values, identifierTypes) !== canonicalTemporaryCode ||
      !hasTrustedSisVerificationEvidence(
        attributes[peruInsuranceAccreditationCheckedAtAttributeTypeUuid],
        attributes[peruInsuranceVerificationMethodAttributeTypeUuid],
      )
    ) {
      return true;
    }
  }

  const rawMethod = attributes[peruInsuranceVerificationMethodAttributeTypeUuid];
  const claimsSiasisAdt = rawMethod?.trim() === peruTemporarySisSiasisVerificationMethod;

  if (
    claimsSiasisAdt &&
    !isCompleteActiveSisBundle(values, identifierTypes, siasisAdtOnlyMethod)
  ) {
    return true;
  }

  const initialMethod = initialValues?.attributes?.[peruInsuranceVerificationMethodAttributeTypeUuid];
  if (initialMethod?.trim() !== peruTemporarySisSiasisVerificationMethod) {
    return false;
  }

  const currentSnapshot = getSiasisAdtProtectedSnapshot(values, identifierTypes);
  const initialSnapshot = getSiasisAdtProtectedSnapshot(initialValues, identifierTypes);
  const unchanged = Object.keys(initialSnapshot).every(
    (key) =>
      currentSnapshot[key as keyof typeof currentSnapshot] === initialSnapshot[key as keyof typeof initialSnapshot],
  );

  if (unchanged) {
    return false;
  }

  // A fresh result from a known verification workflow, or an atomic payer
  // replacement that removed every old E/evidence field, supersedes the local
  // attestation. Partial/free-text mutations remain blocked.
  const checkedAtChanged = currentSnapshot.checkedAt !== initialSnapshot.checkedAt;
  return !(
    (checkedAtChanged && isCompleteIndependentVerification(values, identifierTypes)) ||
    isCleanReplacementOfSiasisAdt(values, identifierTypes)
  );
}
