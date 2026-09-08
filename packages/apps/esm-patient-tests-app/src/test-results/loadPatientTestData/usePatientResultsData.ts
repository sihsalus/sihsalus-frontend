import { useConnectivity } from '@openmrs/esm-framework';
import { useCallback, useEffect, useState } from 'react';

import loadPatientData, { type PatientResultsData } from './loadPatientData';

type LoadingState = {
  patientUuid: string;
  attempt: number;
  sortedObs: PatientResultsData;
  loaded: boolean;
  error?: Error;
};

const usePatientResultsData = (patientUuid: string) => {
  const isOnline = useConnectivity();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadingState>({
    patientUuid,
    attempt,
    sortedObs: {},
    loaded: false,
  });
  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ patientUuid, attempt, sortedObs: {}, loaded: false });
    if (patientUuid && isOnline) {
      loadPatientData(patientUuid, controller.signal).then(
        (sortedObs) => {
          if (!controller.signal.aborted) setState({ patientUuid, attempt, sortedObs, loaded: true });
        },
        () => {
          if (!controller.signal.aborted) {
            setState({
              patientUuid,
              attempt,
              sortedObs: {},
              loaded: true,
              error: new Error('Test results could not be loaded.'),
            });
          }
        },
      );
    }
    return () => controller.abort();
  }, [patientUuid, attempt, isOnline]);

  // Hide the previous identity synchronously, before the loading effect runs.
  const current =
    state.patientUuid === patientUuid && state.attempt === attempt && isOnline
      ? state
      : { patientUuid, sortedObs: {}, loaded: false, error: undefined };
  return { ...current, isOffline: !isOnline, retry };
};

export default usePatientResultsData;
