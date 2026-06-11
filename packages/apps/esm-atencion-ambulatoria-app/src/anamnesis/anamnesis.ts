export interface AnamnesisConceptMap {
  chiefComplaintUuid?: string;
  illnessDurationUuid?: string;
  onsetTypeUuid?: string;
  courseUuid?: string;
  anamnesisUuid?: string;
  appetiteUuid?: string;
  thirstUuid?: string;
  sleepUuid?: string;
  moodUuid?: string;
  urineUuid?: string;
  bowelMovementsUuid?: string;
}

export interface AnamnesisObs {
  uuid?: string;
  concept?: { uuid?: string; display?: string };
  value?: string | number | boolean | { uuid?: string; display?: string } | null;
  display?: string;
}

export interface AnamnesisEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders?: Array<{ display?: string }>;
  obs?: Array<AnamnesisObs>;
}

export interface AnamnesisEntry {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  chiefComplaint: string | null;
  illnessDuration: string | null;
  onsetType: string | null;
  course: string | null;
  narrative: string | null;
  biologicalFunctions: {
    appetite: string | null;
    thirst: string | null;
    sleep: string | null;
    mood: string | null;
    urine: string | null;
    bowelMovements: string | null;
  };
}

export const getAnamnesisObsValue = (obs: Array<AnamnesisObs> | undefined, conceptUuid?: string): string | null => {
  if (!obs?.length || !conceptUuid) {
    return null;
  }

  const match = obs.find((item) => item.concept?.uuid === conceptUuid);
  if (!match || match.value == null) {
    return null;
  }

  if (typeof match.value === 'object') {
    return match.value.display ?? null;
  }

  return String(match.value);
};

export const mapEncounterToAnamnesisEntry = (
  encounter: AnamnesisEncounter,
  concepts: AnamnesisConceptMap,
): AnamnesisEntry => ({
  encounterUuid: encounter.uuid,
  encounterDatetime: encounter.encounterDatetime,
  provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
  chiefComplaint: getAnamnesisObsValue(encounter.obs, concepts.chiefComplaintUuid),
  illnessDuration: getAnamnesisObsValue(encounter.obs, concepts.illnessDurationUuid),
  onsetType: getAnamnesisObsValue(encounter.obs, concepts.onsetTypeUuid),
  course: getAnamnesisObsValue(encounter.obs, concepts.courseUuid),
  narrative: getAnamnesisObsValue(encounter.obs, concepts.anamnesisUuid),
  biologicalFunctions: {
    appetite: getAnamnesisObsValue(encounter.obs, concepts.appetiteUuid),
    thirst: getAnamnesisObsValue(encounter.obs, concepts.thirstUuid),
    sleep: getAnamnesisObsValue(encounter.obs, concepts.sleepUuid),
    mood: getAnamnesisObsValue(encounter.obs, concepts.moodUuid),
    urine: getAnamnesisObsValue(encounter.obs, concepts.urineUuid),
    bowelMovements: getAnamnesisObsValue(encounter.obs, concepts.bowelMovementsUuid),
  },
});

export const hasAnamnesisData = (entry: AnamnesisEntry) =>
  Boolean(
    entry.chiefComplaint ||
      entry.illnessDuration ||
      entry.onsetType ||
      entry.course ||
      entry.narrative ||
      Object.values(entry.biologicalFunctions).some(Boolean),
  );
