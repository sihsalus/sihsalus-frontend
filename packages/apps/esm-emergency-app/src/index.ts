/**
 * @module index
 *
 * Entrypoint for the Emergency microfrontend (@sihsalus/esm-emergency-app).
 *
 * This module operates in two modes simultaneously:
 * - **Standalone**: Route `/openmrs/spa/emergency` renders the full emergency dashboard
 *   with custom ExtensionSlots (header, alerts, metrics, queue table, priority cards).
 * - **Integrated**: Extensions inject into `@openmrs/esm-service-queues-app` slots when
 *   the emergency location is selected. These use `useIsEmergencyLocation()` for
 *   conditional rendering.
 *
 * Exports registered via `getAsyncLifecycle()`:
 * - Pages: root, emergencyHome
 * - Workspaces: emergencyWorkflow, attentionForm (triage vitals use the shared vitals workspace)
 * - Extensions: header, alerts, metrics, queue table, priority cards (standalone + integrated)
 * - Modals: serve, remove, transition, move, clear queue entries
 */
import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { createDashboardLink } from './createDashboardLink.component';
import { dashboardMeta } from './dashboard.meta';

const moduleName = '@sihsalus/esm-emergency-app';

const options = {
  featureName: 'emergency',
  moduleName,
};

/**
 * This tells the app shell how to obtain translation files: that they
 * are JSON files in the directory `../translations` (which you should
 * see in the directory structure).
 */
export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

/**
 * This function performs any setup that should happen at microfrontend
 * load-time (such as defining the config schema) and then returns an
 * object which describes how the React application(s) should be
 * rendered.
 */
export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

/**
 * Emergency Root Component
 * Renders the emergency dashboard (internal use only, not registered as extension)
 * Kept for potential internal use or future integration
 */
export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const emergencyDashboard = getAsyncLifecycle(
  () => import('./emergency-dashboard/emergency-dashboard.component'),
  options,
);

export const emergencyDashboardLink = getSyncLifecycle(createDashboardLink(dashboardMeta), {
  featureName: 'emergency-dashboard-link',
  moduleName,
});

/**
 * Emergency Home Page
 * Standalone home page for emergency department with custom slots
 */
export const emergencyHome = getAsyncLifecycle(() => import('./emergency-home/emergency-home.component'), options);

/**
 * Emergency Workflow Workspace
 * Integrated workspace for the complete emergency workflow
 */
export const emergencyWorkflowWorkspace = getAsyncLifecycle(
  () => import('./emergency-workflow/emergency-workflow-workspace'),
  options,
);

/**
 * Emergency Metrics Extensions (Legacy - kept for backward compatibility)
 * These are registered as extensions in the emergency-metrics-slot
 */
export const totalPatientsCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/emergency-metrics/metrics-cards/total-patients-card.extension'),
  options,
);

export const priorityBreakdownCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/emergency-metrics/metrics-cards/priority-breakdown-card.extension'),
  options,
);

export const averageWaitTimeCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/emergency-metrics/metrics-cards/average-wait-time-card.extension'),
  options,
);

/**
 * Compact Metrics Extensions
 * These are registered as extensions in the emergency-compact-metrics-slot
 */
export const totalActiveCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/compact-metrics/metrics-cards/total-active-card.extension'),
  options,
);

export const waitingTriageCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/compact-metrics/metrics-cards/waiting-triage-card.extension'),
  options,
);

export const avgWaitTimeCompactCard = getAsyncLifecycle(
  () => import('./emergency-dashboard/compact-metrics/metrics-cards/avg-wait-time-card.extension'),
  options,
);

/**
 * Service Queues Integration Extensions
 *
 * These extensions inject emergency-specific components into service-queues-app
 * when emergency location is selected. They are registered in service-queues slots.
 */
export const emergencyHeaderExtension = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/emergency-header.extension'),
  {
    featureName: 'emergency-header-extension',
    moduleName,
  },
);

export const emergencyAlertsExtension = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/emergency-alerts.extension'),
  {
    featureName: 'emergency-alerts-extension',
    moduleName,
  },
);

/**
 * Priority Card Extensions for emergency-priority-card-slot (standalone dashboard)
 */
export const priorityICard = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/priority-cards/emergency-priority-i-card-wrapper.extension'),
  options,
);

export const priorityIICard = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/priority-cards/emergency-priority-ii-card-wrapper.extension'),
  options,
);

export const priorityIIICard = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/priority-cards/emergency-priority-iii-card-wrapper.extension'),
  options,
);

export const priorityIVCard = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/priority-cards/emergency-priority-iv-card-wrapper.extension'),
  options,
);

/**
 * Emergency Priority Cards Container for Service Queues Integration
 *
 * Single extension that renders all 4 priority cards together in service-queues-metrics-slot.
 * This ensures they appear in a dedicated row below the standard metrics.
 */
export const emergencyPriorityCardsContainer = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/priority-cards/emergency-priority-cards-container.extension'),
  {
    featureName: 'emergency-priority-cards-container',
    moduleName,
  },
);

export const emergencyMetricsExtension = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/emergency-metrics.extension'),
  {
    featureName: 'emergency-metrics-extension',
    moduleName,
  },
);

export const emergencyQueueTableExtension = getAsyncLifecycle(
  () => import('./extensions/service-queues-integration/emergency-queue-table.extension'),
  {
    featureName: 'emergency-queue-table-extension',
    moduleName,
  },
);

/**
 * Modals
 */
export const servePatientModal = getAsyncLifecycle(() => import('./modals/serve-patient.modal'), options);

export const removeQueueEntryModal = getAsyncLifecycle(() => import('./modals/remove-queue-entry.modal'), options);

export const transitionQueueEntryModal = getAsyncLifecycle(
  () => import('./modals/transition-queue-entry.modal'),
  options,
);

export const moveQueueEntryModal = getAsyncLifecycle(() => import('./modals/move-queue-entry.modal'), options);

export const clearQueueEntriesModal = getAsyncLifecycle(() => import('./modals/clear-queue-entries.modal'), options);

/**
 * Attention Form Workspace — Emergency medical attention (diagnosis, treatment, exams)
 */
export const attentionFormWorkspace = getAsyncLifecycle(() => import('./attention/attention-form.workspace'), options);
