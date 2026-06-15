import { restBaseUrl } from '@openmrs/esm-framework';
import {
  type ConceptRecord,
  type ConceptUuid,
  type OBSERVATION_INTERPRETATION,
  type ObsMetaInfo,
  type ObsRecord,
  type PatientData,
} from '@openmrs/esm-patient-common-lib';

const PAGE_SIZE = 300;
const CHUNK_PREFETCH_COUNT = 1;

interface FhirObservationBundle {
  total: number;
  entry?: Array<{
    resource: ObsRecord;
  }>;
}

const retrieveFromIterator = <T>(iteratorOrIterable: IterableIterator<T>, length: number): Array<T> => {
  const iterator = iteratorOrIterable[Symbol.iterator]();
  return Array.from({ length }, () => iterator.next().value).filter((value): value is T => value !== undefined);
};

const PATIENT_DATA_CACHE_SIZE = 5;
let patientResultsDataCache: Record<string, [PatientData, number, string]> = {};

/**
 * Adds given user testresults data to a cache
 *
 * @param patientUuid
 * @param data {PatientData}
 * @param indicator UUID of the newest observation
 */
export function addUserDataToCache(patientUuid: string, data: PatientData, indicator: string) {
  patientResultsDataCache[patientUuid] = [data, Date.now(), indicator];
  const currentStateEntries = Object.entries(patientResultsDataCache);

  if (currentStateEntries.length > PATIENT_DATA_CACHE_SIZE) {
    currentStateEntries.sort(([, [, dateA]], [, [, dateB]]) => dateB - dateA);

    patientResultsDataCache = Object.fromEntries(currentStateEntries.slice(0, PATIENT_DATA_CACHE_SIZE));
  }
}

async function getLatestObsUuid(patientUuid: string): Promise<string> {
  const request = fhirObservationRequests({
    patient: patientUuid,
    category: 'laboratory',
    _sort: '-_date',
    _summary: 'data',
    _format: 'json',
    _count: '1',
  });
  const firstRequest = request.next().value as Promise<FhirObservationBundle>;
  const result = await firstRequest;
  return result?.entry?.[0]?.resource?.id;
}

/**
 * Retrieves cached user testresults data
 * Checks the indicator against the backend while doing so
 *
 * @param { string } patientUuid
 * @param { PatientData } data
 * @param { string } indicator UUID of the newest observation
 */
export function getUserDataFromCache(patientUuid: string): [PatientData | undefined, Promise<boolean>] {
  const [data] = patientResultsDataCache[patientUuid] || [];

  return [
    data,
    data
      ? getLatestObsUuid(patientUuid).then((obsUuid) => obsUuid !== patientResultsDataCache?.[patientUuid]?.[2])
      : Promise.resolve(true),
  ];
}

/**
 * Iterator
 * @param queries
 */
function* fhirObservationRequests(queries: Record<string, string>) {
  const fhirPathname = `${globalThis.openmrsBase}/ws/fhir2/R4/Observation`;
  const path =
    fhirPathname +
    '?' +
    Object.entries(queries)
      .map(([q, v]) => q + '=' + v)
      .join('&');

  const pathWithPageOffset = (offset: number) => path + '&_getpagesoffset=' + offset * PAGE_SIZE;
  let offsetCounter = 0;
  while (true) {
    yield fetch(pathWithPageOffset(offsetCounter++)).then((res) => res.json() as Promise<FhirObservationBundle>);
  }
}

/**
 * Load all patient testresult observations in parallel
 *
 * @param { string } patientUuid
 * @returns { Promise<Array<ObsRecord>> }
 */
