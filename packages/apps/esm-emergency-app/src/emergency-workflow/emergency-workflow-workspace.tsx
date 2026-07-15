/**
 * Emergency Workflow Workspace
 *
 * Simplified workspace with 2 states:
 * 1. REGISTRO - Patient search/registration + initial priority + send to queue
 * 2. CONFIRMACION - Success summary with options to register another or close
 */

import { Button, InlineNotification } from '@carbon/react';
import { type DefaultWorkspaceProps, getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { type Config } from '../config-schema';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import {
  createEmergencyQueueEntry,
  EmergencyQueueEntryCreationNotAttemptedError,
  EmergencyQueueEntryCreationVerificationError,
  isDefinitiveEmergencyQueueCreateRejection,
  reconcileEmergencyQueueEntryCreation,
} from '../resources/emergency.resource';
import { type InitialPriority, mapInitialPriorityToConfig } from './components/initial-priority-selector.component';
import {
  clearEmergencyQueueSubmissionCheckpoint,
  loadEmergencyQueueSubmissionCheckpoint,
  saveEmergencyQueueSubmissionCheckpoint,
} from './emergency-queue-submission-checkpoint';
import styles from './emergency-workflow-workspace.scss';
import { useEmergencyVisit } from './hooks/useEmergencyVisit';
import PatientSearchRegistration from './patient-search-registration.component';
import { ConfirmationStep } from './steps';
import { type SearchedPatient, type WorkflowState, WorkflowStep } from './types';

interface EmergencyWorkflowWorkspaceProps extends DefaultWorkspaceProps {
  selectedPatientUuid?: string;
  patientUuid?: string;
}

const EmergencyWorkflowWorkspace: React.FC<EmergencyWorkflowWorkspaceProps> = ({ closeWorkspace }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const emergencyConfig = useEmergencyConfig();
  const { getOrCreateEmergencyVisit } = useEmergencyVisit();
  const [initialQueueSubmissionCheckpoint] = useState(loadEmergencyQueueSubmissionCheckpoint);
  const [pendingQueueSubmission, setPendingQueueSubmission] = useState(initialQueueSubmissionCheckpoint);
  const [queueCheckpointIsDurable, setQueueCheckpointIsDurable] = useState(true);
  const [queueEntryAbsenceWasConfirmed, setQueueEntryAbsenceWasConfirmed] = useState(false);
  const [isReconcilingQueueSubmission, setIsReconcilingQueueSubmission] = useState(false);
  const initialReconciliationStartedRef = useRef(false);
  const queueReconciliationInFlightRef = useRef(false);

  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStep: WorkflowStep.REGISTRO,
  });

  useEffect(() => {
    if (!pendingQueueSubmission) {
      return;
    }
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    globalThis.addEventListener('beforeunload', warnBeforeLeaving);
    return () => globalThis.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [pendingQueueSubmission]);

  useEffect(() => {
    if (!initialQueueSubmissionCheckpoint || initialReconciliationStartedRef.current) {
      return;
    }
    initialReconciliationStartedRef.current = true;

    void reconcileEmergencyQueueEntryCreation(initialQueueSubmissionCheckpoint)
      .then((response) => {
        if (!response?.data?.uuid) {
          setQueueEntryAbsenceWasConfirmed(true);
          return;
        }
        clearEmergencyQueueSubmissionCheckpoint();
        setPendingQueueSubmission(null);
        mutate((key) => typeof key === 'string' && key.includes('queue-entry'));
        showSnackbar({
          title: t('queueEntryReconciledTitle', 'Ingreso a cola confirmado'),
          subtitle: t(
            'queueEntryReconciledSubtitle',
            'Se confirmó que el paciente ya está en la cola. Revise la cola antes de iniciar otro ingreso.',
          ),
          kind: 'success',
        });
      })
      .catch((error: unknown) => {
        getUserFacingErrorMessage(
          error,
          t(
            'queueEntryReconciliationPendingSubtitle',
            'No se pudo conciliar el ingreso pendiente. Revise la cola y no vuelva a enviar al paciente hasta confirmar su estado.',
          ),
          { logContext: 'Reconcile pending emergency queue entry' },
        );
      });
  }, [initialQueueSubmissionCheckpoint, t]);

  const handleReconcilePendingQueueSubmission = useCallback(async () => {
    if (!pendingQueueSubmission || queueReconciliationInFlightRef.current) {
      return;
    }

    queueReconciliationInFlightRef.current = true;
    setIsReconcilingQueueSubmission(true);
    try {
      const response = await reconcileEmergencyQueueEntryCreation(pendingQueueSubmission);
      if (response?.data?.uuid) {
        clearEmergencyQueueSubmissionCheckpoint();
        setPendingQueueSubmission(null);
        setQueueEntryAbsenceWasConfirmed(false);
        mutate((key) => typeof key === 'string' && key.includes('queue-entry'));
        showSnackbar({
          title: t('queueEntryReconciledTitle', 'Ingreso a cola confirmado'),
          subtitle: t(
            'queueEntryReconciledSubtitle',
            'Se confirmó que el paciente ya está en la cola. Revise la cola antes de iniciar otro ingreso.',
          ),
          kind: 'success',
        });
        return;
      }

      if (queueEntryAbsenceWasConfirmed) {
        clearEmergencyQueueSubmissionCheckpoint();
        setPendingQueueSubmission(null);
        setQueueEntryAbsenceWasConfirmed(false);
        showSnackbar({
          title: t('queueEntryAbsenceConfirmedTitle', 'No se encontró un ingreso pendiente'),
          subtitle: t(
            'queueEntryAbsenceConfirmedSubtitle',
            'Dos verificaciones no encontraron la entrada. Se retiró el bloqueo; revise la cola una vez más antes de reenviar al paciente.',
          ),
          kind: 'warning',
        });
        return;
      }

      setQueueEntryAbsenceWasConfirmed(true);
      showSnackbar({
        title: t('queueEntryAbsenceNeedsConfirmationTitle', 'Entrada no encontrada todavía'),
        subtitle: t(
          'queueEntryAbsenceNeedsConfirmationSubtitle',
          'No se encontró la entrada en esta verificación. Revise la cola y vuelva a verificar antes de habilitar otro envío.',
        ),
        kind: 'warning',
      });
    } catch (error: unknown) {
      showSnackbar({
        title: t('queueEntryReconciliationPendingTitle', 'Ingreso a cola pendiente de verificación'),
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'queueEntryReconciliationPendingSubtitle',
            'No se pudo conciliar el ingreso pendiente. Revise la cola y no vuelva a enviar al paciente hasta confirmar su estado.',
          ),
          { logContext: 'Manually reconcile pending emergency queue entry' },
        ),
        kind: 'error',
      });
    } finally {
      queueReconciliationInFlightRef.current = false;
      setIsReconcilingQueueSubmission(false);
    }
  }, [pendingQueueSubmission, queueEntryAbsenceWasConfirmed, t]);

  /**
   * Handler when patient is selected/registered AND priority chosen.
   * Creates visit + queue entry, then transitions to confirmation.
   */
  const handlePatientQueued = useCallback(
    async (patientUuid: string, patientData: SearchedPatient, priorityLevel: InitialPriority) => {
      if (pendingQueueSubmission) {
        showSnackbar({
          title: t('queueEntryReconciliationPendingTitle', 'Ingreso a cola pendiente de verificación'),
          subtitle: t(
            'queueEntryReconciliationPendingSubtitle',
            'No se pudo conciliar el ingreso pendiente. Revise la cola y no vuelva a enviar al paciente hasta confirmar su estado.',
          ),
          kind: 'warning',
        });
        return;
      }

      const isDirectEmergency = priorityLevel === 'emergency';

      // 1. Determine target queue, priority, and status based on initial classification
      let targetQueueUuid: string;
      let priorityUuid: string;
      let statusUuid: string;
      let sortWeight: number;

      if (isDirectEmergency) {
        // Emergencia → directo a Cola de Atención, Prioridad I, estado "Atendiéndose"
        targetQueueUuid = emergencyConfig.emergencyAttentionQueueUuid;
        priorityUuid = config.concepts.priorityIConceptUuid;
        statusUuid = emergencyConfig.queueStatuses.inService;
        sortWeight = 0;
      } else {
        // Urgencia → Cola de Triaje, pre-triaje concept, estado "Esperando"
        const mapped = mapInitialPriorityToConfig(
          priorityLevel,
          config.concepts.emergencyConceptUuid,
          config.concepts.urgencyConceptUuid,
        );
        targetQueueUuid = emergencyConfig.emergencyTriageQueueUuid;
        priorityUuid = mapped.conceptUuid;
        statusUuid = emergencyConfig.queueStatuses.waiting;
        sortWeight = mapped.sortWeight;
      }

      // 2. Create or get emergency visit
      const visitUuid = await getOrCreateEmergencyVisit(
        patientUuid,
        patientData.emergencyRegistrationContext?.arrivalDateTime,
        patientData.emergencyRegistrationContext?.administrativeNotes,
      );
      if (!visitUuid) {
        return;
      }

      // 3. Create and verify the queue entry
      const queueCheckpoint = {
        version: 1 as const,
        patientUuid,
        visitUuid,
        priorityUuid,
        statusUuid,
        queueUuid: targetQueueUuid,
      };
      setPendingQueueSubmission(queueCheckpoint);
      setQueueCheckpointIsDurable(saveEmergencyQueueSubmissionCheckpoint(queueCheckpoint));
      let queueEntryUuid: string;

      try {
        const response = await createEmergencyQueueEntry(
          patientUuid,
          visitUuid,
          priorityUuid,
          statusUuid,
          targetQueueUuid,
          sortWeight,
        );
        const verifiedQueueEntryUuid = response?.data?.uuid?.trim();
        if (!verifiedQueueEntryUuid) {
          throw new EmergencyQueueEntryCreationVerificationError();
        }
        queueEntryUuid = verifiedQueueEntryUuid;
        clearEmergencyQueueSubmissionCheckpoint();
        setPendingQueueSubmission(null);
      } catch (error: unknown) {
        const requestWasNotAttempted = error instanceof EmergencyQueueEntryCreationNotAttemptedError;
        const requestWasExplicitlyRejected = isDefinitiveEmergencyQueueCreateRejection(error);
        if (requestWasNotAttempted || requestWasExplicitlyRejected) {
          clearEmergencyQueueSubmissionCheckpoint();
          setPendingQueueSubmission(null);
        }
        showSnackbar({
          title: t('errorCreatingQueueEntry', 'Error al agregar a la cola'),
          subtitle: getUserFacingErrorMessage(
            error,
            requestWasNotAttempted
              ? t(
                  'queueEntryCreationNotAttemptedSubtitle',
                  'No se intentó crear la entrada porque no se pudo verificar el estado actual de la cola. Actualice y vuelva a intentarlo.',
                )
              : requestWasExplicitlyRejected
                ? t(
                    'queueEntryCreationRejectedSubtitle',
                    'El servidor rechazó el ingreso y no confirmó una entrada nueva. Revise los datos y permisos antes de reintentar.',
                  )
                : t(
                    'queueEntryCreationFailureSubtitle',
                    'No se pudo confirmar el ingreso del paciente a la cola. Revise la cola y no vuelva a enviarlo hasta verificar su estado.',
                  ),
            { logContext: 'Create emergency queue entry' },
          ),
          kind: 'error',
        });
        return;
      }

      // 4. Revalidate SWR cache so queue tables refresh
      mutate((key) => typeof key === 'string' && key.includes('queue-entry'));

      if (isDirectEmergency) {
        showSnackbar({
          title: t('emergencyDirectAttention', 'Paciente enviado a atención inmediata'),
          subtitle: t(
            'emergencyDirectAttentionSubtitle',
            'Prioridad I — El triaje se puede completar durante la atención.',
          ),
          kind: 'success',
          timeoutInMs: 5000,
        });
      } else {
        showSnackbar({
          title: t('patientQueuedSuccess', 'Paciente enviado a cola de triaje'),
          subtitle: t('patientQueuedSuccessSubtitle', 'El paciente ha sido registrado y enviado a la cola de triaje.'),
          kind: 'success',
          timeoutInMs: 5000,
        });
      }

      // 5. Transition to confirmation
      setWorkflowState({
        currentStep: WorkflowStep.CONFIRMACION,
        patientUuid,
        patientData,
        visitUuid,
        priorityUuid,
        queueEntryUuid,
        initialClassification: priorityLevel,
      });
    },
    [t, config, emergencyConfig, getOrCreateEmergencyVisit, pendingQueueSubmission],
  );

  const handleRegisterAnother = useCallback(() => {
    setWorkflowState({
      currentStep: WorkflowStep.REGISTRO,
    });
  }, []);

  const renderCurrentStep = () => {
    switch (workflowState.currentStep) {
      case WorkflowStep.REGISTRO:
        return (
          <PatientSearchRegistration
            onPatientQueued={handlePatientQueued}
            submissionBlocked={Boolean(pendingQueueSubmission)}
          />
        );
      case WorkflowStep.CONFIRMACION:
        return (
          <ConfirmationStep
            workflowState={workflowState}
            onRegisterAnother={handleRegisterAnother}
            onClose={closeWorkspace}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.workspace}>
      {pendingQueueSubmission ? (
        <>
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('queueEntryReconciliationPendingTitle', 'Ingreso a cola pendiente de verificación')}
            subtitle={t(
              'queueEntryReconciliationPendingSubtitle',
              'No se pudo conciliar el ingreso pendiente. Revise la cola y no vuelva a enviar al paciente hasta confirmar su estado.',
            )}
          />
          <Button
            disabled={isReconcilingQueueSubmission}
            kind="secondary"
            onClick={handleReconcilePendingQueueSubmission}
            size="sm"
            type="button"
          >
            {isReconcilingQueueSubmission
              ? t('reconcilingQueueEntry', 'Verificando ingreso...')
              : queueEntryAbsenceWasConfirmed
                ? t('confirmQueueEntryAbsence', 'Confirmar que no existe ingreso')
                : t('reconcileQueueEntryAgain', 'Volver a verificar ingreso')}
          </Button>
        </>
      ) : null}
      {!queueCheckpointIsDurable && pendingQueueSubmission ? (
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          title={t('queueCheckpointUnavailableTitle', 'No cierre ni recargue esta ventana')}
          subtitle={t(
            'queueCheckpointUnavailableSubtitle',
            'El navegador no pudo conservar el ingreso pendiente. Revise la cola o contacte a soporte antes de repetir el envío.',
          )}
        />
      ) : null}
      {renderCurrentStep()}
    </div>
  );
};

export default EmergencyWorkflowWorkspace;
