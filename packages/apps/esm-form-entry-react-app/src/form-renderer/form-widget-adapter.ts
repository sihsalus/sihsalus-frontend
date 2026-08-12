import type { OpenmrsResource, Visit } from '@openmrs/esm-framework';

import type { FormWidgetProps, LegacyFormWidgetProps, NormalizedFormWidgetProps } from '../types';

function isLegacyFormWidgetProps(props: FormWidgetProps): props is LegacyFormWidgetProps {
  return 'view' in props || 'visitStartDatetime' in props || 'isOffline' in props;
}

function toVisitFromLegacyProps({
  visitStartDatetime,
  visitStopDatetime,
  visitTypeUuid,
  visitUuid,
}: LegacyFormWidgetProps): Visit | undefined {
  if (!visitUuid) {
    return undefined;
  }

  return {
    uuid: visitUuid,
    startDatetime: visitStartDatetime,
    stopDatetime: visitStopDatetime ?? null,
    visitType: visitTypeUuid ? ({ uuid: visitTypeUuid, display: '' } as OpenmrsResource) : undefined,
    encounters: [],
  } satisfies Visit;
}

export function normalizeFormWidgetProps(props: FormWidgetProps): NormalizedFormWidgetProps {
  if (isLegacyFormWidgetProps(props)) {
    const visit = toVisitFromLegacyProps(props);

    return {
      additionalProps: props.additionalProps,
      closeWorkspace: props.closeWorkspace,
      closeWorkspaceWithSavedChanges: props.closeWorkspaceWithSavedChanges,
      clinicalFormsWorkspaceName: props.clinicalFormsWorkspaceName,
      encounterUuid: props.encounterUuid,
      formUuid: props.formUuid,
      handleEncounterCreate: props.handleEncounterCreate,
      onBeforeEncounterSave: props.onBeforeEncounterSave,
      handleOnValidate: props.handleOnValidate,
      handlePostResponse: props.handlePostResponse,
      hideControls: props.hideControls,
      hidePatientBanner: props.hidePatientBanner,
      patient: props.patient,
      patientUuid: props.patientUuid,
      preFilledQuestions: props.preFilledQuestions,
      setHasUnsavedChanges: props.promptBeforeClosing
        ? (hasUnsavedChanges) => props.promptBeforeClosing?.(() => hasUnsavedChanges)
        : undefined,
      showDiscardSubmitButtons: props.showDiscardSubmitButtons,
      visit,
      visitStartDatetime: visit?.startDatetime,
      visitStopDatetime: visit?.stopDatetime ?? undefined,
      visitUuid: visit?.uuid,
    };
  }

  return {
    ...props,
    visit: props.visit,
    visitStartDatetime: props.visit?.startDatetime,
    visitStopDatetime: props.visit?.stopDatetime ?? undefined,
    visitUuid: props.visit?.uuid ?? props.visitUuid,
  };
}
