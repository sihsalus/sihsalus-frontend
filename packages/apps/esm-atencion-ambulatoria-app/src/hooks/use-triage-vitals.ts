import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

export interface TriageVitals {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  weight: number | null;
  height: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  pulse: number | null;
  respiratoryRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  bmi: number | null;
}

interface Obs {
  concept: { uuid: string };
  value: number | string | { display: string };
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

interface VitalsConcepts {
  weightUuid: string;
  heightUuid: string;
  systolicBloodPressureUuid: string;
  diastolicBloodPressureUuid: string;
  pulseUuid: string;
  respiratoryRateUuid: string;
  temperatureUuid: string;
  oxygenSaturationUuid: string;
}

function getNumericObs(obs: Obs[], conceptUuid: string | undefined): number | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find((o) => o.concept?.uuid === conceptUuid);
  if (!match) return null;
  const val = typeof match.value === 'number' ? match.value : parseFloat(String(match.value));
  return Number.isNaN(val) ? null : val;
}

export function useTriageVitals(patientUuid: string, triageEncounterTypeUuid: string, concepts: VitalsConcepts) {
  const url =
    patientUuid && triageEncounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${triageEncounterTypeUuid}&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(concept:(uuid),value))&limit=10`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Encounter[] } }>(url, openmrsFetch);

  const triageEntries: TriageVitals[] = (data?.data?.results ?? []).map((enc) => {
    const weight = getNumericObs(enc.obs, concepts?.weightUuid);
    const height = getNumericObs(enc.obs, concepts?.heightUuid);
    const heightM = height ? height / 100 : null;
    const bmi = weight && heightM && heightM > 0 ? Math.round((weight / (heightM * heightM)) * 10) / 10 : null;

    return {
      encounterUuid: enc.uuid,
      encounterDatetime: enc.encounterDatetime,
      provider: enc.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
      weight,
      height,
      systolicBp: getNumericObs(enc.obs, concepts?.systolicBloodPressureUuid),
      diastolicBp: getNumericObs(enc.obs, concepts?.diastolicBloodPressureUuid),
      pulse: getNumericObs(enc.obs, concepts?.pulseUuid),
      respiratoryRate: getNumericObs(enc.obs, concepts?.respiratoryRateUuid),
      temperature: getNumericObs(enc.obs, concepts?.temperatureUuid),
      oxygenSaturation: getNumericObs(enc.obs, concepts?.oxygenSaturationUuid),
      bmi,
    };
  });

  const latestTriage = triageEntries.length > 0 ? triageEntries[0] : null;

  return {
    triageEntries,
    latestTriage,
    isLoading,
    error,
    mutate,
  };
}
