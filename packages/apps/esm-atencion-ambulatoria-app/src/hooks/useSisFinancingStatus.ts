import { useVisit } from '@openmrs/esm-framework';
import {
  fetchVisitInsurance,
  getSisFinancingState,
  type SisFinancingState,
  type VisitInsurance,
} from '@openmrs/esm-patient-common-lib';
import useSWR from 'swr';

export interface SisFinancingStatus {
  financingState: SisFinancingState | null;
  hasFinanciador: boolean;
  requiresRegularization: boolean;
  isLoading: boolean;
  error?: unknown;
  visitUuid: string | null;
}

/**
 * Estado de financiamiento SIS de la visita activa, con la misma semántica que
 * el gating de triaje: sin financiador definido o SIS no vigente implica
 * regularizar en Caja/Admisión. Un financiador distinto de SIS
 * ('notApplicable') no requiere regularización. Sin visita activa o ante un
 * error de red no se reclama regularización: la advertencia es informativa y
 * no debe bloquear con falsos positivos.
 */
export function useSisFinancingStatus(patientUuid: string): SisFinancingStatus {
  const { currentVisit } = useVisit(patientUuid);
  const visitUuid = currentVisit?.uuid ?? null;

  const { data, error, isLoading } = useSWR<VisitInsurance>(
    visitUuid ? ['sis-financing-status', visitUuid] : null,
    () => fetchVisitInsurance(visitUuid as string),
  );

  const financingState = data ? getSisFinancingState(data) : null;
  const hasFinanciador = Boolean(data?.financiadorUuid);
  const requiresRegularization = Boolean(
    data && (!hasFinanciador || (financingState !== 'active' && financingState !== 'notApplicable')),
  );

  return { financingState, hasFinanciador, requiresRegularization, isLoading, error, visitUuid };
}
