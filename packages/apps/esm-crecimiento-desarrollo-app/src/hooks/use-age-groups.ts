// hooks/useAgeGroups.ts

import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import type { ConfigObject } from '../config-schema';
import {
  type AgeGroup,
  calculateAgeInDays,
  calculateAgeInMonths,
  getConfiguredAgeGroupFromBirthDate,
  getAgeGroup,
  getAgeGroupInDays,
} from '../utils/age-group-utils';

/**
 * Hook que proporciona funciones relacionadas con grupos etarios usando la configuración del sistema
 */
export function useAgeGroups() {
  const config = useConfig<ConfigObject>();

  const ageGroupsCRED = useMemo(() => config?.ageGroupsCRED || [], [config?.ageGroupsCRED]);
  const ageGroupsForCREDForms = useMemo(() => config?.CREDFormsByAgeGroup || [], [config?.CREDFormsByAgeGroup]);

  const getAgeGroupForDisplay = useMemo(() => {
    return (birthDate: string | Date, referenceDate: string | Date = new Date()): AgeGroup | null => {
      if (!birthDate || ageGroupsCRED.length === 0) return null;
      return getConfiguredAgeGroupFromBirthDate(birthDate, ageGroupsCRED, referenceDate);
    };
  }, [ageGroupsCRED]);

  const getAgeGroupForForms = useMemo(() => {
    return (birthDate: string | Date, referenceDate: string | Date = new Date()): AgeGroup | null => {
      if (!birthDate || ageGroupsForCREDForms.length === 0) return null;
      return getConfiguredAgeGroupFromBirthDate(birthDate, ageGroupsForCREDForms, referenceDate);
    };
  }, [ageGroupsForCREDForms]);

  const getAgeGroupByMonths = useMemo(() => {
    return (ageInMonths: number, useFormsConfig = false): AgeGroup | null => {
      const groups = useFormsConfig ? ageGroupsForCREDForms : ageGroupsCRED;
      if (groups.length === 0) return null;
      return getAgeGroup(
        ageInMonths,
        groups.filter((group) => group.minMonths !== undefined && group.maxMonths !== undefined),
      );
    };
  }, [ageGroupsCRED, ageGroupsForCREDForms]);

  const getAgeGroupByDays = useMemo(() => {
    return (ageInDays: number): AgeGroup | null => {
      if (ageGroupsCRED.length === 0) return null;
      return getAgeGroupInDays(ageInDays, ageGroupsCRED);
    };
  }, [ageGroupsCRED]);

  return {
    // Configuraciones disponibles
    ageGroupsCRED,
    ageGroupsForCREDForms,

    // Funciones de utilidad
    calculateAgeInMonths,
    calculateAgeInDays,

    // Funciones para obtener grupos etarios
    getAgeGroupForDisplay,
    getAgeGroupForForms,
    getAgeGroupByMonths,
    getAgeGroupByDays,

    // Estado
    hasConfig: ageGroupsCRED.length > 0 || ageGroupsForCREDForms.length > 0,
  };
}
