/**
 * Emergency Workflow Workspace
 *
 * Simplified workspace with 2 states:
 * 1. REGISTRO - Patient search/registration + initial priority + send to queue
 * 2. CONFIRMACION - Success summary with options to register another or close
 */

import { type DefaultWorkspaceProps, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../config-schema';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import { createEmergencyQueueEntry, useMutateEmergencyQueueEntries } from '../resources/emergency.resource';
import { type InitialPriority, mapInitialPriorityToConfig } from './components/initial-priority-selector.component';
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
  const { mutateEmergencyQueueEntries } = useMutateEmergencyQueueEntries();

  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStep: WorkflowStep.REGISTRO,
  });

  /**
   * Handler when patient is selected/registered AND priority chosen.
   * Creates visit + queue entry, then transitions to confirmation.
   */
  const handlePatientQueued = useCallback(
    async (patientUuid: string, patientData: SearchedPatient, priorityLevel: InitialPriority) => {
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
        showSnackbar({
          title: t('errorCreatingVisit', 'Error al crear visita'),
          subtitle: t('couldNotCreateVisit', 'No se pudo crear la visita de emergencia'),
          kind: 'error',
        });
        return;
      }

      // 3. Create queue entry
      let queueEntryUuid: string | undefined;

      try {
        const response = await createEmergencyQueueEntry(
          patientUuid,
          visitUuid,
          priorityUuid,
          statusUuid,
          targetQueueUuid,
          sortWeight,
        );
        queueEntryUuid = response?.data?.uuid;
      } catch (error: unknown) {
        // The visit already exists at this point; retrying the flow reuses it and
        // only re-attempts the queue entry, so no rollback is needed.
        showSnackbar({
          title: t('errorCreatingQueueEntry', 'Error al agregar a la cola'),
          subtitle:
            error instanceof Error
              ? error.message
              : t(
                  'queueEntryFailedVisitKept',
                  'La visita quedó registrada pero el paciente no entró a la cola. Vuelva a intentarlo.',
                ),
          kind: 'error',
        });
        return;
      }

      // 4. Revalidate SWR cache so queue tables refresh in both apps
      void mutateEmergencyQueueEntries();

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
    [t, config, emergencyConfig, getOrCreateEmergencyVisit, mutateEmergencyQueueEntries],
  );

  const handleRegisterAnother = useCallback(() => {
    setWorkflowState({
      currentStep: WorkflowStep.REGISTRO,
    });
  }, []);

  const renderCurrentStep = () => {
    switch (workflowState.currentStep) {
      case WorkflowStep.REGISTRO:
        return <PatientSearchRegistration onPatientQueued={handlePatientQueued} />;
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

  return <div className={styles.workspace}>{renderCurrentStep()}</div>;
};

export default EmergencyWorkflowWorkspace;
