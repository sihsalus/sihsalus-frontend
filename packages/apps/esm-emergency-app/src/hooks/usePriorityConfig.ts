/**
 * Hooks for accessing emergency priority configuration.
 *
 * usePriorityConfig() wraps the pure helper functions from priority-helpers.ts
 * with the current config already injected, so consumers don't need to pass
 * priorityConfigs manually on every call.
 *
 * useEmergencyConfig() provides typed access to all emergency-specific config
 * values (queue UUIDs, statuses, location, concepts).
 */

import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { type Config } from '../config-schema';
import {
  getAllPriorities,
  getPriorityColor,
  getPriorityConfigByCode,
  getPriorityConfigByLabel,
  getPriorityConfigByUuid,
  getPriorityCssClass,
  getPriorityLabel,
  getPrioritySortWeight,
  isWaitTimeExceeded,
  sortByPriority,
} from '../utils/priority-helpers';

export function usePriorityConfig() {
  const config = useConfig<Config>();
  const priorityConfigs = config.priorityConfigs;

  return useMemo(
    () => ({
      // Configuraciones de prioridad
      priorityConfigs,

      // Funciones helper con configuración ya aplicada
      getPriorityByUuid: (uuid: string) => getPriorityConfigByUuid(uuid, priorityConfigs),
      getPriorityByCode: (code: string) => getPriorityConfigByCode(code, priorityConfigs),
      getPriorityByLabel: (label: string) => getPriorityConfigByLabel(label, priorityConfigs),

      getColor: (uuid: string) => getPriorityColor(uuid, priorityConfigs),
      getLabel: (uuid: string) => getPriorityLabel(uuid, priorityConfigs),
      getSortWeight: (uuid: string) => getPrioritySortWeight(uuid, priorityConfigs),
      getCssClass: (uuid: string) => getPriorityCssClass(uuid, priorityConfigs),

      sortByPriority: <T extends { priority: { uuid: string } }>(entries: T[]) =>
        sortByPriority(entries, priorityConfigs),

      getAllPriorities: () => getAllPriorities(priorityConfigs),

      isWaitTimeExceeded: (priorityUuid: string, waitTimeMinutes: number) =>
        isWaitTimeExceeded(priorityUuid, waitTimeMinutes, priorityConfigs),

      // Obtener UUIDs específicos por código (helpers comunes)
      getPriorityIUuid: () => config.concepts.priorityIConceptUuid,
      getPriorityIIUuid: () => config.concepts.priorityIIConceptUuid,
      getPriorityIIIUuid: () => config.concepts.priorityIIIConceptUuid,
      getPriorityIVUuid: () => config.concepts.priorityIVConceptUuid,
    }),
    [config, priorityConfigs],
  );
}

/**
 * Hook para acceder a la configuración general de emergencias
 */
export function useEmergencyConfig() {
  const config = useConfig<Config>();

  return useMemo(
    () => ({
      emergencyTriageQueueUuid: config.emergencyTriageQueueUuid,
      emergencyAttentionQueueUuid: config.emergencyAttentionQueueUuid,
      emergencyLocationUuid: config.emergencyLocationUuid,
      upssEmergencyLocationUuid: config.upssEmergencyLocationUuid,

      queueStatuses: {
        waiting: config.queueStatuses.waitingUuid,
        inService: config.queueStatuses.inServiceUuid,
        finishedService: config.queueStatuses.finishedServiceUuid,
      },

      triageEncounter: config.triageEncounter,

      autoRefreshInterval: config.autoRefreshInterval,
      emergencyVisitTypeUuid: config.emergencyVisitTypeUuid,

      patientRegistration: config.patientRegistration,
    }),
    [config],
  );
}
