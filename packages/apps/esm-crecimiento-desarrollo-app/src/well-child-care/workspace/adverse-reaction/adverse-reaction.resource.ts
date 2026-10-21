import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { resolvePublishedForm } from '@openmrs/esm-patient-common-lib';
import useSWR, { type ScopedMutator } from 'swr';

import type { ConfigObject } from '../../../config-schema';

export type Severity = 'mild' | 'moderate' | 'severe';

export interface AdverseReactionPayload {
  patientUuid: string;
  locationUuid: string;
  visitUuid: string;
  providerUuid: string;
  vaccineName: string;
  reactionDescription: string;
  severity: Severity;
  reportDatetime: Date;
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
  visitUuid,
  providerUuid,
  vaccineName,
  reactionDescription,
  severity,
  reportDatetime,
  config,
}: AdverseReactionPayload) {
  const adverseReactionConfig = config.adverseReactionReporting;
  if (
    !patientUuid ||
    !locationUuid ||
    !visitUuid ||
    !providerUuid ||
    !adverseReactionConfig.encounterRoleUuid ||
    !adverseReactionConfig.formName ||
    !adverseReactionConfig.formVersion
  ) {
    throw new Error('ESAVI requires a patient, visit, location, clinical provider and verified form configuration');
  }
  const form = await resolvePublishedForm(config.formsList.adverseReactionForm, {
    name: adverseReactionConfig.formName,
    version: adverseReactionConfig.formVersion,
  });

  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      patient: patientUuid,
      location: locationUuid,
      encounterDatetime: reportDatetime,
      encounterType: config.encounterTypes.vaccinationAdministration,
      form: form.uuid,
      visit: visitUuid,
      encounterProviders: [{ provider: providerUuid, encounterRole: adverseReactionConfig.encounterRoleUuid }],
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
