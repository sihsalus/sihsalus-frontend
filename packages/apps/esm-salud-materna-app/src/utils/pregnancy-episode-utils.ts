export interface MaternalObservation {
  concept?: { uuid?: string };
  value?: unknown;
  groupMembers?: MaternalObservation[];
}

export interface MaternalEncounter {
  uuid: string;
  encounterDatetime: string;
  form?: { uuid?: string; name?: string; display?: string };
  obs?: MaternalObservation[];
}

const normalizeIdentifier = (value?: string) => value?.trim().toLocaleLowerCase() ?? '';

export function encounterMatchesForm(encounter: MaternalEncounter, formIdentifier?: string): boolean {
  const normalizedIdentifier = normalizeIdentifier(formIdentifier);
  if (!normalizedIdentifier) return false;

  return [encounter.form?.uuid, encounter.form?.name, encounter.form?.display]
    .map(normalizeIdentifier)
    .some((value) => value === normalizedIdentifier);
}

export function flattenMaternalObservations(observations: MaternalObservation[] = []): MaternalObservation[] {
  return observations.flatMap((observation) => [
    observation,
    ...flattenMaternalObservations(observation.groupMembers ?? []),
  ]);
}

export function getObservationValue(observations: MaternalObservation[] | undefined, conceptUuid?: string): unknown {
  if (!conceptUuid) return undefined;
  return flattenMaternalObservations(observations).find((observation) => observation.concept?.uuid === conceptUuid)
    ?.value;
}

export function isWithinPregnancyEpisode(encounterDatetime: string | undefined, pregnancyStartDate?: string): boolean {
  if (!encounterDatetime || !pregnancyStartDate) return false;

  const encounterTime = new Date(encounterDatetime).getTime();
  const pregnancyStartTime = new Date(pregnancyStartDate).getTime();
  return Number.isFinite(encounterTime) && Number.isFinite(pregnancyStartTime) && encounterTime >= pregnancyStartTime;
}

export function toDateString(value: unknown): string | undefined {
  if (typeof value === 'string' && Number.isFinite(new Date(value).getTime())) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return undefined;
}
