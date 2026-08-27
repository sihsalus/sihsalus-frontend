/**
 * Tab order of the Consulta Externa dashboard.
 *
 * A document that cannot be printed points the clinician at the tab that owns
 * the missing datum, so the order is declared once here instead of living as
 * literal indices spread across the dashboard.
 */
export const consultaExternaTabIds = [
  'triage',
  'anamnesis',
  'soap',
  'complementaryTests',
  'diagnosis',
  'treatment',
  'referral',
] as const;

export type ConsultaExternaTabId = (typeof consultaExternaTabIds)[number];

export function getConsultaExternaTabIndex(tabId: ConsultaExternaTabId): number {
  return consultaExternaTabIds.indexOf(tabId);
}
