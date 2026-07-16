import {
  ExtensionSlot,
  isDesktop,
  userHasAccess,
  useExtensionStore,
  useLayoutType,
  useSession,
  WorkspaceContainer,
} from '@openmrs/esm-framework';
import { RequireModulePrivilege } from '@sihsalus/esm-rbac';
import { useParams } from 'react-router-dom';
import { stockManagementDashboardPrivileges, stockManagementOverviewPrivilege } from '../constants';
import { type DashboardConfig } from '../types';
import DashboardView from './dashboard-view.component';
import styles from './home-dashboard.scss';

export default function Dashboard() {
  const params = useParams();
  const extensionStore = useExtensionStore();
  const layout = useLayoutType();
  const { user } = useSession();
  const ungroupedDashboards =
    extensionStore.slots['stock-page-dashboard-slot']?.assignedExtensions
      .map((e) => e.meta)
      .filter((e) => Object.keys(e).length) || [];
  const dashboards = ungroupedDashboards as Array<DashboardConfig>;
  const requestedDashboardName = params?.dashboard === 'stock-management' ? 'overview' : params?.dashboard;
  const requestedDashboard = dashboards.find((dashboard) => dashboard.name === requestedDashboardName);
  const accessibleDashboards = dashboards.filter((dashboard) => {
    const privilege = stockManagementDashboardPrivileges[dashboard.name];
    return privilege ? userHasAccess(privilege, user) : false;
  });
  const activeDashboard = requestedDashboard ?? accessibleDashboards[0] ?? dashboards[0];
  const requiredPrivilege =
    (params?.dashboard && stockManagementDashboardPrivileges[params.dashboard]) ??
    stockManagementDashboardPrivileges[activeDashboard?.name] ??
    stockManagementOverviewPrivilege;

  return (
    <RequireModulePrivilege privilege={requiredPrivilege}>
      <div className={styles.homePageWrapper}>
        <section className={isDesktop(layout) ? styles.dashboardContainer : styles.dashboardContainerTablet}>
          {isDesktop(layout) && <ExtensionSlot name="stock-sidebar-slot" key={layout} />}
          <DashboardView title={activeDashboard?.name} dashboardSlot={activeDashboard?.slot} />
        </section>
        <WorkspaceContainer overlay contextKey="stock-management" />
      </div>
    </RequireModulePrivilege>
  );
}