export const loadObsEntries = async (patientUuid: string): Promise<Array<ObsRecord>> => {
  const requests = fhirObservationRequests({
    patient: patientUuid,
    category: 'laboratory',
    _sort: '-_date',
    _summary: 'data',
    _format: 'json',
    _count: '' + PAGE_SIZE,
  });

  let responses = await Promise.all(retrieveFromIterator(requests, CHUNK_PREFETCH_COUNT));

  const total = responses[0]?.total ?? 0;

  if (responses.length === 0 || total === 0) {
    return [];
  }

  if (total > CHUNK_PREFETCH_COUNT * PAGE_SIZE) {
    const missingRequestsCount = Math.ceil(total / PAGE_SIZE) - CHUNK_PREFETCH_COUNT;
    responses = [...responses, ...(await Promise.all(retrieveFromIterator(requests, missingRequestsCount)))];
  }

  return responses
    .slice(0, Math.ceil(total / PAGE_SIZE))
    .flatMap((res) => (res.entry ?? []).map((entry) => entry.resource));
};

export const getEntryConceptClassUuid = (entry: ObsRecord): string => entry.code?.coding?.[0]?.code ?? '';

const conceptCache: Record<ConceptUuid, Promise<ConceptRecord>> = {};
/**
 * fetch all concepts for all given observation entries
 */
export function loadPresentConcepts(entries: Array<ObsRecord>): Promise<Array<ConceptRecord>> {
  return Promise.all(
    [...new Set(entries.map(getEntryConceptClassUuid))].map((conceptUuid) => {
      if (!conceptCache[conceptUuid]) {
        conceptCache[conceptUuid] = fetch(`${globalThis.openmrsBase}${restBaseUrl}/concept/${conceptUuid}?v=full`).then(
          (res) => res.json(),
        );
      }
      return conceptCache[conceptUuid];
    }),
  );
}

/**
 * returns true if no value is null or undefined
 *
 * @param args any
 * @returns {boolean}
 */
export function exist(...args: unknown[]): boolean {
  for (const y of args) {
    if (y === null || y === undefined) {
      return false;
    }
  }

  return true;
}

export const assessValue =
  (meta: ObsMetaInfo) =>
  (value: string): OBSERVATION_INTERPRETATION => {
    if (Number.isNaN(Number.parseFloat(value))) {
      return 'NORMAL';
    }
    const numericValue = Number.parseFloat(value);
    if (typeof meta.hiAbsolute === 'number' && numericValue > meta.hiAbsolute) {
      return 'OFF_SCALE_HIGH';
    }

    if (typeof meta.hiCritical === 'number' && numericValue > meta.hiCritical) {
      return 'CRITICALLY_HIGH';
    }

    if (typeof meta.hiNormal === 'number' && numericValue > meta.hiNormal) {
      return 'HIGH';
    }

    if (typeof meta.lowAbsolute === 'number' && numericValue < meta.lowAbsolute) {
      return 'OFF_SCALE_LOW';
    }

    if (typeof meta.lowCritical === 'number' && numericValue < meta.lowCritical) {
      return 'CRITICALLY_LOW';
    }

    if (typeof meta.lowNormal === 'number' && numericValue < meta.lowNormal) {
      return 'LOW';
    }

    return 'NORMAL';
  };

type ObservationReferenceRange = {
  low?: {
    value?: number;
  };
  high?: {
    value?: number;
  };
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
    }>;
  };
};

type ObservationInterpretation = {
  coding?: Array<{
    code?: string;
    display?: string;
  }>;
  text?: string;
};

type ObservationWithFhirMetadata = ObsRecord & {
  referenceRange?: Array<ObservationReferenceRange>;
  valueQuantity?: {
    unit?: string;
  };
  interpretation?: Array<ObservationInterpretation>;
};

const normalizeDisplayValue = (value?: string) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() ?? '';

const interpretationCodeMap: Record<string, OBSERVATION_INTERPRETATION> = {
  LL: 'CRITICALLY_LOW',
  HH: 'CRITICALLY_HIGH',
  L: 'LOW',
  H: 'HIGH',
  N: 'NORMAL',
  LU: 'OFF_SCALE_LOW',
  HU: 'OFF_SCALE_HIGH',
};

