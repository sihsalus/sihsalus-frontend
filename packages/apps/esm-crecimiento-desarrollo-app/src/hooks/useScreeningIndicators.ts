import { useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import type { ConfigObject } from '../config-schema';

import useEncountersCRED, { encounterMatchesFormIdentifier } from './useEncountersCRED';

interface ScreeningItem {
  name: string;
  translationKey: string;
  completed: boolean;
  date: string | null;
  result: string | null;
}

interface ScreeningIndicatorsResult {
  screenings: ScreeningItem[];
  completedCount: number;
  totalRequired: number;
  percentage: number;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const screeningDefinitions = [
  {
    formKey: 'anemiaScreeningForm',
    name: 'Hemoglobina',
    translationKey: 'screeningHemoglobin',
  },
  {
    formKey: 'ediDevelopmentForm',
    name: 'Desarrollo infantil',
    translationKey: 'screeningDevelopment',
  },
  {
    formKey: 'violenceDisciplineScreeningForm',
    name: 'Violencia y maltrato',
    translationKey: 'screeningViolence',
  },
  {
    formKey: 'visualScreeningForm',
    name: 'Tamizaje visual',
    translationKey: 'screeningVisual',
  },
  {
    formKey: 'hearingScreeningForm',
    name: 'Evaluación auditiva',
    translationKey: 'screeningHearing',
  },
] as const satisfies ReadonlyArray<{
  formKey: keyof ConfigObject['formsList'];
  name: string;
  translationKey: string;
}>;

/** Returns the latest completion of each mandatory child screening form. */
export function useScreeningIndicators(patientUuid: string): ScreeningIndicatorsResult {
  const config = useConfig<ConfigObject>();
  const { encounters, isLoading, error, mutate } = useEncountersCRED(patientUuid);

  const result = useMemo(() => {
    const screenings = screeningDefinitions.map((definition): ScreeningItem => {
      const formIdentifier = config.formsList[definition.formKey];
      const latestEncounter = (encounters ?? [])
        .filter((encounter) => encounterMatchesFormIdentifier(encounter, formIdentifier))
        .sort(
          (first, second) =>
            new Date(second.encounterDatetime ?? 0).getTime() - new Date(first.encounterDatetime ?? 0).getTime(),
        )[0];

      return {
        name: definition.name,
        translationKey: definition.translationKey,
        completed: Boolean(latestEncounter),
        date: latestEncounter?.encounterDatetime ? dayjs(latestEncounter.encounterDatetime).format('DD/MM/YYYY') : null,
        result: latestEncounter?.form?.display ?? latestEncounter?.form?.name ?? null,
      };
    });
    const completedCount = screenings.filter((screening) => screening.completed).length;
    const totalRequired = screenings.length;

    return {
      screenings,
      completedCount,
      totalRequired,
      percentage: totalRequired > 0 ? (completedCount / totalRequired) * 100 : 0,
    };
  }, [config.formsList, encounters]);

  return {
    ...result,
    isLoading,
    error,
    mutate: () => {
      void mutate();
    },
  };
}

export default useScreeningIndicators;
