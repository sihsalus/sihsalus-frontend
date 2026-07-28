import { InlineLoading } from '@carbon/react';
import { type Encounter, type OpenmrsResource, showModal, useConfig } from '@openmrs/esm-framework';
import { clinicalFormsWorkspace, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { FormEngine, type PreFilledQuestions, type SessionMode } from '../form-engine-lib-runtime';
import { useCustomDataSources } from '../hooks/use-custom-data-sources';
import { useCustomEncounterDatetime } from '../hooks/use-custom-encounter-datetime';
import useFormSchema from '../hooks/use-form-schema';
import { useLabOrderNotification } from '../hooks/use-lab-order-notification';
import { setFormState } from '../store/form-state.store';
import type { FormEntryReactConfig, FormWidgetProps } from '../types';

import FormError from './form-error.component';
import styles from './form-renderer.scss';
import { normalizeFormWidgetProps } from './form-widget-adapter';

interface FormRendererAdditionalProps {
  formSessionIntent?: string;
  mode?: SessionMode;
  openClinicalFormsWorkspaceOnFormClose?: boolean;
  preFilledQuestions?: PreFilledQuestions;
}

const FormRenderer: React.FC<FormWidgetProps> = (props) => {
  const normalizedProps = normalizeFormWidgetProps(props);
  const {
    closeWorkspace,
    closeWorkspaceWithSavedChanges,
    formUuid,
    patientUuid,
    encounterUuid,
    visit,
    visitStartDatetime,
    additionalProps,
    preFilledQuestions: directPreFilledQuestions,
    hideControls,
    hidePatientBanner,
    showDiscardSubmitButtons,
    handlePostResponse,
    handleEncounterCreate,
    handleOnValidate,
    clinicalFormsWorkspaceName = clinicalFormsWorkspace,
    setHasUnsavedChanges,
  } = normalizedProps;
  const { t } = useTranslation();
  const config = useConfig<FormEntryReactConfig>();
  const { schema, error, isLoading } = useFormSchema(formUuid);
  const typedAdditionalProps = additionalProps as FormRendererAdditionalProps | undefined;

  // Gap feature hooks
  useCustomDataSources(config);
  const { showLabOrdersNotification } = useLabOrderNotification();
  const basePreFilledQuestions = directPreFilledQuestions ?? typedAdditionalProps?.preFilledQuestions;
  const preFilledQuestions = useCustomEncounterDatetime(config, visitStartDatetime, basePreFilledQuestions);

  const openClinicalFormsWorkspaceOnFormClose = typedAdditionalProps?.openClinicalFormsWorkspaceOnFormClose ?? true;
  const formSessionIntent = typedAdditionalProps?.formSessionIntent ?? '*';
  const mode = typedAdditionalProps?.mode ?? (encounterUuid ? 'edit' : 'enter');
  const effectiveHideControls = hideControls ?? showDiscardSubmitButtons === false;

  const handleCloseForm = useCallback(() => {
    closeWorkspace?.();
    if (!encounterUuid && openClinicalFormsWorkspaceOnFormClose) {
      void launchPatientWorkspace(clinicalFormsWorkspaceName);
    }
  }, [closeWorkspace, encounterUuid, openClinicalFormsWorkspaceOnFormClose, clinicalFormsWorkspaceName]);

  const handleConfirmQuestionDeletion = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const dispose = showModal('form-engine-delete-question-confirm-modal', {
        onCancel() {
          dispose();
          reject(new Error('Question deletion cancelled'));
        },
        onConfirm() {
          dispose();
          resolve();
        },
      });
    });
  }, []);

  const handleMarkFormAsDirty = useCallback(
    (isDirty: boolean) => {
      setHasUnsavedChanges?.(isDirty);
    },
    [setHasUnsavedChanges],
  );

  const handleOnSubmit = useCallback(
    async (data: Array<OpenmrsResource>) => {
      setFormState(formUuid, 'submitted');

      const submittedEncounter = data.find(
        (result): result is OpenmrsResource & Encounter => typeof result?.uuid === 'string',
      );
      const submittedEncounterUuid = submittedEncounter?.uuid;

      if (submittedEncounterUuid) {
        await showLabOrdersNotification(submittedEncounterUuid);
      }

      handlePostResponse?.(submittedEncounter);
      closeWorkspaceWithSavedChanges?.();
    },
    [formUuid, showLabOrdersNotification, handlePostResponse, closeWorkspaceWithSavedChanges],
  );

  const handleValidate = useCallback(
    (valid: boolean) => {
      setFormState(formUuid, valid ? 'ready' : 'readyWithValidationErrors');
      handleOnValidate?.(valid);
    },
    [formUuid, handleOnValidate],
  );

  // Track form state
  if (isLoading && formUuid) {
    setFormState(formUuid, 'loading');
  } else if (error && formUuid) {
    setFormState(formUuid, 'loadingError');
  } else if (schema && formUuid) {
    setFormState(formUuid, 'ready');
  }

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <InlineLoading className={styles.loading} description={`${t('loading', 'Loading')} ...`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <FormError closeWorkspace={handleCloseForm} clinicalFormsWorkspaceName={clinicalFormsWorkspaceName} />
      </div>
    );
  }

  return schema ? (
    <FormEngine
      encounterUUID={encounterUuid}
      formJson={schema}
      handleClose={handleCloseForm}
      handleConfirmQuestionDeletion={handleConfirmQuestionDeletion}
      handleEncounterCreate={handleEncounterCreate}
      handleOnValidate={handleValidate}
      hideControls={effectiveHideControls}
      hidePatientBanner={hidePatientBanner}
      markFormAsDirty={handleMarkFormAsDirty}
      mode={mode}
      formSessionIntent={formSessionIntent}
      onSubmit={(data) => {
        void handleOnSubmit(data);
      }}
      patientUUID={patientUuid}
      visit={visit}
      preFilledQuestions={preFilledQuestions}
    />
  ) : null;
};

export default FormRenderer;
