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
  const allergiesUrl = `${restBaseUrl}/patient/${encodeURIComponent(patientUuid)}/allergy?v=full&limit=100&totalCount=true`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    { data: RestAllergyResponse | RestAllergy[] | FHIRAllergyResponse },
    Error
  >(patientUuid ? allergiesUrl : null, fetchAllergies);

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

type AllergyPayload = RestAllergyResponse | RestAllergy[] | FHIRAllergyResponse;

function nextAllergyPageUrl(uri: string, current: string, initial: string): string {
  const page = new URL(uri, current);
  const endpoint = new URL(initial, window.location.href);
  if (
    !['http:', 'https:'].includes(page.protocol) ||
    page.username ||
    page.password ||
    page.pathname !== endpoint.pathname ||
    page.searchParams.getAll('v').some((value) => value !== 'full')
  ) {
    throw new Error('Invalid allergy pagination link.');
  }
  // REST can advertise its internal host behind a frontend proxy.
  page.host = endpoint.host;
  page.protocol = endpoint.protocol;
  page.hash = '';
  page.searchParams.set('v', 'full');
  page.searchParams.set('totalCount', 'true');
  if (!page.searchParams.has('limit')) page.searchParams.set('limit', '100');
  page.searchParams.sort();
  return page.toString();
}

/** A single SWR value is complete only after every REST page has loaded. */
export async function fetchAllergies(url: string): Promise<{ data: AllergyPayload }> {
  const records = new Map<string, RestAllergy>();
  const visited = new Set<string>();
  let next: string | undefined = url;
  let total: number | undefined;

  while (next) {
    const current = new URL(next, window.location.href).toString();
    if (visited.has(current)) throw new Error('The allergy list contains a pagination cycle.');
    visited.add(current);
    const response = await openmrsFetch<AllergyPayload>(next, { rejectOnAuthFailure: true });
    if (response.status === 204) throw new Error('The allergy status is unknown.');
    const page = response.data;
    if (Array.isArray(page) || (page && 'entry' in page)) {
      if (visited.size !== 1) throw new Error('The allergy pagination response changed format.');
      return { data: page };
    }
    if (!page || !('results' in page) || !Array.isArray(page.results)) {
      throw new Error('Invalid allergy response.');
    }
    if (
      page.totalCount !== undefined &&
      (!Number.isInteger(page.totalCount) || page.totalCount < 0 || (total !== undefined && page.totalCount !== total))
    ) {
      throw new Error('The allergy list changed while loading.');
    }
    total ??= page.totalCount;
    for (const allergy of page.results) {
      if (!allergy || typeof allergy.uuid !== 'string' || !allergy.uuid || records.has(allergy.uuid)) {
        throw new Error('Invalid or repeated allergy in paginated response.');
      }
      records.set(allergy.uuid, allergy);
    }
    if (page.links !== undefined && !Array.isArray(page.links)) throw new Error('Invalid allergy pagination links.');
    const nextLinks = page.links?.filter((link) => link?.rel === 'next') ?? [];
    if (nextLinks.length > 1 || (nextLinks.length === 1 && (!nextLinks[0].uri || page.results.length === 0))) {
      throw new Error('Invalid allergy pagination link.');
    }
    next = nextLinks[0]?.uri ? nextAllergyPageUrl(nextLinks[0].uri, current, url) : undefined;
  }

  if (total !== undefined && total !== records.size) throw new Error('The allergy list is incomplete.');
  return { data: { results: [...records.values()] } };
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
