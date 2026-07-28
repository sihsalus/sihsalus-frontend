import { fetchCurrentPatient } from '@openmrs/esm-framework';
import { useCallback, useEffect, useState } from 'react';

const useGetPatients = (patientUuids) => {
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getPatients = useCallback(async (uuids) => {
    try {
      setIsLoading(true);
      const results = await Promise.all(uuids.map(async (uuid) => await fetchCurrentPatient(uuid)));
      setPatients(results);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!patientUuids || patientUuids.length === 0) {
      setPatients([]);
      setIsLoading(false);
    } else {
      getPatients(patientUuids);
    }
  }, [patientUuids, getPatients]);

  return { patients, isLoading };
};

export default useGetPatients;
