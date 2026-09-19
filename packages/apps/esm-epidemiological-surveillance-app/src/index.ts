import { defineConfigSchema, getSyncLifecycle } from "@openmrs/esm-framework";
import { configSchema } from "./config-schema";
import { epidemiologicalSurveillanceRoute } from "./constants";
import { createLeftPanelLink } from "./left-panel-link.component";
import rootComponent from "./root.component";
import { setupSurveillanceSync } from "./offline";

export const importTranslation = require.context(
  "../translations",
  false,
  /.json$/,
  "lazy",
);

const moduleName = "@sihsalus/esm-epidemiological-surveillance-app";

const options = {
  featureName: "epidemiological-surveillance",
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
  setupSurveillanceSync();
}

export const root = getSyncLifecycle(rootComponent, options);

// t('epidemiologicalSurveillance', 'Epidemiological Surveillance')
export const epidemiologicalSurveillanceDashboardLink = getSyncLifecycle(
  createLeftPanelLink({
    name: epidemiologicalSurveillanceRoute,
    title: "epidemiologicalSurveillance",
  }),
  options,
);
