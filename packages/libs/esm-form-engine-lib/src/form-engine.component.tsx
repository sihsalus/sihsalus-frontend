import { Button, ButtonSet, InlineLoading } from '@carbon/react';
import { type OpenmrsResource, useSession, type Visit } from '@openmrs/esm-framework/src/internal';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { isEmpty, useFormJson } from '.';
import MarkdownWrapper from './components/inputs/markdown/markdown-wrapper.component';
import Loader from './components/loaders/loader.component';
import PatientBanner from './components/patient-banner/patient-banner.component';
import FormProcessorFactory from './components/processor-factory/form-processor-factory.component';
import Sidebar from './components/sidebar/sidebar.component';
import { usePageObserver } from './components/sidebar/usePageObserver';
import styles from './form-engine.scss';
import { formEngineAppName } from './globals';
import { useFormCollapse } from './hooks/useFormCollapse';
import { useFormWorkspaceSize } from './hooks/useFormWorkspaceSize';
import { usePatientData } from './hooks/usePatientData';
import { init, teardown } from './lifecycle';
import { FormFactoryProvider } from './provider/form-factory-provider';
import type { FormField, FormSchema, OpenmrsEncounter, PreFilledQuestions, SessionMode } from './types';
import { reportError } from './utils/error-utils';
import { resolveFormLocation } from './utils/form-location';

const getMarkdownString = (markdown: FormSchema['markdown']): string | null => {
  return typeof markdown === 'string' ? markdown : null;
};

interface FormEngineProps {
  patientUUID: string;
  formUUID?: string;
  formJson?: FormSchema;
  encounterUUID?: string;
  visit?: Visit;
  formSessionIntent?: string;
  mode?: SessionMode;
  onSubmit?: (data: Array<OpenmrsResource>) => void;
  onCancel?: () => void;
  handleClose?: () => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  markFormAsDirty?: (isDirty: boolean) => void;
  handleOnValidate?: (valid: boolean) => void;
  handleEncounterCreate?: (encounter: OpenmrsEncounter) => OpenmrsEncounter | void | Promise<OpenmrsEncounter | void>;
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  preFilledQuestions?: PreFilledQuestions;
}

