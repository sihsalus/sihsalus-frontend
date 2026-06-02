export interface MeasurementData {
  eventDate: Date;
  dataValues: {
    weight: string;
    height: string;
    headCircumference: string;
  };
}

export interface BiometricConceptConfig {
  heightUuid?: string;
  weightUuid?: string;
  headCircumferenceUuid?: string;
  [key: string]: unknown;
}

export interface BiometricsObservationResource {
  effectiveDateTime?: string;
  encounter?: {
    reference?: string;
  };
  code?: {
    coding?: Array<{
      code?: string;
    }>;
  };
  valueQuantity?: {
    value?: number;
  };
}

export function getBiometricConceptUuids(concepts?: BiometricConceptConfig | null) {
  return [concepts?.heightUuid, concepts?.weightUuid, concepts?.headCircumferenceUuid].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

export function buildBiometricMeasurements(
  observations: BiometricsObservationResource[] | undefined,
  concepts?: BiometricConceptConfig | null,
): MeasurementData[] {
  if (!observations?.length || !concepts) {
    return [];
  }

  const configuredConcepts = new Set(getBiometricConceptUuids(concepts));
  const measurementsMap = new Map<string, MeasurementData>();

  observations.forEach((resource) => {
    const date = resource?.effectiveDateTime;
    const parsedDate = date ? new Date(date) : null;
    const conceptUuid = resource?.code?.coding?.find(
      (coding) => coding.code && configuredConcepts.has(coding.code),
    )?.code;
    const value = resource?.valueQuantity?.value;

    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || !conceptUuid || value === undefined || value === null) {
      return;
    }

    const dateKey = parsedDate.toISOString().slice(0, 10);
    const groupKey = resource.encounter?.reference ? `${resource.encounter.reference}:${dateKey}` : dateKey;

    if (!measurementsMap.has(groupKey)) {
      measurementsMap.set(groupKey, {
        eventDate: parsedDate,
        dataValues: {
          weight: '',
          height: '',
          headCircumference: '',
        },
      });
    }

    const measurement = measurementsMap.get(groupKey)!;
    assignMeasurementValue(measurement, concepts, conceptUuid, value);
  });

  return Array.from(measurementsMap.values()).sort(
    (left, right) => left.eventDate.getTime() - right.eventDate.getTime(),
  );
}

function assignMeasurementValue(
  measurement: MeasurementData,
  concepts: BiometricConceptConfig,
  conceptUuid: string,
  value: number,
) {
  switch (conceptUuid) {
    case concepts.heightUuid:
      measurement.dataValues.height ||= value.toString();
      break;
    case concepts.weightUuid:
      measurement.dataValues.weight ||= value.toString();
      break;
    case concepts.headCircumferenceUuid:
      measurement.dataValues.headCircumference ||= value.toString();
      break;
  }
}
