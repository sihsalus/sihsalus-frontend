import type { ConsultaExternaTabId } from './consulta-externa-tabs';
import type { OutpatientScheduledAppointment } from './outpatient-next-appointment.resource';
import type { OutpatientClinicalRecordIssue, OutpatientVisitSummary } from './outpatient-visit-summary.resource';
import {
  hasOutpatientPatientInstructions,
  hasOutpatientRecetaUnicaContent,
  isOutpatientRecetaUnicaClinicallyReady,
} from './outpatient-visit-summary-pdf';

/**
 * A datum an outpatient document needs before it can be produced. Each one is
 * named so the modal can tell the clinician what to register and, when the
 * Consulta Externa dashboard owns it, which tab to register it in.
 */
export type OutpatientDocumentRequirementId =
  | 'clinicalContent'
  | 'clinicalEncounter'
  | 'ambiguousClinicalEncounter'
  | 'primaryDiagnosis'
  | 'primaryDiagnosisCie10'
  | 'responsibleProfessional'
  | 'followUpDate'
  | 'therapeuticIndications'
  | 'medications'
  | 'medicationsByResponsibleProfessional';

export interface OutpatientDocumentRequirement {
  id: OutpatientDocumentRequirementId;
  /** Omitted when the datum is not registered from this dashboard. */
  tab?: ConsultaExternaTabId;
}

const clinicalRecordIssueRequirements: Record<OutpatientClinicalRecordIssue, OutpatientDocumentRequirement> = {
  'canonical-encounter-missing': { id: 'clinicalEncounter', tab: 'soap' },
  'canonical-encounter-ambiguous': { id: 'ambiguousClinicalEncounter' },
  'primary-diagnosis-missing-or-ambiguous': { id: 'primaryDiagnosis', tab: 'diagnosis' },
  'primary-diagnosis-cie10-mapping-missing': { id: 'primaryDiagnosisCie10', tab: 'diagnosis' },
  'responsible-provider-missing-or-ambiguous': { id: 'responsibleProfessional', tab: 'soap' },
};

function dedupeById(requirements: OutpatientDocumentRequirement[]): OutpatientDocumentRequirement[] {
  const seen = new Set<OutpatientDocumentRequirementId>();
  return requirements.filter((requirement) => {
    if (seen.has(requirement.id)) return false;
    seen.add(requirement.id);
    return true;
  });
}

export function getMissingVisitSummaryRequirements(summary: OutpatientVisitSummary): OutpatientDocumentRequirement[] {
  return summary.hasClinicalContent ? [] : [{ id: 'clinicalContent', tab: 'anamnesis' }];
}

/**
 * The patient instructions sheet needs any one of a follow-up date, therapeutic
 * indications or medications, so when it cannot be produced all three are
 * pending and all three are registered in the treatment plan.
 */
export function getMissingPatientInstructionsRequirements(
  summary: OutpatientVisitSummary,
  scheduledAppointment?: OutpatientScheduledAppointment | null,
): OutpatientDocumentRequirement[] {
  if (hasOutpatientPatientInstructions(summary, scheduledAppointment)) return [];
  return [
    { id: 'followUpDate', tab: 'treatment' },
    { id: 'therapeuticIndications', tab: 'treatment' },
    { id: 'medications', tab: 'treatment' },
  ];
}

export function getMissingRecetaUnicaRequirements(summary: OutpatientVisitSummary): OutpatientDocumentRequirement[] {
  const requirements: OutpatientDocumentRequirement[] = [];

  if (!isOutpatientRecetaUnicaClinicallyReady(summary)) {
    requirements.push(...summary.clinicalRecordIssues.map((issue) => clinicalRecordIssueRequirements[issue]));
    // A dated clinical encounter is part of the contract but is not reported as
    // an issue on its own, so an unexplained failure still names it.
    if (!requirements.length) requirements.push({ id: 'clinicalEncounter', tab: 'soap' });
  }

  if (!hasOutpatientRecetaUnicaContent(summary)) {
    requirements.push({ id: 'medicationsByResponsibleProfessional', tab: 'treatment' });
  }

  return dedupeById(requirements);
}
