import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../../../config-schema';
import { resolveCREDForm } from '../../../hooks/useCREDFormLauncher';

type Severity = 'mild' | 'moderate' | 'severe';

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

export interface AdverseReactionSummary {
  id: string;
  occurrenceDate: string;
  vaccineName: string;
  severity: string;
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
  const form = await resolveCREDForm(config.formsList.adverseReactionForm, 'INMU-002-REPORTE ESAVI');

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
      form: form.uuid,
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

export function useAdverseReactions(patientUuid: string, config: ConfigObject) {
  const url =
    patientUuid && config.encounterTypes.vaccinationAdministration
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${config.encounterTypes.vaccinationAdministration}&v=custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,concept:(uuid,display),value:(uuid,display)))`
      : null;

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

function getObsDisplayValue(obs?: ObsResponse) {
  if (!obs?.value) {
    return '';
  }

  return typeof obs.value === 'object' ? obs.value.display : obs.value;
}
