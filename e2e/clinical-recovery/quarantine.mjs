export const clinicalRecoveryQuarantineMessage =
  'Clinical recovery is quarantined: coordinated fixtures, account isolation, privacy review and verified cleanup are required before activation.';

// Deliberately no environment-variable or CLI bypass. Promotion requires code review.
export function blockClinicalRecovery() {
  throw new Error(clinicalRecoveryQuarantineMessage);
}
