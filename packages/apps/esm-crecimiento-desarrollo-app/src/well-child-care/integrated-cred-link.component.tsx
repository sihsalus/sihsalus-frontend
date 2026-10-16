import { useSession } from '@openmrs/esm-framework';
import { createClinicalDashboardLink } from '@openmrs/esm-patient-common-lib';
import type { ComponentProps } from 'react';
import { integratedCredDashboardMeta, wellChildCareNavGroup } from '../dashboard.meta';
import { canReadIntegratedCred } from './integrated-cred-tabs';

const ClinicalLink = createClinicalDashboardLink({
  ...integratedCredDashboardMeta,
  showWhenExpression: wellChildCareNavGroup.showWhenExpression,
});

export default function IntegratedCredLink(props: ComponentProps<typeof ClinicalLink>) {
  const session = useSession();
  return canReadIntegratedCred(session) ? <ClinicalLink {...props} /> : null;
}
