import { useFacilityActiveVisits } from '../../active-visits.resource';

export default function useActiveVisits() {
  const { totalResults, error, isLoading } = useFacilityActiveVisits();

  return {
    count: totalResults,
    error,
    isLoading,
  };
}
