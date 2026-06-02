import {
  fhirBaseUrl,
  type OpenmrsResource,
  openmrsFetch,
  openmrsObservableFetch,
  restBaseUrl,
  useConfig,
} from '@openmrs/esm-framework';
import { map } from 'rxjs/operators';
import useSWR from 'swr';
import type { AllergiesConfigObject } from '../config-schema';
import {
  type Allergy,
  type FHIRAllergy,
  type FHIRAllergyResponse,
  type PatientAllergyPayload,
  REACTION_SEVERITY,
  type ReactionSeverity,
  type RestAllergy,
  type RestAllergyResponse,
  type UseAllergies,
} from '../types';

export function useAllergies(patientUuid: string): UseAllergies {
  const { concepts } = useConfig<AllergiesConfigObject>();
  const allergiesUrl = `${restBaseUrl}/patient/${patientUuid}/allergy?v=full`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    { data: RestAllergyResponse | RestAllergy[] | FHIRAllergyResponse },
    Error
  >(patientUuid ? allergiesUrl : null, openmrsFetch);

  const formattedAllergies = data?.data
    ? getAllergyResources(data.data)
        .map((allergy) => mapAllergyProperties(allergy, concepts))
        .sort((a, b) => (b.lastUpdated > a.lastUpdated ? 1 : -1))
    : null;

  return {
    allergies: data ? formattedAllergies : null,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

function getAllergyResources(
  data: RestAllergyResponse | RestAllergy[] | FHIRAllergyResponse,
): Array<FHIRAllergy | RestAllergy> {
  if (Array.isArray(data)) {
    return data;
  }

  if ('results' in data && Array.isArray(data.results)) {
    return data.results;
  }

  if ('entry' in data && Array.isArray(data.entry)) {
    return data.entry.map((entry) => entry.resource).filter(Boolean);
  }

  return [];
}

function isFhirAllergy(allergy: FHIRAllergy | RestAllergy): allergy is FHIRAllergy {
  return 'resourceType' in allergy && allergy.resourceType === 'AllergyIntolerance';
}

function mapAllergyProperties(
  allergy: FHIRAllergy | RestAllergy,
  concepts?: AllergiesConfigObject['concepts'],
): Allergy {
  return isFhirAllergy(allergy) ? mapFhirAllergyProperties(allergy) : mapRestAllergyProperties(allergy, concepts);
}

function mapFhirAllergyProperties(allergy: FHIRAllergy): Allergy {
  const manifestations = allergy?.reaction[0]?.manifestation?.map((coding) => coding?.text);
  return {
    id: allergy?.id,
    clinicalStatus: allergy?.clinicalStatus?.coding[0]?.display,
    criticality: allergy?.criticality,
    display: allergy?.code?.text ?? allergy?.code?.coding[0]?.display,
    recordedDate: allergy?.recordedDate,
    recordedBy: allergy?.recorder?.display,
    recorderType: allergy?.recorder?.type,
    note: allergy?.note?.[0]?.text,
    reactionToSubstance: allergy?.reaction[0]?.substance?.text,
    reactionManifestations: manifestations,
    reactionSeverity: allergy?.reaction[0]?.severity,
    lastUpdated: allergy?.meta?.lastUpdated,
  };
}

function mapRestAllergyProperties(allergy: RestAllergy, concepts?: AllergiesConfigObject['concepts']): Allergy {
  const allergenDisplay =
    allergy?.allergen?.nonCodedAllergen ?? allergy?.allergen?.codedAllergen?.display ?? allergy?.display ?? '--';
  const reactionManifestations =
    allergy?.reactions
      ?.map((reaction) => reaction.reactionNonCoded ?? reaction.reaction?.display)
      .filter((reaction): reaction is string => Boolean(reaction)) ?? [];
  const lastUpdated = allergy?.auditInfo?.dateChanged ?? allergy?.auditInfo?.dateCreated ?? '';

  return {
    id: allergy?.uuid ?? allergenDisplay,
    clinicalStatus: '',
    criticality: '',
    display: allergenDisplay,
    recordedDate: allergy?.auditInfo?.dateCreated ?? '',
    recordedBy: allergy?.auditInfo?.creator?.display ?? allergy?.auditInfo?.changedBy?.display ?? '',
    recorderType: '',
    note: allergy?.comment ?? '',
    reactionToSubstance: allergenDisplay,
    reactionManifestations,
    reactionSeverity: normalizeReactionSeverity(allergy?.severity, concepts),
    lastUpdated,
  };
}

function normalizeReactionSeverity(
  severity: RestAllergy['severity'] | undefined,
  concepts?: AllergiesConfigObject['concepts'],
): ReactionSeverity | undefined {
  if (!severity) {
    return undefined;
  }

  const severityByDisplay: Record<string, ReactionSeverity> = {
    mild: REACTION_SEVERITY.MILD,
    leve: REACTION_SEVERITY.MILD,
    moderate: REACTION_SEVERITY.MODERATE,
    moderada: REACTION_SEVERITY.MODERATE,
    moderado: REACTION_SEVERITY.MODERATE,
    severe: REACTION_SEVERITY.SEVERE,
    severa: REACTION_SEVERITY.SEVERE,
    severo: REACTION_SEVERITY.SEVERE,
    grave: REACTION_SEVERITY.SEVERE,
  };

  if (severity.uuid && concepts) {
    const severityByUuid: Record<string, ReactionSeverity> = {
      [concepts.mildReactionUuid]: REACTION_SEVERITY.MILD,
      [concepts.moderateReactionUuid]: REACTION_SEVERITY.MODERATE,
      [concepts.severeReactionUuid]: REACTION_SEVERITY.SEVERE,
    };
    const uuidSeverity = severityByUuid[severity.uuid];
    if (uuidSeverity) {
      return uuidSeverity;
    }
  }

  return severity.display ? severityByDisplay[severity.display.toLowerCase()] : undefined;
}

export function fetchAllergyByUuid(allergyUuid: string) {
  return openmrsObservableFetch<FHIRAllergy>(`${fhirBaseUrl}/AllergyIntolerance/${allergyUuid}`).pipe(
    map(({ data }) => mapFhirAllergyProperties(data)),
  );
}

export function saveAllergy(
  patientAllergy: PatientAllergyPayload,
  patientUuid: string,
  abortController: AbortController,
) {
  const reactions = patientAllergy.reactionUuids.map((reaction: OpenmrsResource) => {
    return {
      reaction: {
        uuid: reaction.uuid,
      },
    };
  });

  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}/allergy`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: {
      allergen: {
        allergenType: patientAllergy?.allergenType,
        codedAllergen: {
          uuid: patientAllergy?.codedAllergenUuid,
        },
      },
      severity: {
        uuid: patientAllergy?.severityUuid,
      },
      comment: patientAllergy?.comment,
      reactions: reactions,
    },
    signal: abortController.signal,
  });
}

export function deletePatientAllergy(patientUuid: string, allergyUuid: string, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}/allergy/${allergyUuid}`, {
    method: 'DELETE',
    signal: abortController.signal,
  });
}
