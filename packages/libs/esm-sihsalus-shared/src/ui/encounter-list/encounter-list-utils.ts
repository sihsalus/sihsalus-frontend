import { formatDate, parseDate } from '@openmrs/esm-framework';

import {
  OPENMRS_LEGACY_BOOLEAN_FALSE_CONCEPT_UUID,
  OPENMRS_LEGACY_BOOLEAN_TRUE_CONCEPT_UUID,
  TRUE_CONCEPT_UUID,
} from '../../constants';
import type { Observation } from '../../types';

type NamedConcept = {
  uuid?: string;
  name?: {
    name?: string;
  };
  names?: Array<{
    conceptNameType: string;
    name: string;
  }>;
  display?: string;
};

type EncounterWithObservations = {
  obs?: Array<Observation>;
};

type FormConceptMap = Record<string, { display?: string; answers?: Record<string, string> }>;

export function getEncounterValues(encounter: Record<string, string>, param: string, isDate?: boolean): string {
  if (isDate) {
    return formatDate(parseDate(encounter[param]));
  } else {
    return encounter[param] ? encounter[param] : '--';
  }
}

export function formatDateTime(dateString: string): string {
  if (dateString.includes('.')) {
    dateString = dateString.split('.')[0];
  }
  return formatDate(parseDate(dateString));
}

export function obsArrayDateComparator(left: { obsDatetime?: string }, right: { obsDatetime?: string }): number {
  return new Date(right.obsDatetime ?? 0).getTime() - new Date(left.obsDatetime ?? 0).getTime();
}

export function findObs(encounter: EncounterWithObservations, obsConcept: string): Observation | undefined {
  const allObs = encounter?.obs?.filter((observation) => observation.concept?.uuid === obsConcept) || [];
  return allObs?.length === 1 ? allObs[0] : allObs?.sort(obsArrayDateComparator)[0];
}

export function getObsFromEncounters(
  encounters: Array<EncounterWithObservations>,
  obsConcept: string,
): string | number {
  const filteredEnc = encounters?.find((enc) => enc.obs?.find((obs) => obs.concept?.uuid === obsConcept));
  return getObsFromEncounter(filteredEnc, obsConcept);
}

export function getMultipleObsFromEncounter(encounter: EncounterWithObservations, obsConcepts: Array<string>): string {
  const observations: Array<string | number> = [];
  obsConcepts.forEach((concept) => {
    const obs = getObsFromEncounter(encounter, concept);
    if (obs !== '--') {
      observations.push(obs);
    }
  });

  return observations.length ? observations.join(', ') : '--';
}

export function getObsFromEncounter(
  encounter: EncounterWithObservations,
  obsConcept: string,
  isDate?: boolean,
  isTrueFalseConcept?: boolean,
): string | number {
  const obs = findObs(encounter, obsConcept);

  if (!obs) {
    return '--';
  }

  if (isTrueFalseConcept) {
    if (typeof obs.value === 'object' && obs.value?.uuid === TRUE_CONCEPT_UUID) {
      return 'Yes';
    }
    return 'No';
  }
  if (isDate) {
    return typeof obs.value === 'string' ? formatDate(parseDate(obs.value), { mode: 'wide' }) : '--';
  }
  if (typeof obs.value === 'object' && obs.value?.names) {
    return obs.value?.names?.find((conceptName) => conceptName.conceptNameType === 'SHORT')?.name || '--';
  }
  if (typeof obs.value === 'object' && obs.value !== null) {
    return obs.value.display ?? '--';
  }
  if (typeof obs.value === 'string' || typeof obs.value === 'number') {
    return obs.value;
  }
  return '--';
}

export function mapObsValueToFormLabel(
  conceptUuid: string,
  answerConceptUuid: string | undefined,
  formConceptMap: FormConceptMap,
  defaultValue: string | number | NamedConcept | null,
): string {
  if (typeof defaultValue === 'number') {
    // check early if value is number and return
    return String(defaultValue);
  }

  const conceptMapOverride = formConceptMap !== undefined && Object.keys(formConceptMap).length > 0;
  if (conceptMapOverride && answerConceptUuid !== undefined) {
    // check for boolean concepts
    if (answerConceptUuid === OPENMRS_LEGACY_BOOLEAN_FALSE_CONCEPT_UUID) {
      answerConceptUuid = '0';
    } else if (answerConceptUuid === OPENMRS_LEGACY_BOOLEAN_TRUE_CONCEPT_UUID) {
      answerConceptUuid = '1';
    }
    const theDisplay = formConceptMap[conceptUuid]?.answers[answerConceptUuid];

    if (typeof theDisplay !== 'undefined') {
      return theDisplay;
    } else {
      return extractDefaultValueBasedOnType(defaultValue);
    }
  } else {
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      return defaultValue.name?.name ?? '--';
    }
    return extractDefaultValueBasedOnType(defaultValue);
  }
}

function extractDefaultValueBasedOnType(defaultValue: string | number | NamedConcept | null): string {
  if (defaultValue === null || defaultValue === undefined) {
    return '--';
  }
  const typeOfVal = typeof defaultValue;

  if (typeOfVal === 'number') {
    return String(defaultValue);
  }
  if (typeOfVal === 'string') {
    const strValue = defaultValue as string;
    const stringParts = strValue.split(':');
    if (stringParts.length === 1) {
      return strValue;
    } else if (stringParts.length === 2) {
      return stringParts[1];
    } else {
      // TODO: identify other cases to support here
      // check for date
      return formatDate(parseDate(strValue));
    }
  } else if (typeof defaultValue === 'object') {
    return defaultValue?.name?.name ?? '--'; // extract the default name from the object
  }
  return '--';
}
export function mapConceptToFormLabel(
  conceptUuid: string,
  formConceptMap: FormConceptMap,
  defaultValue: string,
): string {
  if (formConceptMap === undefined) {
    return defaultValue;
  }

  const theDisplay = formConceptMap[conceptUuid] ? formConceptMap[conceptUuid].display : defaultValue;

  return theDisplay;
}

/**
 * This is a util method stub for generating the mapping for labels in the form schema
 * It should be moved to an appropriate place if not here
 */
export function generateFormLabelsFromJSON(): void {
  const htsScreeningJson: {
    pages: Array<{
      sections: Array<{
        questions: Array<{
          label: string;
          questionOptions: {
            concept: string;
            answers?: Array<{ concept: string; label: string }>;
          };
        }>;
      }>;
    }>;
  } = { pages: [] };
  const result: Record<string, { display: string; answers: Record<string, string> }> = {};
  htsScreeningJson.pages.forEach((page) => {
    page.sections.forEach((section) => {
      section.questions.forEach((question) => {
        const answersMap: Record<string, string> = {};
        const questionObject: { display: string; answers: Record<string, string> } = {
          display: question.label,
          answers: answersMap,
        };
        question.questionOptions.answers?.forEach((ans) => {
          answersMap[ans.concept] = ans.label;
        });
        result[question.questionOptions.concept] = questionObject;
      });
    });
  });
}
