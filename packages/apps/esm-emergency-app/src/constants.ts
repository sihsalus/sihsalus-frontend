/**
 * Non-configurable constants for the Emergency module.
 *
 * All configurable values (UUIDs, priorities, encounter types, etc.) live in
 * config-schema.ts and are accessed via useConfig()/useEmergencyConfig() hooks.
 *
 * This file only contains truly static values that must NOT change per deployment.
 */

/** OpenMRS module identifier — must match the `name` field in package.json */
export const moduleName = '@sihsalus/esm-emergency-app';

/** Short name used as default featureName in getAsyncLifecycle options */
export const emergency = 'emergency';

/** OpenMRS REST API date format (ISO 8601 with timezone offset) */
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

/** Modal identifiers — used in showModal() and index.ts registration */
export const MODALS = {
  SERVE_PATIENT: 'emergency-serve-patient-modal',
  REMOVE_QUEUE_ENTRY: 'emergency-remove-queue-entry-modal',
  MOVE_QUEUE_ENTRY: 'emergency-move-queue-entry-modal',
  TRANSITION_QUEUE_ENTRY: 'emergency-transition-queue-entry-modal',
  EDIT_QUEUE_ENTRY: 'emergency-edit-queue-entry-modal',
  UNDO_TRANSITION: 'emergency-undo-transition-modal',
  CLEAR_QUEUE_ENTRIES: 'emergency-clear-queue-entries-modal',
  CONFIRM_ACTION: 'emergency-queue-confirm-action-modal',
} as const;

/** Workspace identifiers — used in launchWorkspace() and index.ts registration */
export const WORKSPACES = {
  EMERGENCY_WORKFLOW: 'emergency-workflow-workspace',
  /** Triage vitals are captured with the shared vitals workspace (esm-patient-vitals-app, workspaces2) */
  TRIAGE_VITALS_FORM: 'patient-vitals-biometrics-form-workspace',
  ATTENTION_FORM: 'attention-form-workspace',
} as const;
