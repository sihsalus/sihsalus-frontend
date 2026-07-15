import { getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type Config } from '../../config-schema';
import { useEmergencyConfig } from '../../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, transitionToAttentionQueue } from '../../resources/emergency.resource';
import { calculateTriagePriority, type TriagePriority, type TriageVitals } from '../utils/priority-calculator';
import { validateTriageComplete } from '../utils/triage-validator';

interface VitalsSavedFormData {
  respiratoryRate?: number;
  oxygenSaturation?: number;
  systolicBloodPressure?: number;
  pulse?: number;
  temperature?: number;
  glasgowTotal?: number;
}

interface TriageVitalsSavedPayload {
  formData: VitalsSavedFormData;
  visitUuid: string;
}

const priorityCodeByLevel: Record<TriagePriority, string> = {
  I: 'PRIORITY_I',
  II: 'PRIORITY_II',
  III: 'PRIORITY_III',
  IV: 'PRIORITY_IV',
};

function toTriageVitals(formData: VitalsSavedFormData): TriageVitals {
  return {
    respiratoryRate: formData.respiratoryRate,
    oxygenSaturation: formData.oxygenSaturation,
    systolicBp: formData.systolicBloodPressure,
    heartRate: formData.pulse,
    temperature: formData.temperature,
    glasgowComaScale: formData.glasgowTotal,
  };
}

export function useTriageVitalsSavedHandler(queueEntry: EmergencyQueueEntry) {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const { emergencyAttentionQueueUuid, queueStatuses } = useEmergencyConfig();
  const { mutate } = useSWRConfig();

  return useCallback(
    async ({ formData, visitUuid }: TriageVitalsSavedPayload) => {
      const triageVitals = toTriageVitals(formData);
      const triageValidation = validateTriageComplete(triageVitals);

      if (!triageValidation.isComplete) {
        showSnackbar({
          title: t('triageIncomplete', 'Triaje incompleto'),
          kind: 'warning',
          subtitle: t(
            'triageIncompleteMessage',
            'Se guardaron los signos vitales, pero faltan datos requeridos para asignar prioridad y enviar a atención.',
          ),
        });
        return;
      }

      if (!visitUuid) {
        showSnackbar({
          title: t('noVisitFound', 'No se encontró una visita activa'),
          kind: 'error',
          subtitle: t(
            'cannotMovePatientWithoutVisit',
            'No se puede mover al paciente a atención sin una visita activa.',
          ),
        });
        return;
      }

      try {
        const triagePriority = calculateTriagePriority(triageVitals);
        const priorityCode = priorityCodeByLevel[triagePriority.priority];
        const priorityConfig = config.priorityConfigs.find((priority) => priority.code === priorityCode);
        const fallbackPriorityUuidByLevel: Record<TriagePriority, string> = {
          I: config.concepts.priorityIConceptUuid,
          II: config.concepts.priorityIIConceptUuid,
          III: config.concepts.priorityIIIConceptUuid,
          IV: config.concepts.priorityIVConceptUuid,
        };

        await transitionToAttentionQueue({
          sourceQueueEntryUuid: queueEntry.uuid,
          patientUuid: queueEntry.patient.uuid,
          visitUuid,
          sourceQueueUuid: queueEntry.queue.uuid,
          sourceStatusUuid: queueStatuses.inService,
          targetQueueUuid: emergencyAttentionQueueUuid,
          targetStatusUuid: queueStatuses.waiting,
          targetPriorityUuid: priorityConfig?.conceptUuid ?? fallbackPriorityUuidByLevel[triagePriority.priority],
        });

        mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
        showSnackbar({
          isLowContrast: true,
          title: t('triageCompleted', 'Triaje completado'),
          kind: 'success',
          subtitle: t(
            'patientMovedToAttentionQueueWithPriority',
            'Paciente enviado a atención con prioridad {{priority}}',
            { priority: triagePriority.priority },
          ),
        });
      } catch (error: unknown) {
        mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
        showSnackbar({
          title: t('errorCompletingTriage', 'Error al completar triaje'),
          kind: 'error',
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              'triageTransitionUnverifiedSafe',
              'Los signos vitales fueron guardados, pero no se pudo confirmar el envío a atención. No vuelva a guardar los signos ni repita el triaje; revise la cola.',
            ),
            { logContext: 'Transition triaged emergency patient to attention' },
          ),
        });
      }
    },
    [
      config.concepts.priorityIConceptUuid,
      config.concepts.priorityIIConceptUuid,
      config.concepts.priorityIIIConceptUuid,
      config.concepts.priorityIVConceptUuid,
      config.priorityConfigs,
      emergencyAttentionQueueUuid,
      mutate,
      queueEntry.patient.uuid,
      queueEntry.queue.uuid,
      queueEntry.uuid,
      queueStatuses.inService,
      queueStatuses.waiting,
      t,
    ],
  );
}
