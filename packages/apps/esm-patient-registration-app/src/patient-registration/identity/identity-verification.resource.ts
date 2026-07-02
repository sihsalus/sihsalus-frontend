import { documentTypeConceptUuids } from './identity-documents';

export interface IdentityVerificationRequest {
  documentTypeConceptUuid: string;
  documentNumber: string;
  givenName?: string;
  familyName?: string;
  familyName2?: string;
  birthdate?: string;
}

export type IdentityVerificationOutcome =
  | { status: 'verified'; source: 'reniec'; verifiedAt: string }
  | { status: 'mismatch'; source: 'reniec'; verifiedAt: string; observation: string }
  | { status: 'unavailable' }
  | { status: 'not-applicable' };

/**
 * Verification step run before promoting a person to patient (and, eventually, before
 * registering a new patient with a DNI).
 *
 * The real implementation must call the identitylookup OMOD once it is deployed on the
 * backend; external credentials must never reach the frontend. Until then this always
 * resolves to `unavailable` for DNI (registration continues, identity stays
 * "No verificado") and `not-applicable` for every other document type, since RENIEC can
 * only vouch for Peruvian DNIs.
 */
export async function verifyIdentityForPromotion(
  request: IdentityVerificationRequest,
): Promise<IdentityVerificationOutcome> {
  if (request.documentTypeConceptUuid !== documentTypeConceptUuids.dni) {
    return { status: 'not-applicable' };
  }

  // TODO(identitylookup OMOD): replace with the backend endpoint when deployed.
  return { status: 'unavailable' };
}
