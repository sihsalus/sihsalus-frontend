import { useConfig } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';

import type { PatientSearchConfig } from './config-schema';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

/** Only the chart marks its header; contextual forms reuse the same slot. */
export default function RecentlyViewedPatientTracker({
  patient,
  patientUuid,
  isPatientChart,
}: {
  patient?: fhir.Patient;
  patientUuid?: string;
  isPatientChart?: boolean;
}) {
  const config = useConfig<PatientSearchConfig>();
  const { recordViewedPatient, cacheGeneration } = useRecentlyViewedPatients(
    config.search.showRecentlySearchedPatients,
  );
  const chartScope = useRef({ patientUuid, cacheGeneration });

  useEffect(() => {
    if (chartScope.current.patientUuid !== patientUuid) {
      chartScope.current = { patientUuid, cacheGeneration };
    }
    if (
      isPatientChart === true &&
      patientUuid &&
      patient?.id === patientUuid &&
      chartScope.current.cacheGeneration === cacheGeneration
    ) {
      recordViewedPatient(patientUuid);
    }
  }, [cacheGeneration, isPatientChart, patient?.id, patientUuid, recordViewedPatient]);

  return null;
}
