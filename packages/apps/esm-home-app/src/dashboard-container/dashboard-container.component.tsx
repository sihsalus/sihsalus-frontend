import {
  ExtensionSlot,
  isDesktop,
  useAssignedExtensions,
  useConfig,
  useLayoutType,
  WorkspaceContainer,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useParams } from 'react-router-dom';

import { type HomeConfig } from '../config-schema';
import type { DashboardConfig } from '../types/index';

import styles from './dashboard-container.scss';

export default function DashboardContainer() {
  const params = useParams();
  const layout = useLayoutType();
  const { leftNavMode } = useConfig<HomeConfig>();
  const assignedExtensions = useAssignedExtensions('homepage-dashboard-slot');

  const ungroupedDashboards = assignedExtensions.map((e) => e.meta).filter((e) => Object.keys(e).length) || [];
  const dashboards = ungroupedDashboards as Array<DashboardConfig>;
  const activeDashboard = dashboards.find((dashboard) => dashboard.name === params?.dashboard) || dashboards[0];

  return (
    <div className={styles.homePageWrapper}>
      <section
        className={classNames([
          isDesktop(layout) ? styles.dashboardContainer : styles.dashboardContainerTablet,
          leftNavMode === 'normal' ? styles.hasLeftNav : '',
        ])}
      >
        {isDesktop(layout) && <ExtensionSlot name="home-sidebar-slot" key={layout} />}
        <ExtensionSlot
          className={styles.dashboardView}
          name={activeDashboard?.slot}
          state={{ dashboardTitle: activeDashboard?.name }}
        />
      </section>
      {/\/home(\/|$)/.test(window.location.pathname) ? <WorkspaceContainer overlay contextKey="home" /> : null}
    </div>
  );
}
