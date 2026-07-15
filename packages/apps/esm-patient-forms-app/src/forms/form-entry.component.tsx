import {
  type Encounter,
  ExtensionSlot,
  type FetchResponse,
  openmrsFetch,
  useConfig,
  useConnectivity,
  type Visit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type FormRendererProps, invalidateVisitAndEncounterData } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { type ConfigObject } from '../config-schema';
import HtmlFormEntryWrapper from '../htmlformentry/html-form-entry-wrapper.component';
import { type Form } from '../types';

import { toHtmlForm } from './form-entry.resources';

const encounterVisitRep = 'custom:(visit:(uuid,startDatetime,stopDatetime,visitType:(uuid,name)))';

type FormWidgetState = FormRendererProps & {
  view: 'form';
  visitTypeUuid?: string | null;
  visitStartDatetime?: string | null;
  visitStopDatetime?: string | null;
  isOffline: boolean;
  promptBeforeClosing: (fn: () => boolean) => void;
};

export interface FormEntryProps {
  form: Form;
  encounterUuid?: string;
  patientUuid: string;
  patient: fhir.Patient | null;
  visitContext: Visit | null;
  mutateVisitContext: (() => void) | null;
  additionalProps?: Record<string, unknown>;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
  closeWorkspaceWithSavedChanges?: () => void;
  promptBeforeClosing?: (fn: () => boolean) => void;
  handlePostResponse?: (encounter: Encounter) => void;
  handleEncounterCreate?: FormRendererProps['handleEncounterCreate'];
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  preFilledQuestions?: Record<string, string>;
  renderAsWorkspace2?: boolean;
}

