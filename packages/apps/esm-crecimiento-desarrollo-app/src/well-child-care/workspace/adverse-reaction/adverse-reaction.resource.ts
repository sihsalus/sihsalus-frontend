import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR, { type ScopedMutator } from 'swr';

import type { ConfigObject } from '../../../config-schema';

export type Severity = 'mild' | 'moderate' | 'severe';

export interface AdverseReactionPayload {
  patientUuid: string;
  locationUuid: string;
  vaccineName: string;
  reactionDescription: string;
  severity: Severity;
  occurrenceDate: Date;
  config: ConfigObject;
}

interface ObsResponse {
  uuid: string;
  concept: {
    uuid: string;
    display: string;
  };
  value:
    | string
    | {
        uuid: string;
        display: string;
      };
}

interface EncounterResponse {
  uuid: string;
  encounterDatetime: string;
  form?: {
    uuid?: string;
    name?: string;
    display?: string;
  };
  obs?: Array<ObsResponse>;
}

interface FormResponse {
  uuid: string;
  name?: string;
  display?: string;
}

export interface AdverseReactionSummary {
  id: string;
  occurrenceDate: string;
  vaccineName: string;
  severity: string;
  severityCode?: Severity;
  reactionDescription: string;
}

export async function saveAdverseReaction({
  patientUuid,
  locationUuid,
  vaccineName,
  reactionDescription,
  severity,
  occurrenceDate,
  config,
}: AdverseReactionPayload) {
  const adverseReactionConfig = config.adverseReactionReporting;
  const formUuid = await resolveFormUuid(config.formsList.adverseReactionForm);

  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      patient: patientUuid,
      location: locationUuid,
      encounterDatetime: occurrenceDate,
      encounterType: config.encounterTypes.vaccinationAdministration,
      form: formUuid,
      obs: [
        {
          concept: adverseReactionConfig.vaccineNameConceptUuid,
          value: vaccineName,
        },
        {
          concept: adverseReactionConfig.severityConceptUuid,
          value: adverseReactionConfig.severityAnswers[severity],
        },
        {
          concept: adverseReactionConfig.reactionDescriptionConceptUuid,
          value: reactionDescription,
        },
      ],
    },
  });
}

async function resolveFormUuid(formIdentifier: string) {
  if (isUuid(formIdentifier)) {
    return formIdentifier;
  }

  const response = await openmrsFetch<{ results: Array<FormResponse> }>(
    `${restBaseUrl}/form?q=${encodeURIComponent(formIdentifier)}&v=custom:(uuid,name,display)`,
  );

  const exactMatch = response.data.results.find(
    (form) => form.name === formIdentifier || form.display === formIdentifier || form.uuid === formIdentifier,
  );

  return exactMatch?.uuid ?? response.data.results[0]?.uuid ?? formIdentifier;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function getAdverseReactionsUrl(patientUuid: string, config: ConfigObject) {
  return patientUuid && config.encounterTypes.vaccinationAdministration
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${config.encounterTypes.vaccinationAdministration}&v=custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,concept:(uuid,display),value:(uuid,display)))`
    : null;
}

export function refreshAdverseReactions(patientUuid: string, config: ConfigObject, mutate: ScopedMutator) {
  const url = getAdverseReactionsUrl(patientUuid, config);
  if (!url) return Promise.reject(new Error('Adverse reaction query unavailable'));
  // Revalidation alone can resolve with stale data after a failed fetch. Await the
  // actual request so a confirmed save and a failed table refresh stay distinct.
  return mutate(url, () => openmrsFetch(url), { revalidate: false });
}

export function useAdverseReactions(patientUuid: string, config: ConfigObject) {
  const url = getAdverseReactionsUrl(patientUuid, config);

  const { data, error, isLoading, mutate } = useSWR<FetchResponse<{ results: Array<EncounterResponse> }>, Error>(
    url,
    openmrsFetch,
  );

  const adverseReactionConfig = config.adverseReactionReporting;
  const adverseReactionForm = config.formsList.adverseReactionForm;

  const reactions =
    data?.data?.results
      ?.filter(({ form }) => [form?.uuid, form?.name, form?.display].includes(adverseReactionForm))
      .map((encounter) => {
        const obsByConcept = new Map(encounter.obs?.map((obs) => [obs.concept.uuid, obs]));

        return {
          id: encounter.uuid,
          occurrenceDate: encounter.encounterDatetime,
          vaccineName: getObsDisplayValue(obsByConcept.get(adverseReactionConfig.vaccineNameConceptUuid)),
          severity: getObsDisplayValue(obsByConcept.get(adverseReactionConfig.severityConceptUuid)),
          severityCode: getSeverityCode(
            obsByConcept.get(adverseReactionConfig.severityConceptUuid),
            adverseReactionConfig.severityAnswers,
          ),
          reactionDescription: getObsDisplayValue(
            obsByConcept.get(adverseReactionConfig.reactionDescriptionConceptUuid),
          ),
        };
      }) ?? [];

  return {
    reactions,
    error,
    isLoading,
    mutate,
  };
}

function getSeverityCode(obs: ObsResponse | undefined, answers: Record<Severity, string>): Severity | undefined {
  if (!obs?.value || typeof obs.value !== 'object') return undefined;
  const uuid = obs.value.uuid;
  return (Object.keys(answers) as Severity[]).find((severity) => answers[severity] === uuid);
}

function getObsDisplayValue(obs?: ObsResponse) {
  if (!obs?.value) {
    return '';
  }

  return typeof obs.value === 'object' ? obs.value.display : obs.value;
}
