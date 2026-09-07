import { useConfig } from '@openmrs/esm-framework';
import { useEffect, useRef } from 'react';

import type { PatientSearchConfig } from './config-schema';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

/** The chart supplies this slot with the successfully loaded FHIR patient. */
export default function RecentlyViewedPatientTracker({
  patient,
  patientUuid,
}: {
  patient?: fhir.Patient;
  patientUuid?: string;
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
    if (patientUuid && patient?.id === patientUuid && chartScope.current.cacheGeneration === cacheGeneration) {
      recordViewedPatient(patientUuid);
    }
  }, [cacheGeneration, patient?.id, patientUuid, recordViewedPatient]);

  return null;
}
