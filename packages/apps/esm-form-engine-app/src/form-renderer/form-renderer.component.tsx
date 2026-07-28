import { InlineLoading } from '@carbon/react';
import { type Encounter, type OpenmrsResource, showModal, type Visit } from '@openmrs/esm-framework';
import {
  clinicalFormsWorkspace,
  type FormRendererProps,
  launchPatientWorkspace,
} from '@openmrs/esm-patient-common-lib';
import type { FormField, SessionMode } from '@sihsalus/esm-form-engine-lib';
import { FormEngine } from '@sihsalus/esm-form-engine-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import useFormSchema from '../hooks/use-form-schema';

import FormError from './form-error.component';
import styles from './form-renderer.scss';

interface FormRendererComponentProps extends FormRendererProps {
  clinicalFormsWorkspaceName?: string;
}

interface FormRendererAdditionalProps {
  formSessionIntent?: string;
  mode?: SessionMode;
  openClinicalFormsWorkspaceOnFormClose?: boolean;
}

const FormRenderer: React.FC<FormRendererComponentProps> = (props) => {
  const {
    additionalProps,
    closeWorkspaceWithSavedChanges,
    encounterUuid,
    formUuid,
    handlePostResponse,
    handleEncounterCreate,
    handleOnValidate,
    hideControls,
    hidePatientBanner,
    patientUuid,
    preFilledQuestions,
    showDiscardSubmitButtons,
    visit: visitRaw,
    visitUuid,
    clinicalFormsWorkspaceName = clinicalFormsWorkspace,
  } = props;
  const { t } = useTranslation();
  const { schema, error, isLoading } = useFormSchema(formUuid);
  const typedAdditionalProps = additionalProps as FormRendererAdditionalProps | undefined;
  const openClinicalFormsWorkspaceOnFormClose = typedAdditionalProps?.openClinicalFormsWorkspaceOnFormClose ?? true;
  const formSessionIntent = typedAdditionalProps?.formSessionIntent ?? '*';
  const effectiveHideControls = hideControls ?? showDiscardSubmitButtons === false;

  const visit = useMemo<Visit | undefined>(() => {
    if (visitRaw) {
      return visitRaw;
    }

    if (visitUuid) {
      return { uuid: visitUuid } as Visit;
    }
  }, [visitRaw, visitUuid]);

  const handleCloseForm = useCallback(() => {
    props.closeWorkspace?.();
    if (!encounterUuid && openClinicalFormsWorkspaceOnFormClose) {
      void launchPatientWorkspace(clinicalFormsWorkspaceName);
    }
  }, [props, encounterUuid, openClinicalFormsWorkspaceOnFormClose, clinicalFormsWorkspaceName]);

  const handleConfirmQuestionDeletion = useCallback((_question: Readonly<FormField>) => {
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

  const handleOnSubmit = useCallback(
    (data: Array<OpenmrsResource>) => {
      if (closeWorkspaceWithSavedChanges) {
        closeWorkspaceWithSavedChanges();
      } else {
        props.closeWorkspace?.({ ignoreChanges: true, closeWorkspaceGroup: false });
      }

      const submittedEncounter = data.find(
        (result): result is OpenmrsResource & Encounter => typeof result?.uuid === 'string',
      );

      handlePostResponse?.(submittedEncounter);
    },
    [props, closeWorkspaceWithSavedChanges, handlePostResponse],
  );

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
        <FormError closeWorkspace={handleCloseForm} />
      </div>
    );
  }

  return (
    <>
      {schema && (
        <FormEngine
          encounterUUID={encounterUuid}
          formJson={schema}
          handleClose={handleCloseForm}
          handleConfirmQuestionDeletion={handleConfirmQuestionDeletion}
          handleEncounterCreate={handleEncounterCreate}
          handleOnValidate={handleOnValidate}
          hideControls={effectiveHideControls}
          hidePatientBanner={hidePatientBanner}
          markFormAsDirty={
            props.setHasUnsavedChanges
              ? (isDirty) => {
                  props.setHasUnsavedChanges?.(isDirty);
                }
              : undefined
          }
          mode={typedAdditionalProps?.mode}
          formSessionIntent={formSessionIntent}
          onSubmit={handleOnSubmit}
          patientUUID={patientUuid}
          preFilledQuestions={preFilledQuestions}
          visit={visit}
        />
      )}
    </>
  );
};

export default FormRenderer;
