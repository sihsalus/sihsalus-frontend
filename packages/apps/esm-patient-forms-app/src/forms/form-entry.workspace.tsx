import { type Encounter, ExtensionSlot, usePatient, type Visit, Workspace2 } from '@openmrs/esm-framework';
import {
  clinicalFormsWorkspace,
  type DefaultPatientWorkspaceProps,
  type FormRendererProps,
  type PatientWorkspace2DefinitionProps,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Form } from '../types';
import FormEntry from './form-entry.component';
import { type LegacyFormEntryInfo } from './legacy-form-entry';

interface LegacyWorkspaceAdapterProps {
  closeWorkspace: () => void;
  closeWorkspaceWithSavedChanges: () => void;
  promptBeforeClosing: (fn: () => boolean) => void;
  patientUuid: string;
}

interface FormEntryComponentProps extends LegacyWorkspaceAdapterProps {
  mutateForm?: () => void;
  formInfo?: LegacyFormEntryInfo;
  form?: Form;
  workspaceTitle?: string;
  encounterUuid?: string;
  additionalProps?: Record<string, unknown>;
  clinicalFormsWorkspaceName?: string;
  handlePostResponse?: (encounter: Encounter) => void;
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  preFilledQuestions?: Record<string, string>;
}

type LegacyWorkspaceProps = DefaultPatientWorkspaceProps & FormEntryComponentProps;
type Workspace2FormEntryProps = PatientWorkspace2DefinitionProps<FormEntryWorkspaceProps, object>;
type PatientFormEntryWorkspaceProps = Workspace2FormEntryProps | LegacyWorkspaceProps;

function isWorkspace2Props(props: PatientFormEntryWorkspaceProps): props is Workspace2FormEntryProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

function LegacyFormEntryWorkspace(props: FormEntryComponentProps) {
  const {
    patientUuid,
    clinicalFormsWorkspaceName = clinicalFormsWorkspace,
    mutateForm,
    formInfo,
    form,
    encounterUuid: workspaceEncounterUuid,
    additionalProps: workspaceAdditionalProps,
  } = props;
  const {
    encounterUuid = workspaceEncounterUuid,
    formUuid = form?.uuid,
    visitStartDatetime,
    visitStopDatetime,
    visitTypeUuid,
    visitUuid,
    additionalProps = workspaceAdditionalProps,
  } = formInfo || {};
  const closeWorkspaceRef = useRef(props.closeWorkspace);
  const closeWorkspaceWithSavedChangesRef = useRef(props.closeWorkspaceWithSavedChanges);
  const promptBeforeClosingRef = useRef(props.promptBeforeClosing);
  const mutateFormRef = useRef(mutateForm);

  useEffect(() => {
    closeWorkspaceRef.current = props.closeWorkspace;
  }, [props.closeWorkspace]);

  useEffect(() => {
    closeWorkspaceWithSavedChangesRef.current = props.closeWorkspaceWithSavedChanges;
  }, [props.closeWorkspaceWithSavedChanges]);

  useEffect(() => {
    promptBeforeClosingRef.current = props.promptBeforeClosing;
  }, [props.promptBeforeClosing]);

  useEffect(() => {
    mutateFormRef.current = mutateForm;
  }, [mutateForm]);

  const { patient } = usePatient(patientUuid);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const visit = useMemo<Visit | undefined>(() => {
    if (visitUuid && visitStartDatetime) {
      return {
        uuid: visitUuid,
        startDatetime: visitStartDatetime,
        stopDatetime: visitStopDatetime ?? null,
        visitType: visitTypeUuid ? { uuid: visitTypeUuid, display: '' } : undefined,
        encounters: currentVisit?.encounters ?? [],
      };
    }

    return currentVisit;
  }, [currentVisit, visitStartDatetime, visitStopDatetime, visitTypeUuid, visitUuid]);
  const handleCloseWorkspace = useCallback(() => {
    mutateFormRef.current?.();
    closeWorkspaceRef.current();
  }, []);

  const handleCloseWorkspaceWithSavedChanges = useCallback(() => {
    mutateFormRef.current?.();
    closeWorkspaceWithSavedChangesRef.current();
  }, []);

  const handleSetHasUnsavedChanges = useCallback((hasUnsavedChanges: boolean) => {
    promptBeforeClosingRef.current(() => hasUnsavedChanges);
  }, []);

  const state = useMemo(
    () =>
      ({
        additionalProps,
        closeWorkspace: handleCloseWorkspace,
        closeWorkspaceWithSavedChanges: handleCloseWorkspaceWithSavedChanges,
        encounterUuid: encounterUuid ?? undefined,
        formUuid: formUuid ?? '',
        patient,
        patientUuid: patientUuid ?? '',
        setHasUnsavedChanges: handleSetHasUnsavedChanges,
        visit,
        visitUuid: visit?.uuid,
        clinicalFormsWorkspaceName,
      }) satisfies FormRendererProps & {
        clinicalFormsWorkspaceName: string;
      },
    [
      additionalProps,
      clinicalFormsWorkspaceName,
      encounterUuid,
      handleCloseWorkspace,
      handleCloseWorkspaceWithSavedChanges,
      handleSetHasUnsavedChanges,
      patient,
      patientUuid,
      visit,
      formUuid,
    ],
  );

  return (
    <div>
      {state.formUuid && patientUuid && patient && (
        <ExtensionSlot key={state.formUuid} name="form-widget-slot" state={state} />
      )}
    </div>
  );
}

