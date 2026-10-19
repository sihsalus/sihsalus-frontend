import {
  fhirBaseUrl,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  useFhirFetchAll,
  useOpenmrsFetchAll,
} from '@openmrs/esm-framework';
import { type ImmunizationConfigObject } from '../config-schema';
import { getAmpathImmunizationFormPersistence } from '../immunizations/ampath-form-immunization-config';
import {
  type AmpathImmunizationEncounter,
  mapFromAmpathImmunizationEncounters,
  mergeImmunizationGroups,
} from '../immunizations/ampath-form-immunization-mapper';
import { getFhirImmunizationConceptMappings } from '../immunizations/fhir-immunization-config';
import { mapFromFHIRImmunizationBundle } from '../immunizations/immunization-mapper';
import { getImmunizationSaveErrorDetails } from '../immunizations/immunizations.resource';
import { type FHIRImmunizationResource } from '../types/fhir-immunization-domain';

export function useImmunizations(patientUuid: string) {
  const config = useConfig<ImmunizationConfigObject>();
  const fhirConceptMappings = getFhirImmunizationConceptMappings(config?.fhirConceptMappings);
  const ampathPersistence = getAmpathImmunizationFormPersistence(config);
  const immunizationsUrl = `${fhirBaseUrl}/Immunization?patient=${patientUuid}`;
  const ampathImmunizationsUrl =
    patientUuid && ampathPersistence.enabled
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${ampathPersistence.encounterTypeUuid}&v=custom:(uuid,encounterDatetime,visit:(uuid),location:(uuid),obs:(uuid,concept:(uuid,display),value:(uuid,display,name)))&limit=100`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useFhirFetchAll<FHIRImmunizationResource>(immunizationsUrl);
  const {
    data: ampathData,
    error: ampathError,
    isLoading: isLoadingAmpath,
    isValidating: isValidatingAmpath,
    mutate: mutateAmpath,
  } = useOpenmrsFetchAll<AmpathImmunizationEncounter>(ampathImmunizationsUrl, { partialData: true });

  const errorDetails = getImmunizationSaveErrorDetails(error, fhirConceptMappings);
  const shouldUseAmpathFallback = ampathPersistence.enabled && errorDetails.type === 'fhir-setup';
  const fhirImmunizations = data && !shouldUseAmpathFallback ? mapFromFHIRImmunizationBundle(data) : [];
  let ampathImmunizations: ReturnType<typeof mapFromAmpathImmunizationEncounters> = [];
  let mappingError: unknown;
  try {
    ampathImmunizations = mapFromAmpathImmunizationEncounters(ampathData, config);
  } catch (error) {
    mappingError = error;
  }
  const existingImmunizations = mergeImmunizationGroups(fhirImmunizations, ampathImmunizations);

  return {
    data: existingImmunizations,
    error: (shouldUseAmpathFallback ? null : error) ?? ampathError ?? mappingError,
    isLoading: isLoading || isLoadingAmpath,
    isValidating: isValidating || isValidatingAmpath,
    mutate: async () => {
      await Promise.all([mutate(), mutateAmpath()]);
    },
  };
}

// Deletes a single FHIR Immunization resource (i.e., a single dose/event)
export async function deletePatientImmunization(
  immunizationUuid: string,
  persistenceSource: 'fhir' | 'ampath-form' = 'fhir',
) {
  const controller = new AbortController();

  if (persistenceSource === 'ampath-form') {
    await openmrsFetch(`${restBaseUrl}/encounter/${immunizationUuid}`, {
      method: 'DELETE',
      signal: controller.signal,
    });
    return;
  }

  const url = `${fhirBaseUrl}/Immunization/${immunizationUuid}`;

  await openmrsFetch(url, {
    method: 'DELETE',
    signal: controller.signal,
  });
}
