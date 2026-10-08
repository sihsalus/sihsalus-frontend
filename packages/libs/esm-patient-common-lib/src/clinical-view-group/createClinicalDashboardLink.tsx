import { usePatient } from '@openmrs/esm-framework';

import { createDashboardLink } from '../dashboards/createDashboardLink';
import type { DashboardLinkConfig } from '../types';
import { usePatientEnrollment } from './clinical-view-group.resource';
import { evaluateShowWhenExpression } from './evaluate-show-when-expression';

/** A direct clinical navigation entry with the same visibility policy as a group. */
export const createClinicalDashboardLink = (config: DashboardLinkConfig & { showWhenExpression?: string }) => {
  const DashboardLink = createDashboardLink(config);

  return ({ basePath }: { basePath: string }) => {
    const { patient, isLoading: isPatientLoading } = usePatient();
    const { activePatientEnrollment, isLoading, error } = usePatientEnrollment(patient?.id);

    if (
      isPatientLoading ||
      isLoading ||
      error ||
      !patient ||
      !evaluateShowWhenExpression(config.showWhenExpression, patient, activePatientEnrollment)
    ) {
      return null;
    }

    return <DashboardLink basePath={basePath} />;
  };
};
