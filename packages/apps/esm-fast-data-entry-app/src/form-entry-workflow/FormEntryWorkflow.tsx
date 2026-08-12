import { Button } from '@carbon/react';
import { ExtensionSlot, useSession } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
  type FormRendererProps,
} from '@openmrs/esm-patient-common-lib';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import CancelModal from '../CancelModal';
import CompleteModal from '../CompleteModal';
import FormWorkflowContext, { FormWorkflowProvider } from '../context/FormWorkflowContext';
import FormBootstrap from '../FormBootstrap';
import useStartVisit from '../hooks/useStartVisit';
import PatientCard from '../patient-card/PatientCard';
import PatientBanner from './patient-banner';
import PatientSearchHeader from './patient-search-header';
import styles from './styles.scss';
import WorkflowReview from './workflow-review';

const WorkflowNavigationButtons = () => {
  const context = useContext(FormWorkflowContext);
  const { workflowState, destroySession } = context;
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const { t } = useTranslation();

  if (!workflowState) return null;

  return (
    <>
      <div className={styles.rightPanelActionButtons}>
        <Button
          kind="secondary"
          onClick={workflowState === 'NEW_PATIENT' ? () => destroySession() : () => setCompleteModalOpen(true)}
        >
          {t('saveAndComplete', 'Save & Complete')}
        </Button>
        <Button kind="tertiary" onClick={() => setCancelModalOpen(true)}>
          {t('cancel', 'Cancel')}
        </Button>
      </div>
      <CancelModal open={cancelModalOpen} setOpen={setCancelModalOpen} context={context} />
      <CompleteModal open={completeModalOpen} setOpen={setCompleteModalOpen} context={context} />
    </>
  );
};

export const FormWorkspace = () => {
  const {
    patientUuids,
    activePatientUuid,
    activeEncounterUuid,
    saveEncounter,
    activeFormUuid,
    editEncounter,
    encounters,
    singleSessionVisitTypeUuid,
    resetSubmission,
  } = useContext(FormWorkflowContext);
  const { t } = useTranslation();

  const [encounter, setEncounter] = useState(null);
  const [visit, setVisit] = useState(null);
  const { sessionLocation } = useSession();

  const { updateEncounter, success: visitSaveSuccess } = useStartVisit({
    showSuccessNotification: false,
    showErrorNotification: true,
  });

  const handlePostResponse = (encounter) => {
    if (encounter && encounter.uuid) {
      saveEncounter(encounter.uuid);
      setEncounter(encounter);
    }
  };

  useEffect(() => {
    if (encounter && visit) {
      // Update the encounter so that it belongs to the created visit
      updateEncounter({ uuid: encounter.uuid, visit: visit.uuid });
    }
  }, [encounter, visit, updateEncounter]);

  useEffect(() => {
    if (visitSaveSuccess) {
      setVisit(visitSaveSuccess.data);
    }
  }, [visitSaveSuccess]);

  const assertActivePatientIsAlive = useCallback(async () => {
    try {
      if (!activePatientUuid) {
        throw Object.assign(new Error('The patient vital status could not be loaded.'), {
          code: PATIENT_VITAL_STATUS_UNAVAILABLE,
        });
      }
      await assertFreshPatientIsAlive(activePatientUuid);
    } catch (error) {
      resetSubmission();
      throw error;
    }
  }, [activePatientUuid, resetSubmission]);

  const handleEncounterCreate = useCallback<NonNullable<FormRendererProps['handleEncounterCreate']>>(
    async (payload) => {
      await assertActivePatientIsAlive();
      payload.location = sessionLocation?.uuid;
      payload.encounterDatetime = payload.encounterDatetime ? payload.encounterDatetime : new Date().toISOString();
      // Create a visit with the same date as the encounter being saved
      const visitStartDatetime = new Date(payload.encounterDatetime);
      const visitStopDatetime = new Date(payload.encounterDatetime);
      const visitInfo = {
        startDatetime: visitStartDatetime,
        stopDatetime: visitStopDatetime,
        uuid: uuid(),
        patient: {
          uuid: activePatientUuid,
        },
        location: {
          uuid: sessionLocation?.uuid,
        },
        visitType: {
          uuid: singleSessionVisitTypeUuid,
        },
      };

      payload.visit = visitInfo;
      return payload;
    },
    [activePatientUuid, assertActivePatientIsAlive, singleSessionVisitTypeUuid, sessionLocation],
  );

  return (
    <div className={styles.workspace}>
      {!patientUuids.length && (
        <div className={styles.selectPatientMessage}>{t('selectPatientFirst', 'Please select a patient first')}</div>
      )}
      {!!patientUuids.length && (
        <div className={styles.formMainContent}>
          <div className={styles.formContainer}>
            <FormBootstrap
              patientUuid={activePatientUuid}
              encounterUuid={activeEncounterUuid}
              {...{
                formUuid: activeFormUuid,
                handlePostResponse,
                handleEncounterCreate,
                onBeforeEncounterSave: assertActivePatientIsAlive,
              }}
              hidePatientBanner={true}
            />
          </div>
          <div className={styles.rightPanel}>
            <h4>{t('formsFilled', 'Forms filled')}</h4>
            <div className={styles.patientCardsSection}>
              {patientUuids.map((patientUuid) => (
                <PatientCard
                  key={patientUuid}
                  {...{
                    patientUuid,
                    activePatientUuid,
                    editEncounter,
                    encounters,
                  }}
                />
              ))}
            </div>
            <WorkflowNavigationButtons />
          </div>
        </div>
      )}
    </div>
  );
};

const FormEntryWorkflow = () => {
  const { workflowState } = useContext(FormWorkflowContext);
  return (
    <>
      <div className={styles.breadcrumbsContainer}>
        <ExtensionSlot name="breadcrumbs-slot" />
      </div>
      {workflowState === 'REVIEW' && <WorkflowReview />}
      {workflowState !== 'REVIEW' && (
        <>
          <PatientSearchHeader />
          <PatientBanner />
          <div className={styles.workspaceWrapper}>
            <FormWorkspace />
          </div>
        </>
      )}
    </>
  );
};

const FormEntryWorkflowWrapper = () => {
  return (
    <FormWorkflowProvider>
      <FormEntryWorkflow />
    </FormWorkflowProvider>
  );
};

export default FormEntryWorkflowWrapper;
