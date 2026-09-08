import {
  type ConceptRecord,
  type ConceptUuid,
  type ObsMetaInfo,
  type ObsRecord,
  type ObsUuid,
  type PatientData,
} from '@openmrs/esm-patient-common-lib';
import { uniq } from 'lodash-es';

import {
  extractMetaInformation,
  getEntryConceptClassUuid,
  getResultMeta,
  loadObsEntries,
  loadPresentConcepts,
} from './helpers';

export type PatientResultsData = Record<string, PatientData[string] & { name: string }>;

const isTestConcept = (concept: ConceptRecord): boolean =>
  concept.conceptClass?.name === 'Test' || concept.conceptClass?.name === 'LabSet';

function parseSingleObsData(
  testConceptNameMap: Record<ConceptUuid, string>,
  memberRefs: Record<ObsUuid, Array<[ObsRecord[], number]>>,
  metaInfomation: Record<ConceptUuid, ObsMetaInfo>,
) {
  return (entry: ObsRecord) => {
    entry.conceptClass = getEntryConceptClassUuid(entry);

    if (entry.hasMember) {
      // is a panel
      entry.members = new Array(entry.hasMember.length);
      entry.hasMember.forEach((memb, i) => {
        const memberUuid = memb.reference.split('/')[1];
        memberRefs[memberUuid] ??= [];
        memberRefs[memberUuid].push([entry.members, i]);
      });
    } else {
      // is a single test
      entry.meta = getResultMeta(entry, metaInfomation[entry.conceptClass]);
    }

    if (entry.valueQuantity) {
      const { value, comparator } = entry.valueQuantity as {
        value?: number;
        comparator?: string;
      };
      entry.value = value === undefined ? '--' : `${comparator ? `${comparator} ` : ''}${value}`;
    }

    if (entry.valueCodeableConcept) {
      entry.value = entry.valueCodeableConcept.coding?.[0]?.display ?? entry.valueCodeableConcept.text ?? '--';
    }

    if (typeof entry.valueString === 'string') {
      entry.value = entry.valueString;
    }

    entry.name = testConceptNameMap[entry.conceptClass];
  };
}

async function loadPatientData(patientUuid: string, signal?: AbortSignal): Promise<PatientResultsData> {
  const entries = await loadObsEntries(patientUuid, signal);
  const allConcepts = await loadPresentConcepts(entries, signal);

  const testConcepts = allConcepts.filter(isTestConcept);
  const testConceptUuids: ConceptUuid[] = testConcepts.map((x) => x.uuid);
  const testConceptNameMap: Record<ConceptUuid, string> = Object.fromEntries(
    testConcepts.map(({ uuid, display }) => [uuid, display ?? uuid]),
  );
  const obsByClass: Record<ConceptUuid, ObsRecord[]> = Object.fromEntries(testConceptUuids.map((x) => [x, []]));
  const metaInfomation = extractMetaInformation(testConcepts);

  // obs that are not panels
  const singleEntries: ObsRecord[] = [];

  // a record of observation uuids that are members of panels, mapped to the place where to put them
  const memberRefs: Record<ObsUuid, Array<[ObsRecord[], number]>> = {};
  const parseEntry = parseSingleObsData(testConceptNameMap, memberRefs, metaInfomation);

  entries.forEach((entry) => {
    // remove non test entries (due to unclean FHIR reponse)
    if (!testConceptUuids.includes(getEntryConceptClassUuid(entry))) {
      return;
    }

    parseEntry(entry);

    if (entry.members) {
      obsByClass[entry.conceptClass].push(entry);
    } else {
      singleEntries.push(entry);
    }
  });

  singleEntries.forEach((entry) => {
    const { id } = entry;
    memberRefs[id]?.forEach(([members, index]) => {
      members[index] = entry;
    });

    if (obsByClass[entry.conceptClass]) {
      obsByClass[entry.conceptClass].push(entry);
    }
  });

  // At this point all panels have their members as coming from the backend (i.e. the `hasMembers` field).
  // The panels should display *all* data though, i.e. also the test results that are not listed on `hasMembers`,
  // but share the same concept class as another existing member.
  // -> Go through each panel and add those single entries that are not yet present in the panel.
  Object.values(obsByClass)
    .filter((observations) => observations.some((obs) => obs.members))
    .forEach((observations) => {
      const allSingleMembers = observations.flatMap((obs) => obs.members);
      const allMemberConcepts = uniq(allSingleMembers.map((member) => member.conceptClass));

      for (const concept of allMemberConcepts) {
        const missingEntries = singleEntries.filter(
          (x) => x.conceptClass === concept && !allSingleMembers.some((member) => member.id === x.id),
        );

        for (const missingEntry of missingEntries) {
          observations.push({
            ...missingEntry,
            members: [missingEntry],
          });
        }
      }
    });

  const sortedObs: PatientResultsData = Object.fromEntries(
    Object.entries(obsByClass)
      // remove concepts that did not have any observations
      .filter((x) => x[1].length)
      // Keep concept identity separate from its translated display name.
      .map(([uuid, val]) => {
        const concept = testConcepts.find((item) => item.uuid === uuid);
        const display = concept?.display ?? uuid;
        const type = concept?.conceptClass?.display === 'LabSet' ? 'LabSet' : 'Test';
        return [
          uuid,
          {
            name: display,
            entries: val.sort((ent1, ent2) => Date.parse(ent2.effectiveDateTime) - Date.parse(ent1.effectiveDateTime)),
            type,
            uuid,
          },
        ];
      }),
  );

  return sortedObs;
}

export default loadPatientData;
