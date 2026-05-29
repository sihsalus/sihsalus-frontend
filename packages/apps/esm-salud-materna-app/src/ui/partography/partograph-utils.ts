export interface PartographConcepts {
  timeRecordedUuid: string;
  fetalHeartRateUuid: string;
  cervicalDilationUuid: string;
  descentOfHeadUuid: string;
  contractionFrequencyUuid: string;
  contractionIntensityUuid?: string;
  contractionDurationUuid: string;
  maternalSystolicBloodPressureUuid?: string;
  maternalDiastolicBloodPressureUuid?: string;
  maternalPulseUuid?: string;
  maternalTemperatureUuid?: string;
  maternalRespiratoryRateUuid?: string;
  urineOutputUuid?: string;
  fetalDeathUuid?: string;
  observationsUuid?: string;
}

export interface PartographGroupMember {
  concept?: {
    uuid?: string;
  };
  value?: string | number | { uuid?: string; display?: string; name?: string } | null;
}

export interface PartographProgressObservation {
  uuid: string;
  obsDatetime?: string;
  groupMembers?: PartographGroupMember[] | null;
}

export interface PartographRecord {
  id: string;
  date: string;
  timeRecorded?: string;
  fetalHeartRate?: number;
  cervicalDilation?: number;
  descentOfHead?: string;
  descentOfHeadValue?: number;
  contractionFrequency?: number;
  contractionIntensity?: string;
  contractionDuration?: number;
  maternalSystolicBloodPressure?: number;
  maternalDiastolicBloodPressure?: number;
  maternalPulse?: number;
  maternalTemperature?: number;
  maternalRespiratoryRate?: number;
  urineOutput?: string;
  fetalDeath?: string;
  observations?: string;
}

export type PartographMetricKey =
  | 'fetalHeartRate'
  | 'cervicalDilation'
  | 'descentOfHeadValue'
  | 'contractionFrequency'
  | 'contractionDuration';

export interface PartographChartPoint {
  group: string;
  date: Date;
  value: number;
  displayValue: string;
}

export function buildPartographRecords(
  observations: PartographProgressObservation[],
  concepts: PartographConcepts,
  descentOfHeadAnswerLabels: Record<string, string>,
) {
  return observations
    .map((observation) => buildPartographRecord(observation, concepts, descentOfHeadAnswerLabels))
    .filter((record): record is PartographRecord => Boolean(record))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

export function buildPartographChartData(
  records: PartographRecord[],
  metricKey: PartographMetricKey,
  groupLabel: string,
): PartographChartPoint[] {
  return records
    .map((record) => {
      const value = toFiniteNumber(record[metricKey]);
      const date = new Date(record.timeRecorded ?? record.date);

      if (value === null || Number.isNaN(date.getTime())) {
        return null;
      }

      return {
        group: groupLabel,
        date,
        value,
        displayValue:
          metricKey === 'descentOfHeadValue' ? (record.descentOfHead ?? value.toString()) : value.toString(),
      };
    })
    .filter((point): point is PartographChartPoint => Boolean(point));
}

export function normalizeDescentOfHead(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const [numeratorText, denominatorText] = value.split('/');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }

  return numerator;
}

export function toFiniteNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function buildPartographRecord(
  observation: PartographProgressObservation,
  concepts: PartographConcepts,
  descentOfHeadAnswerLabels: Record<string, string>,
): PartographRecord | null {
  const groupMembers = observation.groupMembers ?? [];
  if (!groupMembers.length) {
    return null;
  }

  const valuesByConcept = groupMembers.reduce<Record<string, string | number | undefined>>((acc, groupMember) => {
    const conceptUuid = groupMember.concept?.uuid;
    const value = getObservationValue(groupMember.value);

    if (conceptUuid && value !== undefined) {
      acc[conceptUuid] = value;
    }

    return acc;
  }, {});

  const timeRecorded = getStringValue(getConceptValue(valuesByConcept, concepts.timeRecordedUuid));
  const recordDate = getValidDateString(timeRecorded) ?? getValidDateString(observation.obsDatetime);
  if (!recordDate) {
    return null;
  }

  const descentOfHeadAnswer = getStringValue(getConceptValue(valuesByConcept, concepts.descentOfHeadUuid));
  const descentOfHead = descentOfHeadAnswer
    ? (descentOfHeadAnswerLabels[descentOfHeadAnswer] ?? descentOfHeadAnswer)
    : undefined;

  return {
    id: observation.uuid,
    date: recordDate,
    timeRecorded: getValidDateString(timeRecorded),
    fetalHeartRate: toFiniteNumber(getConceptValue(valuesByConcept, concepts.fetalHeartRateUuid)) ?? undefined,
    cervicalDilation: toFiniteNumber(getConceptValue(valuesByConcept, concepts.cervicalDilationUuid)) ?? undefined,
    descentOfHead,
    descentOfHeadValue: normalizeDescentOfHead(descentOfHead),
    contractionFrequency:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.contractionFrequencyUuid)) ?? undefined,
    contractionIntensity: getStringValue(getConceptValue(valuesByConcept, concepts.contractionIntensityUuid)),
    contractionDuration:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.contractionDurationUuid)) ?? undefined,
    maternalSystolicBloodPressure:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.maternalSystolicBloodPressureUuid)) ?? undefined,
    maternalDiastolicBloodPressure:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.maternalDiastolicBloodPressureUuid)) ?? undefined,
    maternalPulse: toFiniteNumber(getConceptValue(valuesByConcept, concepts.maternalPulseUuid)) ?? undefined,
    maternalTemperature:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.maternalTemperatureUuid)) ?? undefined,
    maternalRespiratoryRate:
      toFiniteNumber(getConceptValue(valuesByConcept, concepts.maternalRespiratoryRateUuid)) ?? undefined,
    urineOutput: getStringValue(getConceptValue(valuesByConcept, concepts.urineOutputUuid)),
    fetalDeath: getStringValue(getConceptValue(valuesByConcept, concepts.fetalDeathUuid)),
    observations: getStringValue(getConceptValue(valuesByConcept, concepts.observationsUuid)),
  };
}

function getConceptValue(valuesByConcept: Record<string, string | number | undefined>, conceptUuid?: string) {
  return conceptUuid ? valuesByConcept[conceptUuid] : undefined;
}

function getObservationValue(value: PartographGroupMember['value']) {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object') {
    return value.display ?? value.name ?? value.uuid;
  }

  return undefined;
}

function getStringValue(value: string | number | undefined) {
  return value === undefined ? undefined : String(value);
}

function getValidDateString(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
