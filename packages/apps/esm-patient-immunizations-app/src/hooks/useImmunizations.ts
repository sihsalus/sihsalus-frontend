import {
  fhirBaseUrl,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  useFhirFetchAll,
  useOpenmrsFetchAll,
  useSession,
} from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import { type ImmunizationConfigObject } from '../config-schema';
import { getAmpathImmunizationFormPersistence } from '../immunizations/ampath-form-immunization-config';
import {
  type AmpathImmunizationEncounter,
  mapFromAmpathImmunizationEncounters,
  mergeImmunizationGroups,
} from '../immunizations/ampath-form-immunization-mapper';
import { getFhirImmunizationConceptMappings } from '../immunizations/fhir-immunization-config';
import {
  addEncounterProvider,
  getRepairableEncounterUuid,
  getUnknownEncounterRoleUuid,
} from '../immunizations/immunization-encounter-provider.resource';
import { mapFromFHIRImmunizationBundle } from '../immunizations/immunization-mapper';
import { getImmunizationSaveErrorDetails } from '../immunizations/immunizations.resource';
import { type FHIRImmunizationResource } from '../types/fhir-immunization-domain';

function isUnsupportedFhirImmunizationError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const candidate = error as { status?: number; response?: { status?: number }; message?: string };
  return (
    candidate.status === 501 ||
    candidate.response?.status === 501 ||
    candidate.message?.includes('501') ||
    candidate.message?.toLowerCase().includes('not implemented')
  );
}

export function useImmunizations(patientUuid: string) {
  const config = useConfig<ImmunizationConfigObject>();
  const session = useSession();
  const providerUuid = session?.currentProvider?.uuid;
  const unknownEncounterRoleUuid = getUnknownEncounterRoleUuid(config);
  const fhirConceptMappings = getFhirImmunizationConceptMappings(config?.fhirConceptMappings);
  const ampathPersistence = getAmpathImmunizationFormPersistence(config);
  const immunizationsUrl = `${fhirBaseUrl}/Immunization?patient=${patientUuid}`;
  const ampathImmunizationsUrl =
    patientUuid && ampathPersistence.enabled
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${ampathPersistence.encounterTypeUuid}&form=${ampathPersistence.formUuid}&v=custom:(uuid,encounterDatetime,visit:(uuid),location:(uuid),obs:(uuid,concept:(uuid,display),value:(uuid,display,name)))&limit=100`
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
  const shouldUseAmpathFallback =
    ampathPersistence.enabled &&
    isUnsupportedFhirImmunizationError(error) &&
    errorDetails.type !== 'missing-fhir-mapping';
  const fhirImmunizations = data && !shouldUseAmpathFallback ? mapFromFHIRImmunizationBundle(data) : [];
  const ampathImmunizations = mapFromAmpathImmunizationEncounters(ampathData, config);
  const existingImmunizations = mergeImmunizationGroups(fhirImmunizations, ampathImmunizations);

  const mutateAll = useCallback(async () => {
    await Promise.all([mutate(), mutateAmpath()]);
  }, [mutate, mutateAmpath]);

  // FHIR2 refuses the whole list when one vaccination encounter has no
  // provider with the "Unknown" role; its diagnostics name that encounter.
  const repairableEncounterUuid = useMemo(
    () => (shouldUseAmpathFallback ? null : getRepairableEncounterUuid(error)),
    [error, shouldUseAmpathFallback],
  );

  const repairEncounterProvider = useCallback(async () => {
    if (!repairableEncounterUuid || !providerUuid) {
      return;
    }
    await addEncounterProvider(repairableEncounterUuid, providerUuid, unknownEncounterRoleUuid);
    await mutateAll();
  }, [mutateAll, providerUuid, repairableEncounterUuid, unknownEncounterRoleUuid]);

  return {
    data: existingImmunizations,
    error: (shouldUseAmpathFallback ? null : error) ?? ampathError,
    isLoading: isLoading || isLoadingAmpath,
    isValidating: isValidating || isValidatingAmpath,
    mutate: mutateAll,
    repairableEncounterUuid,
    repairEncounterProvider: repairableEncounterUuid && providerUuid ? repairEncounterProvider : null,
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