const interpretationDisplayMap = new Map<string, OBSERVATION_INTERPRETATION>([
  ['critically low', 'CRITICALLY_LOW'],
  ['criticamente bajo', 'CRITICALLY_LOW'],
  ['critico bajo', 'CRITICALLY_LOW'],
  ['critically high', 'CRITICALLY_HIGH'],
  ['criticamente alto', 'CRITICALLY_HIGH'],
  ['critico alto', 'CRITICALLY_HIGH'],
  ['low', 'LOW'],
  ['bajo', 'LOW'],
  ['high', 'HIGH'],
  ['alto', 'HIGH'],
  ['normal', 'NORMAL'],
  ['off scale low', 'OFF_SCALE_LOW'],
  ['fuera de escala bajo', 'OFF_SCALE_LOW'],
  ['off scale high', 'OFF_SCALE_HIGH'],
  ['fuera de escala alto', 'OFF_SCALE_HIGH'],
]);

export function extractObservationReferenceRanges(observation: ObservationWithFhirMetadata): Partial<ObsMetaInfo> {
  const referenceRanges = observation.referenceRange;
  if (!referenceRanges?.length) {
    return undefined;
  }

  const ranges: Partial<ObsMetaInfo> = {};
  let hasRangeValue = false;

  for (const referenceRange of referenceRanges) {
    const coding = referenceRange.type?.coding?.[0];
    const system = coding?.system ?? '';
    const code = normalizeDisplayValue(coding?.code);
    const low = referenceRange.low?.value;
    const high = referenceRange.high?.value;

    if (system === 'http://terminology.hl7.org/CodeSystem/referencerange-meaning' && code === 'normal') {
      if (typeof low === 'number') {
        ranges.lowNormal = low;
        hasRangeValue = true;
      }
      if (typeof high === 'number') {
        ranges.hiNormal = high;
        hasRangeValue = true;
      }
    }

    if (system === 'http://terminology.hl7.org/CodeSystem/referencerange-meaning' && code === 'treatment') {
      if (typeof low === 'number') {
        ranges.lowCritical = low;
        hasRangeValue = true;
      }
      if (typeof high === 'number') {
        ranges.hiCritical = high;
        hasRangeValue = true;
      }
    }

    if (system === 'http://fhir.openmrs.org/ext/obs/reference-range' && code === 'absolute') {
      if (typeof low === 'number') {
        ranges.lowAbsolute = low;
        hasRangeValue = true;
      }
      if (typeof high === 'number') {
        ranges.hiAbsolute = high;
        hasRangeValue = true;
      }
    }
  }

  if (!hasRangeValue) {
    return undefined;
  }

  ranges.units = observation.valueQuantity?.unit;
  return ranges;
}

export function extractObservationInterpretation(
  observation: ObservationWithFhirMetadata,
): OBSERVATION_INTERPRETATION | undefined {
  const interpretation = observation.interpretation?.[0];
  if (!interpretation) {
    return undefined;
  }

  const coding = interpretation.coding?.[0];
  const code = coding?.code?.trim().toUpperCase();
  if (code && interpretationCodeMap[code]) {
    return interpretationCodeMap[code];
  }

  return interpretationDisplayMap.get(normalizeDisplayValue(coding?.display ?? interpretation.text));
}

export function extractMetaInformation(concepts: Array<ConceptRecord>): Record<ConceptUuid, ObsMetaInfo> {
  return Object.fromEntries(
    concepts.map((concept) => {
      const meta: ObsMetaInfo = {
        hiAbsolute: concept.hiAbsolute,
        hiCritical: concept.hiCritical,
        hiNormal: concept.hiNormal,
        lowAbsolute: concept.lowAbsolute,
        lowCritical: concept.lowCritical,
        lowNormal: concept.lowNormal,
        units: concept.units,
        datatype: concept.datatype?.display,
      };

      if (typeof concept.hiNormal === 'number' && typeof concept.lowNormal === 'number') {
        meta.range = `${concept.lowNormal} – ${concept.hiNormal}`;
      }

      meta.assessValue = assessValue(meta);

      return [concept.uuid, meta];
    }),
  );
}
