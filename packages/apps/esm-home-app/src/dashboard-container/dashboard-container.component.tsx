import {
  Extension,
  ExtensionSlot,
  isDesktop,
  useAssignedExtensions,
  useConfig,
  useLayoutType,
  useSession,
  WorkspaceContainer,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { type HomeConfig } from '../config-schema';
import type { DashboardConfig } from '../types/index';

import styles from './dashboard-container.scss';

export default function DashboardContainer() {
  const params = useParams();
  const layout = useLayoutType();
  const session = useSession();
  const { leftNavMode } = useConfig<HomeConfig>();
  const assignedExtensions = useAssignedExtensions('homepage-dashboard-slot');
  const sessionKey =
    session?.authenticated && session?.sessionId
      ? `${session.sessionId}:${session.user?.uuid ?? 'unknown'}`
      : 'anonymous';

  const ungroupedDashboards = assignedExtensions.map((e) => e.meta).filter((e) => Object.keys(e).length) || [];
  const dashboards = ungroupedDashboards as Array<DashboardConfig>;
  const activeDashboard = dashboards.find((dashboard) => dashboard.name === params?.dashboard) || dashboards[0];
  const workspaceContextKey =
    typeof params.dashboard === 'string' && activeDashboard?.name === params.dashboard
      ? `home/${params.dashboard}`
      : null;
  const dashboardState = useMemo(() => ({ dashboardTitle: activeDashboard?.name }), [activeDashboard?.name]);
  const usesApplicationDashboardSurface = Boolean(
    activeDashboard?.slot && activeDashboard.slot !== 'home-dashboard-slot',
  );

  return (
    <div className={styles.homePageWrapper}>
      <section
        className={classNames([
          isDesktop(layout) ? styles.dashboardContainer : styles.dashboardContainerTablet,
          leftNavMode === 'normal' ? styles.hasLeftNav : '',
        ])}
      >
        {isDesktop(layout) && <ExtensionSlot name="home-sidebar-slot" key={`${layout}-${sessionKey}`} />}
        {usesApplicationDashboardSurface ? (
          <ExtensionSlot
            className={styles.dashboardView}
            key={`${activeDashboard?.slot ?? 'dashboard'}-${sessionKey}`}
            name={activeDashboard?.slot}
          >
            {() => <Extension className={styles.applicationDashboardExtension} state={dashboardState} />}
          </ExtensionSlot>
        ) : (
          <ExtensionSlot
            className={styles.dashboardView}
            key={`${activeDashboard?.slot ?? 'dashboard'}-${sessionKey}`}
            name={activeDashboard?.slot}
            state={dashboardState}
          />
        )}
      </section>
      {workspaceContextKey ? <WorkspaceContainer overlay contextKey={workspaceContextKey} /> : null}
    </div>
  );
}
