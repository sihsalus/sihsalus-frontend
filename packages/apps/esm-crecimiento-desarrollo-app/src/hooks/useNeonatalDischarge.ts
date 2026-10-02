import { openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { type ConfigObject, configSchema } from '../config-schema';
import { type CREDEncounter, encounterMatchesFormIdentifier } from './useEncountersCRED';

interface BirthEncounter extends CREDEncounter {
  voided?: boolean;
  obs?: Array<{ voided?: boolean; concept: { uuid: string }; value?: string | { uuid: string } | null }>;
}

export function getNeonatalDischarge(
  encounters: BirthEncounter[],
  birthDate: string | undefined,
  config: Pick<ConfigObject, 'formsList' | 'neonatalConcepts'>,
) {
  const latest = (form: string) =>
    encounters
      .filter(
        (entry) =>
          !entry.voided &&
          Number.isFinite(Date.parse(entry.encounterDatetime ?? '')) &&
          encounterMatchesFormIdentifier(entry, form),
      )
      .sort((a, b) => Date.parse(b.encounterDatetime ?? '') - Date.parse(a.encounterDatetime ?? ''))[0];
  const observation = (encounter: BirthEncounter | undefined, concept: string) =>
    encounter?.obs?.filter((obs) => !obs.voided && obs.concept.uuid === concept);
  const placeObs = observation(latest(config.formsList.pregnancyDetails), config.neonatalConcepts.birthPlaceUuid);
  const place = placeObs?.length === 1 ? placeObs[0].value : undefined;
  const institutional =
    place != null &&
    typeof place === 'object' &&
    (place.uuid === config.neonatalConcepts.deliveryRoomPlaceUuid ||
      place.uuid === config.neonatalConcepts.emergencyRoomPlaceUuid);
  if (!institutional)
    return {
      dischargeDate: undefined,
      missingDischarge: !(
        place != null &&
        typeof place === 'object' &&
        place.uuid === config.neonatalConcepts.homeBirthPlaceUuid
      ),
    };
  const dischargeObs = observation(
    latest(config.formsList.birthDetails),
    config.neonatalConcepts.dischargeDateTimeUuid,
  );
  const value = dischargeObs?.length === 1 ? dischargeObs[0].value : undefined;
  const date = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  const birth = birthDate ? Date.parse(birthDate) : Number.NaN;
  const valid = Number.isFinite(date) && Number.isFinite(birth) && date >= birth && date <= Date.now();
  return { dischargeDate: valid ? new Date(date) : undefined, missingDischarge: !valid };
}

export function useNeonatalDischarge(patientUuid: string, birthDate: string | undefined, enabled: boolean) {
  const configured = useConfig<ConfigObject>();
  const ageInDays = birthDate ? (Date.now() - Date.parse(birthDate)) / 86400000 : Number.NaN;
  const shouldLoad = enabled && ageInDays >= 0 && ageInDays < 29;
  const config = useMemo(
    () => ({
      formsList: { ...configSchema.formsList._default, ...configured.formsList },
      neonatalConcepts: { ...configSchema.neonatalConcepts._default, ...configured.neonatalConcepts },
    }),
    [configured.formsList, configured.neonatalConcepts],
  );
  const params = new URLSearchParams({
    patient: patientUuid,
    encounterType:
      configured.encounterTypes?.antecedentesPerinatales ??
      configSchema.encounterTypes._default.antecedentesPerinatales,
    v: 'custom:(uuid,encounterDatetime,voided,form:(uuid,name,display),obs:(voided,concept:(uuid),value:(uuid)))',
  });
  const { data, isLoading, error, mutate } = useOpenmrsFetchAll<BirthEncounter>(
    shouldLoad && patientUuid ? `${restBaseUrl}/encounter?${params.toString()}` : null,
    { fetcher: openmrsFetch },
  );
  const timing = useMemo(() => getNeonatalDischarge(data ?? [], birthDate, config), [data, birthDate, config]);
  return {
    ...timing,
    missingDischarge: shouldLoad && timing.missingDischarge,
    isLoading: shouldLoad && isLoading,
    error: shouldLoad ? error : undefined,
    mutate,
  };
}
