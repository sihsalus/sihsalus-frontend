import RecentlySearchedPatients from './compact-patient-search/recently-searched-patients.component';
import { useRestPatients } from './patient-search.resource';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

export default function RecentlyViewedPatients() {
  const { recentlyViewedPatientUuids } = useRecentlyViewedPatients(true);
  const response = useRestPatients(recentlyViewedPatientUuids);
  return <RecentlySearchedPatients {...response} />;
}