const FormEntry: React.FC<FormEntryProps> = ({
  form,
  encounterUuid,
  patientUuid,
  patient,
  visitContext,
  mutateVisitContext,
  additionalProps,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
  handlePostResponse,
  handleEncounterCreate,
  hideControls,
  hidePatientBanner,
  preFilledQuestions,
  renderAsWorkspace2 = true,
}) => {
  const formUuid = form.uuid;
  const { htmlFormEntryForms } = useConfig<ConfigObject>();
  const { data: encounterData, isLoading: isLoadingEncounterVisit } = useSWR<
    FetchResponse<{ visit: Visit | null }>,
    Error
  >(encounterUuid ? `/ws/rest/v1/encounter/${encounterUuid}?v=${encounterVisitRep}` : null, openmrsFetch);
  const encounterVisit = encounterData?.data?.visit ?? null;
  const effectiveVisitContext = encounterUuid
    ? isLoadingEncounterVisit
      ? visitContext
      : encounterVisit
    : visitContext;
  const visitUuid = effectiveVisitContext?.uuid ?? null;
  const htmlForm = toHtmlForm(form, htmlFormEntryForms);
  const isHtmlForm = htmlForm != null;
  const isOnline = useConnectivity();
  const { mutate: globalMutate } = useSWRConfig();
  const { t } = useTranslation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const closeWorkspaceRef = useRef(closeWorkspace);
  const mutateVisitContextRef = useRef(mutateVisitContext);
  const handlePostResponseRef = useRef(handlePostResponse);

  useEffect(() => {
    closeWorkspaceRef.current = closeWorkspace;
  }, [closeWorkspace]);

  useEffect(() => {
    mutateVisitContextRef.current = mutateVisitContext;
  }, [mutateVisitContext]);

  useEffect(() => {
    handlePostResponseRef.current = handlePostResponse;
  }, [handlePostResponse]);

  const handleCloseWorkspace = useCallback(() => {
    return closeWorkspaceRef.current();
  }, []);

  const handleCloseWorkspaceWithSavedChanges = useCallback(() => {
    mutateVisitContextRef.current?.();
    invalidateVisitAndEncounterData(globalMutate, patientUuid);
    if (closeWorkspaceWithSavedChanges) {
      closeWorkspaceWithSavedChanges();
      return Promise.resolve(true);
    }
    return closeWorkspaceRef.current({ discardUnsavedChanges: true });
  }, [closeWorkspaceWithSavedChanges, globalMutate, patientUuid]);

  const handlePromptBeforeClosing = useCallback(
    (fn: () => boolean) => {
      if (promptBeforeClosing) {
        promptBeforeClosing(fn);
        return;
      }

      setHasUnsavedChanges(fn());
    },
    [promptBeforeClosing],
  );

  const handleSetHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const handleFormPostResponse = useCallback((encounter: Encounter) => {
    handlePostResponseRef.current?.(encounter);
  }, []);

  const state = useMemo(
    () =>
      ({
        view: 'form',
        formUuid: formUuid ?? null,
        visitUuid,
        visitTypeUuid: effectiveVisitContext?.visitType?.uuid ?? null,
        visitStartDatetime: effectiveVisitContext?.startDatetime ?? null,
        visitStopDatetime: effectiveVisitContext?.stopDatetime ?? null,
        isOffline: !isOnline,
        patientUuid: patientUuid ?? null,
        patient,
        encounterUuid: encounterUuid ?? '',
        visit: effectiveVisitContext ?? null,
        additionalProps: additionalProps ?? {},
        handlePostResponse: handleFormPostResponse,
        handleEncounterCreate,
        hideControls,
        hidePatientBanner,
        preFilledQuestions,
        closeWorkspace: handleCloseWorkspace,
        closeWorkspaceWithSavedChanges: handleCloseWorkspaceWithSavedChanges,
        promptBeforeClosing: handlePromptBeforeClosing,
        setHasUnsavedChanges: handleSetHasUnsavedChanges,
      }) satisfies FormWidgetState,
    [
      additionalProps,
      effectiveVisitContext,
      encounterUuid,
      formUuid,
      handleCloseWorkspace,
      handleCloseWorkspaceWithSavedChanges,
      handleFormPostResponse,
      handleEncounterCreate,
      handlePromptBeforeClosing,
      handleSetHasUnsavedChanges,
      hideControls,
      hidePatientBanner,
      isOnline,
      patient,
      patientUuid,
      preFilledQuestions,
      visitUuid,
    ],
  );

  const htmlFormEntryUrl = useMemo(() => {
    if (!htmlForm) {
      return null;
    }

    const uiPage = encounterUuid ? htmlForm.formEditUiPage : htmlForm.formUiPage;
    const url = `${window.openmrsBase}/htmlformentryui/htmlform/${uiPage}.page?`;
    const searchParams = new URLSearchParams();
    searchParams.append('patientId', patientUuid);

    if (visitUuid) {
      searchParams.append('visitId', visitUuid);
    }

    if (encounterUuid) {
      searchParams.append('encounterId', encounterUuid);
    }

    if (htmlForm.formUiResource) {
      searchParams.append('definitionUiResource', htmlForm.formUiResource);
    } else {
      searchParams.append('formUuid', htmlForm.formUuid);
    }

    searchParams.append('returnUrl', 'post-message:close-workspace');
    return url + searchParams.toString();
  }, [encounterUuid, htmlForm, patientUuid, visitUuid]);

  const showFormAndLoadedData = Boolean(form && patientUuid && !isLoadingEncounterVisit);

  const content = (
    <div>
      <ExtensionSlot name="visit-context-header-slot" state={{ patientUuid }} />
      {showFormAndLoadedData &&
        (isHtmlForm ? (
          <HtmlFormEntryWrapper
            src={htmlFormEntryUrl}
            closeWorkspaceWithSavedChanges={state.closeWorkspaceWithSavedChanges}
          />
        ) : (
          <ExtensionSlot key={state.formUuid} name="form-widget-slot" state={state} />
        ))}
    </div>
  );

  if (!renderAsWorkspace2) {
    return content;
  }

  return (
    <Workspace2 title={form.display ?? t('clinicalForm', 'Clinical form')} hasUnsavedChanges={hasUnsavedChanges}>
      {content}
    </Workspace2>
  );
};

export default FormEntry;