const FormEngine = ({
  formJson,
  patientUUID,
  formUUID,
  encounterUUID,
  visit,
  formSessionIntent,
  mode,
  onSubmit,
  onCancel,
  handleClose,
  handleConfirmQuestionDeletion,
  markFormAsDirty,
  handleOnValidate,
  handleEncounterCreate,
  hideControls = false,
  hidePatientBanner = false,
  preFilledQuestions,
}: FormEngineProps): React.JSX.Element => {
  const { t } = useTranslation();
  const session = useSession();
  const ref = useRef<HTMLFormElement | null>(null);
  const sessionDate = useMemo<Date>(() => new Date(), []);
  const workspaceSize = useFormWorkspaceSize(ref);
  const { patient, isLoadingPatient } = usePatientData(patientUUID);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const sessionMode = !isEmpty(mode) ? mode : !isEmpty(encounterUUID) ? 'edit' : 'enter';
  const { isFormExpanded, hideFormCollapseToggle } = useFormCollapse(sessionMode);
  const { hasMultiplePages } = usePageObserver();

  const {
    formJson: refinedFormJson,
    isLoading: isLoadingFormJson,
    formError,
  } = useFormJson(formUUID, formJson, encounterUUID, formSessionIntent, preFilledQuestions);

  const showPatientBanner = useMemo<boolean>(() => {
    if (hidePatientBanner) {
      return false;
    }
    return Boolean(patient && workspaceSize === 'ultra-wide' && mode !== 'embedded-view');
  }, [patient, mode, workspaceSize, hidePatientBanner]);

  const isFormWorkspaceTooNarrow = useMemo(() => ['narrow'].includes(workspaceSize), [workspaceSize]);

  const showBottomButtonSet = useMemo(() => {
    if (mode === 'embedded-view' || isLoadingDependencies || hasMultiplePages === null) {
      return false;
    }

    return isFormWorkspaceTooNarrow || !hasMultiplePages;
  }, [mode, isFormWorkspaceTooNarrow, isLoadingDependencies, hasMultiplePages]);

  const showSidebar = useMemo<boolean>(() => {
    if (mode === 'embedded-view' || isLoadingDependencies || hasMultiplePages === null) {
      return false;
    }

    return !isFormWorkspaceTooNarrow && hasMultiplePages;
  }, [mode, isFormWorkspaceTooNarrow, isLoadingDependencies, hasMultiplePages]);

  useEffect(() => {
    reportError(formError, t('errorLoadingFormSchema', 'Error loading form schema'));
  }, [formError, t]);

  useEffect(() => {
    init();
    return (): void => {
      teardown();
    };
  }, []);

  useEffect(() => {
    markFormAsDirty?.(isFormDirty);
  }, [isFormDirty, markFormAsDirty]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
  }, []);

  const isLoadingFormDefinition = isLoadingPatient || isLoadingFormJson || !refinedFormJson;
  const markdown: string | null = refinedFormJson ? getMarkdownString(refinedFormJson.markdown) : null;

  return (
    <form ref={ref} noValidate className={classNames('cds--form', styles.form)} onSubmit={handleSubmit}>
      {isLoadingFormDefinition ? (
        <Loader />
      ) : (
        <FormFactoryProvider
          patient={patient}
          patientUUID={patientUUID}
          sessionMode={sessionMode}
          sessionDate={sessionDate}
          formJson={refinedFormJson}
          workspaceLayout={workspaceSize === 'ultra-wide' ? 'maximized' : 'minimized'}
          location={resolveFormLocation(visit, session?.sessionLocation)}
          provider={session?.currentProvider}
          visit={visit}
          handleConfirmQuestionDeletion={handleConfirmQuestionDeletion}
          isFormExpanded={isFormExpanded}
          formSubmissionProps={{
            isSubmitting,
            setIsSubmitting,
            onSubmit,
            onError: () => {},
            handleClose: () => {},
            handleOnValidate,
          }}
          hideFormCollapseToggle={hideFormCollapseToggle}
          handleEncounterCreate={handleEncounterCreate}
          setIsFormDirty={setIsFormDirty}
        >
          <div className={styles.formContainer}>
            {isLoadingDependencies && (
              <div className={styles.linearActivity}>
                <div className={styles.indeterminate}></div>
              </div>
            )}
            <div className={styles.formContent}>
              {showSidebar && (
                <Sidebar
                  isFormSubmitting={isSubmitting}
                  sessionMode={mode}
                  defaultPage={refinedFormJson.defaultPage}
                  onCancel={onCancel}
                  handleClose={handleClose}
                  hideFormCollapseToggle={hideFormCollapseToggle}
                  hideControls={hideControls}
                />
              )}
              <div className={styles.formContentInner}>
                {showPatientBanner && <PatientBanner patient={patient} hideActionsOverflow />}
                {markdown && (
                  <div className={styles.markdownContainer}>
                    <MarkdownWrapper markdown={markdown} />
                  </div>
                )}
                <div className={styles.formBody}>
                  <FormProcessorFactory
                    formJson={refinedFormJson}
                    setIsLoadingFormDependencies={setIsLoadingDependencies}
                  />
                </div>
                {showBottomButtonSet && !hideControls && (
                  <ButtonSet className={styles.minifiedButtons}>
                    <Button
                      kind="secondary"
                      onClick={() => {
                        if (onCancel) {
                          onCancel();
                        }
                        if (handleClose) {
                          handleClose();
                        }
                        hideFormCollapseToggle();
                      }}
                    >
                      {mode === 'view' ? t('close', 'Close') : t('cancel', 'Cancel')}
                    </Button>
                    <Button
                      className={styles.saveButton}
                      disabled={isLoadingDependencies || isSubmitting || mode === 'view'}
                      kind="primary"
                      type="submit"
                    >
                      {isSubmitting ? (
                        <InlineLoading description={t('submitting', 'Submitting') + '...'} />
                      ) : (
                        <span>{`${t('save', 'Save')}`}</span>
                      )}
                    </Button>
                  </ButtonSet>
                )}
              </div>
            </div>
          </div>
        </FormFactoryProvider>
      )}
    </form>
  );
};

function I18FormEngine(props: FormEngineProps): React.JSX.Element {
  return (
    <I18nextProvider i18n={window.i18next} defaultNS={formEngineAppName}>
      <FormEngine {...props} />
    </I18nextProvider>
  );
}

export default I18FormEngine;
