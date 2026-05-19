import {
  defineConfigSchema,
  getAsyncLifecycle,
  getSyncLifecycle,
} from "@openmrs/esm-framework";

import { configSchema } from "./config-schema";
import { createDashboardLink } from "./createDashboardLink.component";
import { dashboardMeta } from "./dashboard.meta";
import homeAppMenuItemComponent from "./home-app-menu-item.component";
import homeWidgetDashboardComponent from "./home-page-widgets/home-page-widgets.component";
import rootComponent from "./root.component";
import homeNavMenuComponent from "./side-menu/side-menu.component";

const moduleName = "@sihsalus/esm-home-app";
const pageName = "home";

const options = {
  featureName: pageName,
  moduleName,
};

export const importTranslation = require.context(
  "../translations",
  true,
  /.json$/,
  "lazy",
);

export const root = getSyncLifecycle(rootComponent, options);

export const homeNavMenu = getSyncLifecycle(homeNavMenuComponent, options);

export const homeWidgetDbLink = getSyncLifecycle(
  createDashboardLink(dashboardMeta),
  options,
);

export const homeWidgetDashboard = getSyncLifecycle(
  homeWidgetDashboardComponent,
  options,
);

export const homeAppMenuItem = getSyncLifecycle(
  homeAppMenuItemComponent,
  options,
);

export const globalHomeNavLink = getAsyncLifecycle(
  () => import("./global-home-nav-link.component"),
  options,
);

export const peruHomeActions = getAsyncLifecycle(
  () => import("./peru-home-actions/peru-home-actions.component"),
  options,
);

// t('home', 'Home')
export const homePageHeader = getAsyncLifecycle(
  () => import("./page-header/page-header.component"),
  options,
);

export const metrics = getAsyncLifecycle(
  () => import("./metrics/metrics.component"),
  options,
);

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}
