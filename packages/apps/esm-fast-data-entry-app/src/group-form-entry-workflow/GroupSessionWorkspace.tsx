import { Button } from '@carbon/react';
import { getGlobalStore, useConfig, useSession, useStore } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
  type FormRendererProps,
} from '@openmrs/esm-patient-common-lib';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import CancelModal from '../CancelModal';
import CompleteModal from '../CompleteModal';
import GroupFormWorkflowContext from '../context/GroupFormWorkflowContext';
import FormBootstrap from '../FormBootstrap';
import PatientCard from '../patient-card/PatientCard';
import styles from './styles.scss';

const formStore = getGlobalStore('ampath-form-state');

const WorkflowNavigationButtons = () => {
  const context = useContext(GroupFormWorkflowContext);
  const { activeFormUuid, submitForNext, patientUuids, activePatientUuid, workflowState } = context;
  const store = useStore(formStore);
  const formState = store[activeFormUuid];

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const { t } = useTranslation();

  const navigationDisabled = useMemo(() => {
    if (!formState) {
      return false;
    }
    return (formState !== 'ready' || workflowState !== 'EDIT_FORM') && formState !== 'readyWithValidationErrors';
  }, [formState, workflowState]);

  const isLastPatient = activePatientUuid === patientUuids[patientUuids.length - 1];

  const handleClickNext = () => {
    if (workflowState === 'EDIT_FORM' || formState === 'readyWithValidationErrors') {
      submitForNext();
    }
  };

  return (
    <>
      <div className={styles.rightPanelActionButtons}>
        <Button kind="primary" onClick={handleClickNext} disabled={navigationDisabled}>
          {isLastPatient ? t('saveForm', 'Save Form') : t('nextPatient', 'Next patient')}
        </Button>
        <Button kind="secondary" onClick={() => setCompleteModalOpen(true)}>
          {t('saveAndComplete', 'Save & Complete')}
        </Button>
        <Button kind="tertiary" onClick={() => setCancelModalOpen(true)}>
          {t('cancel', 'Cancel')}
        </Button>
      </div>
      <CancelModal open={cancelModalOpen} setOpen={setCancelModalOpen} context={context} />
      <CompleteModal open={completeModalOpen} setOpen={setCompleteModalOpen} context={context} validateFirst={false} />
    </>
  );
};

const GroupSessionWorkspace = () => {
  const { groupSessionConcepts } = useConfig();
  const { t } = useTranslation();
  const {
    patientUuids,
    activePatientUuid,
    encounters,
    activeEncounterUuid,
    activeVisitUuid,
    activeFormUuid,
    activeGroupUuid,
    activeGroupName,
    activeSessionUuid,
    saveEncounter,
    activeSessionMeta,
    groupVisitTypeUuid,
    updateVisitUuid,
    submitForNext,
    workflowState,
    resetSubmission,
  } = useContext(GroupFormWorkflowContext);

  const { sessionLocation } = useSession();
  const pendingVisitRef = useRef<{ patientUuid: string; visitUuid: string } | null>(null);

  useEffect(() => {
    if (activeVisitUuid) {
      updateVisitUuid(activeVisitUuid);
    }
  }, [updateVisitUuid, activeVisitUuid]);

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

  // If there's no active visit, trigger the creation of a new one
  const handleEncounterCreate = useCallback<NonNullable<FormRendererProps['handleEncounterCreate']>>(
    async (payload) => {
      await assertActivePatientIsAlive();
      // Create a visit with the same date as the encounter being saved
      const obsTime = new Date(activeSessionMeta.sessionDate);
      const observations = payload.obs ?? [];
      payload.obs = observations;
      observations.forEach((item, index) => {
        observations[index] = {
          ...item,
          groupMembers: item.groupMembers?.map((mem) => ({
            ...mem,
            obsDatetime: obsTime.toISOString(),
          })),
          obsDatetime: obsTime.toISOString(),
        };
      });
      const pendingVisitUuid =
        pendingVisitRef.current?.patientUuid === activePatientUuid ? pendingVisitRef.current.visitUuid : undefined;
      const visitUuid = activeVisitUuid ?? pendingVisitUuid ?? uuid();
      if (!activeVisitUuid) {
        pendingVisitRef.current = { patientUuid: activePatientUuid, visitUuid };
        Object.entries(groupSessionConcepts).forEach(([field, uuid]) => {
          if (activeSessionMeta?.[field] != null && !observations.some((obsItem) => obsItem.concept === uuid)) {
            observations.push({
              concept: uuid as string,
              value: activeSessionMeta[field],
            } as (typeof observations)[number]);
          }
        });

        const otherIdentifiers: typeof observations = [
          { concept: groupSessionConcepts.cohortId, value: activeGroupUuid },
          { concept: groupSessionConcepts.cohortName, value: activeGroupName },
          {
            concept: groupSessionConcepts.sessionUuid,
            value: activeSessionUuid,
          },
        ] as typeof observations;
        observations.push(...otherIdentifiers);
        // If this is a newly created encounter and visit, add session concepts to encounter payload.
        const visitInfo = {
          startDatetime: activeSessionMeta.sessionDate,
          stopDatetime: activeSessionMeta.sessionDate,
          uuid: visitUuid,
          patient: {
            uuid: activePatientUuid,
          },
          location: {
            uuid: sessionLocation?.uuid,
          },
          visitType: {
            uuid: groupVisitTypeUuid,
          },
        };
        payload.visit = visitInfo;
      }
      payload.location = sessionLocation?.uuid;
      payload.encounterDatetime = obsTime.toISOString();
      return payload;
    },
    [
      activeSessionMeta,
      activeVisitUuid,
      sessionLocation?.uuid,
      groupSessionConcepts,
      activeGroupUuid,
      activeGroupName,
      activeSessionUuid,
      activePatientUuid,
      groupVisitTypeUuid,
      assertActivePatientIsAlive,
    ],
  );

  // Once form has been posted, save the new encounter uuid so we can edit it later
  const handlePostResponse = useCallback(
    (encounter) => {
      if (encounter && encounter.uuid) {
        if (pendingVisitRef.current?.patientUuid === activePatientUuid) {
          updateVisitUuid(pendingVisitRef.current.visitUuid);
          pendingVisitRef.current = null;
        }
        saveEncounter(encounter.uuid);
      }
    },
    [activePatientUuid, saveEncounter, updateVisitUuid],
  );

  const switchPatient = useCallback(
    (patientUuid) => {
      submitForNext(patientUuid);
    },
    [submitForNext],
  );

  if (workflowState === 'NEW_GROUP_SESSION') return null;

  return (
    <div className={styles.workspace}>
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
            hidePatientBanner={false}
          />
        </div>
        <div className={styles.rightPanel}>
          <h4>{t('formsFilled', 'Forms filled')}</h4>
          <div className={styles.patientCardsSection}>
            {patientUuids?.map((patientUuid) => (
              <PatientCard
                key={patientUuid}
                {...{
                  patientUuid,
                  activePatientUuid,
                  editEncounter: switchPatient,
                  encounters,
                }}
              />
            ))}
          </div>
          <WorkflowNavigationButtons />
        </div>
      </div>
    </div>
  );
};

export default GroupSessionWorkspace;
