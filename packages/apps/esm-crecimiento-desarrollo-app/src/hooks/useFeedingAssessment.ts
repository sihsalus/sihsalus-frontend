import { useConfig } from '@openmrs/esm-framework';
import { type ConfigObject, configSchema } from '../config-schema';
import { useCREDFormRecord } from './useCREDFormRecord';

/** Read the practice, counseling and agreements actually recorded in CRED-007. */
export function useFeedingAssessment(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const concepts = config.childNutrition;
  const { readValue, date, isLoading, error } = useCREDFormRecord(
    patientUuid,
    config.formsList?.feedingCounselingForm ?? configSchema.formsList._default.feedingCounselingForm,
  );
  return {
    feedingPractice: readValue(concepts?.feedingPracticeConceptUuid),
    counseling: readValue(concepts?.feedingCounselingConceptUuid),
    caregiverAgreements: readValue(concepts?.caregiverAgreementsConceptUuid),
    lastAssessmentDate: date,
    isLoading,
    error,
  };
}

export default useFeedingAssessment;
