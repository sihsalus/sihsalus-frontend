import { useAssignedExtensions } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import { socialHistoryDashboardMeta } from '../dashboard.meta';
import { moduleName } from '../utils/constants';

const SocialHistoryLink = createDashboardLink({ ...socialHistoryDashboardMeta, moduleName });

export default function AntecedentsDashboardLink({ basePath }: { basePath: string }) {
  const dashboards = useAssignedExtensions('patient-chart-dashboard-slot');
  // Assignments already reflect permissions and implementer overrides. Keep the
  // original social-history route accessible when the conditions entry is absent.
  return dashboards.some(({ id }) => id === 'conditions-summary-dashboard') ? null : (
    <SocialHistoryLink basePath={basePath} />
  );
}
