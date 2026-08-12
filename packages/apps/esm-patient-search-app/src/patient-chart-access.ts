import { userHasAccess, useSession } from '@openmrs/esm-framework';

export const patientChartPrivilege = 'app:hoja.clinica';

/**
 * Patient-search results must fail closed while the session is loading and for
 * administrative users who can search for a patient but cannot open the chart.
 */
export function usePatientChartAccess() {
  const { user } = useSession();

  return Boolean(user && userHasAccess(patientChartPrivilege, user));
}
