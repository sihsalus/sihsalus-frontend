import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { createClinicalDashboardLink } from '@openmrs/esm-patient-common-lib';
import type { ComponentProps } from 'react';
import { credCourseLifePrivilege, credNeonatalPrivilege } from '../constants';
import { neonatalCareDashboardMeta, wellChildCareNavGroup } from '../dashboard.meta';

const ClinicalLink = createClinicalDashboardLink({
  ...neonatalCareDashboardMeta,
  showWhenExpression: wellChildCareNavGroup.showWhenExpression,
});

export default function NeonatalCareLink(props: ComponentProps<typeof ClinicalLink>) {
  const session = useSession();
  const canView = Boolean(
    session?.authenticated &&
      session.user?.uuid &&
      [credCourseLifePrivilege, credNeonatalPrivilege].every((privilege) => userHasAccess(privilege, session.user)),
  );
  return canView ? <ClinicalLink {...props} /> : null;
}
