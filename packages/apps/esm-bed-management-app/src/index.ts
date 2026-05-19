import {
  defineConfigSchema,
  getAsyncLifecycle,
  getSyncLifecycle,
} from "@openmrs/esm-framework";

import { configSchema } from "./config-schema";
import {
  bedManagementSidebarIcons,
  createLeftPanelLink,
} from "./left-panel-link.component";

const moduleName = "@sihsalus/esm-bed-management-app";

const options = {
  featureName: "bed-management",
  moduleName,
};

export const importTranslation = require.context(
  "../translations",
  false,
  /.json$/,
  "lazy",
);

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getAsyncLifecycle(
  () => import("./root.component"),
  options,
);

export const adminCardLink = getAsyncLifecycle(
  () => import("./admin-card-link.component"),
  options,
);

export const bedManagementAppMenuItem = getAsyncLifecycle(
  () => import("./bed-management-app-menu-item.component"),
  options,
);

// t('summary', 'Summary')
export const summaryLeftPanelLink = getSyncLifecycle(
  createLeftPanelLink({
    name: "bed-management",
    title: "summary",
    icon: bedManagementSidebarIcons.summary,
  }),
  options,
);

export const adminLeftPanelLink = getSyncLifecycle(
  createLeftPanelLink({
    name: "bed-administration",
    title: "wardAllocation",
    icon: bedManagementSidebarIcons.wardAllocation,
  }),
  options,
);

export const bedTypeLeftPanelLink = getSyncLifecycle(
  createLeftPanelLink({
    name: "bed-types",
    title: "bedTypes",
    icon: bedManagementSidebarIcons.bedTypes,
  }),
  options,
);

export const bedTagLeftPanelLink = getSyncLifecycle(
  createLeftPanelLink({
    name: "bed-tags",
    title: "bedTags",
    icon: bedManagementSidebarIcons.bedTags,
  }),
  options,
);