type FormEntryWorkspaceProps = FormEntryComponentProps;

const NonWorkspace2FormEntryWorkspace: React.FC<LegacyWorkspaceProps> = (props) => {
  const {
    patientUuid,
    form,
    encounterUuid,
    additionalProps,
    handlePostResponse,
    hideControls,
    hidePatientBanner,
    preFilledQuestions,
    closeWorkspace,
    closeWorkspaceWithSavedChanges,
    promptBeforeClosing,
  } = props;
  const { patient } = usePatient(patientUuid);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  if (!form) {
    return <LegacyFormEntryWorkspace {...props} />;
  }

  return (
    <FormEntry
      form={form}
      encounterUuid={encounterUuid}
      additionalProps={additionalProps}
      handlePostResponse={handlePostResponse}
      hideControls={hideControls}
      hidePatientBanner={hidePatientBanner}
      preFilledQuestions={preFilledQuestions}
      patient={patient}
      patientUuid={patientUuid}
      visitContext={currentVisit}
      mutateVisitContext={null}
      closeWorkspace={async () => {
        closeWorkspace();
        return true;
      }}
      closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
      promptBeforeClosing={promptBeforeClosing}
      renderAsWorkspace2={false}
    />
  );
};

const Workspace2LegacyFormEntryWorkspace: React.FC<Workspace2FormEntryProps> = ({
  closeWorkspace,
  groupProps,
  workspaceProps,
}) => {
  const { t } = useTranslation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const title = workspaceProps?.workspaceTitle ?? t('clinicalForm', 'Clinical form');
  const patientUuid = groupProps?.patientUuid ?? workspaceProps?.formInfo?.patientUuid ?? '';

  return (
    <Workspace2 title={title} hasUnsavedChanges={hasUnsavedChanges}>
      <LegacyFormEntryWorkspace
        {...workspaceProps}
        patientUuid={patientUuid}
        closeWorkspace={() => {
          void closeWorkspace();
        }}
        closeWorkspaceWithSavedChanges={() => {
          void closeWorkspace({ discardUnsavedChanges: true });
        }}
        promptBeforeClosing={(fn) => {
          setHasUnsavedChanges(fn());
        }}
      />
    </Workspace2>
  );
};

const Workspace2FormEntryWorkspace: React.FC<Workspace2FormEntryProps> = (props) => {
  const { closeWorkspace, groupProps, workspaceProps } = props;
  const patientUuid = groupProps?.patientUuid ?? workspaceProps?.formInfo?.patientUuid ?? '';
  const { patient: fetchedPatient } = usePatient(patientUuid);
  const { currentVisit, mutate } = useVisitOrOfflineVisit(patientUuid);
  const patient = groupProps?.patient ?? fetchedPatient;
  const visitContext = groupProps?.visitContext ?? currentVisit;
  const mutateVisitContext = groupProps?.mutateVisitContext ?? (() => void mutate());
  const {
    form,
    encounterUuid,
    additionalProps,
    handlePostResponse,
    hideControls,
    hidePatientBanner,
    preFilledQuestions,
  } = workspaceProps;

  if (!form) {
    return <Workspace2LegacyFormEntryWorkspace {...props} />;
  }

  return (
    <FormEntry
      form={form}
      encounterUuid={encounterUuid}
      additionalProps={additionalProps}
      handlePostResponse={handlePostResponse}
      hideControls={hideControls}
      hidePatientBanner={hidePatientBanner}
      preFilledQuestions={preFilledQuestions}
      patient={patient}
      patientUuid={patientUuid}
      visitContext={visitContext}
      mutateVisitContext={mutateVisitContext}
      closeWorkspace={closeWorkspace}
    />
  );
};

const FormEntryWorkspace: React.FC<PatientFormEntryWorkspaceProps> = (props) => {
  if (isWorkspace2Props(props)) {
    return <Workspace2FormEntryWorkspace {...props} />;
  }

  return <NonWorkspace2FormEntryWorkspace {...props} />;
};

export default FormEntryWorkspace;
