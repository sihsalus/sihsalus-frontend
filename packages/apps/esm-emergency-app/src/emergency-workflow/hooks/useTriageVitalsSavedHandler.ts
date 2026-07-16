import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../config-schema';
import { useEmergencyConfig } from '../../hooks/usePriorityConfig';
import {
  type EmergencyQueueEntry,
  transitionToAttentionQueue,
  useMutateEmergencyQueueEntries,
} from '../../resources/emergency.resource';
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
  const { mutateEmergencyQueueEntries } = useMutateEmergencyQueueEntries();

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

        await transitionToAttentionQueue(
          queueEntry.uuid,
          queueEntry.patient.uuid,
          visitUuid,
          priorityConfig?.conceptUuid ?? fallbackPriorityUuidByLevel[triagePriority.priority],
          emergencyAttentionQueueUuid,
          queueStatuses.waiting,
          priorityConfig?.sortWeight ?? 999,
        );

        void mutateEmergencyQueueEntries();
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
        showSnackbar({
          title: t('errorCompletingTriage', 'Error al completar triaje'),
          kind: 'error',
          subtitle:
            error instanceof Error
              ? error.message
              : t('errorMovingPatientToAttentionQueue', 'No se pudo enviar el paciente a la cola de atención'),
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
      mutateEmergencyQueueEntries,
      queueEntry.patient.uuid,
      queueEntry.uuid,
      queueStatuses.waiting,
      t,
    ],
  );
}
