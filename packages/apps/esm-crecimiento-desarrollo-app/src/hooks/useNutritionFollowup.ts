import { useConfig } from '@openmrs/esm-framework';
import { type ConfigObject, configSchema } from '../config-schema';
import { useCREDFormRecord } from './useCREDFormRecord';

/** Read the classification, evolution and referral recorded together in CRED-008. */
export function useNutritionFollowup(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const concepts = config.childNutrition;
  const { readValue, date, isLoading, error } = useCREDFormRecord(
    patientUuid,
    config.formsList?.nutritionFollowupForm ?? configSchema.formsList._default.nutritionFollowupForm,
  );
  return {
    nutritionClassification: readValue(concepts?.nutritionClassificationConceptUuid),
    evolution: readValue(concepts?.nutritionEvolutionConceptUuid),
    referral: readValue(concepts?.nutritionReferralConceptUuid),
    lastFollowupDate: date,
    isLoading,
    error,
  };
}

export default useNutritionFollowup;
