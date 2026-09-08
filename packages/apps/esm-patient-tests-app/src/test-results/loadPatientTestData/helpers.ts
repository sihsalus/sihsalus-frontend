import { omrsOfflineCachingStrategyHttpHeaderName, restBaseUrl } from '@openmrs/esm-framework';
import {
  type ConceptRecord,
  type ConceptUuid,
  type OBSERVATION_INTERPRETATION,
  type ObsMetaInfo,
  type ObsRecord,
} from '@openmrs/esm-patient-common-lib';

const PAGE_SIZE = 300;

interface FhirObservationBundle {
  resourceType: 'Bundle';
  total?: number;
  entry?: Array<{ resource: ObsRecord }>;
  link?: Array<{ relation: string; url: string }>;
}

const loadError = () => new Error('Test results could not be loaded.');

async function fetchResultsJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
  });
  if (!response.ok) throw loadError();
  return response.json() as Promise<T>;
}

/** Loads a complete history; failed pages must never become a partial success. */
export const loadObsEntries = async (patientUuid: string, signal?: AbortSignal): Promise<Array<ObsRecord>> => {
  const endpoint = new URL(`${globalThis.openmrsBase}/ws/fhir2/R4/Observation`, window.location.href);
  const queries = new URLSearchParams({
    patient: patientUuid,
    category: 'laboratory',
    _sort: '-_date',
    _summary: 'data',
    _format: 'json',
    _count: String(PAGE_SIZE),
    _getpagesoffset: '0',
  });
  let url: string | undefined = `${endpoint.href}?${queries}`;
  const visited = new Set<string>();
  const observations = new Map<string, ObsRecord>();
  let received = 0;

  while (url) {
    if (visited.has(url)) throw loadError();
    visited.add(url);
    const page = await fetchResultsJson<FhirObservationBundle>(url, signal);
    if (
      page?.resourceType !== 'Bundle' ||
      (page.entry !== undefined && !Array.isArray(page.entry)) ||
      (page.total !== undefined && (!Number.isSafeInteger(page.total) || page.total < 0))
    )
      throw loadError();

    const entries = page.entry ?? [];
    const previousCount = observations.size;
    for (const { resource } of entries) {
      if (!resource?.id) throw loadError();
      observations.set(resource.id, resource);
    }
    received += entries.length;
    const next = page.link?.find(({ relation }) => relation === 'next')?.url;

    if (next) {
      const nextUrl = new URL(next, url);
      // FHIR pagination links may name the backend behind the SPA proxy.
      // Keep requests on the configured API origin and observation endpoint.
      if (nextUrl.pathname !== endpoint.pathname) throw loadError();
      if (nextUrl.searchParams.has('patient') && nextUrl.searchParams.get('patient') !== patientUuid) throw loadError();
      nextUrl.host = endpoint.host;
      nextUrl.protocol = endpoint.protocol;
      url = nextUrl.href;
    } else if (page.total !== undefined && received < page.total) {
      queries.set('_getpagesoffset', String(received));
      url = `${endpoint.href}?${queries}`;
    } else {
      url = undefined;
    }

    if ((url || entries.length > 0) && observations.size === previousCount) throw loadError();
  }

  return [...observations.values()];
};

export const getEntryConceptClassUuid = (entry: ObsRecord): string => entry.code?.coding?.[0]?.code ?? '';

/** Deduplicate within this load; a failed or obsolete concept response is never reused on retry. */
export function loadPresentConcepts(entries: Array<ObsRecord>, signal?: AbortSignal): Promise<Array<ConceptRecord>> {
  return Promise.all(
    [...new Set(entries.map(getEntryConceptClassUuid))].filter(Boolean).map(async (conceptUuid) => {
      const concept = await fetchResultsJson<ConceptRecord>(
        `${globalThis.openmrsBase}${restBaseUrl}/concept/${encodeURIComponent(conceptUuid)}?v=full`,
        signal,
      );
      if (concept?.uuid !== conceptUuid || !concept.conceptClass) throw loadError();
      return concept;
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

export const parseNumber = (val: any): number | undefined => {
  if (typeof val === 'number') {
    return val;
  }
  if (typeof val === 'string') {
    const parsed = Number.parseFloat(val.replace(',', '.'));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export const extractRangesFromRangeStr = (rangeStr: string): { lowNormal?: number; hiNormal?: number } => {
  if (!rangeStr) return {};
  const match = rangeStr.match(/(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)/);
  if (match) {
    const low = parseNumber(match[1]);
    const high = parseNumber(match[2]);
    return { lowNormal: low, hiNormal: high };
  }
  const lessThanMatch = rangeStr.match(/<\s*(-?\d+(?:[.,]\d+)?)/);
  if (lessThanMatch) {
    return { hiNormal: parseNumber(lessThanMatch[1]) };
  }
  const greaterThanMatch = rangeStr.match(/>\s*(-?\d+(?:[.,]\d+)?)/);
  if (greaterThanMatch) {
    return { lowNormal: parseNumber(greaterThanMatch[1]) };
  }
  return {};
};

export const assessValue =
  (meta: ObsMetaInfo) =>
  (value: string): OBSERVATION_INTERPRETATION => {
    const numericValue = parseNumber(value);
    if (numericValue === undefined) {
      return 'NORMAL';
    }

    let lowNormal = parseNumber(meta.lowNormal);
    let hiNormal = parseNumber(meta.hiNormal);

    if (lowNormal === undefined && hiNormal === undefined && meta.range) {
      const extracted = extractRangesFromRangeStr(meta.range);
      lowNormal = extracted.lowNormal;
      hiNormal = extracted.hiNormal;
    }

    const hiAbsolute = parseNumber(meta.hiAbsolute);
    if (hiAbsolute !== undefined && numericValue > hiAbsolute) {
      return 'OFF_SCALE_HIGH';
    }

    const hiCritical = parseNumber(meta.hiCritical);
    if (hiCritical !== undefined && numericValue > hiCritical) {
      return 'CRITICALLY_HIGH';
    }

    if (hiNormal !== undefined && numericValue > hiNormal) {
      return 'HIGH';
    }

    const lowAbsolute = parseNumber(meta.lowAbsolute);
    if (lowAbsolute !== undefined && numericValue < lowAbsolute) {
      return 'OFF_SCALE_LOW';
    }

    const lowCritical = parseNumber(meta.lowCritical);
    if (lowCritical !== undefined && numericValue < lowCritical) {
      return 'CRITICALLY_LOW';
    }

    if (lowNormal !== undefined && numericValue < lowNormal) {
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
  text?: string;
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

    if (referenceRange.text) {
      ranges.range = referenceRange.text;
      hasRangeValue = true;
    }

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
