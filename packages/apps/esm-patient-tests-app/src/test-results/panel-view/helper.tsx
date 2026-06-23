import { type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';

import { type Concept, type ConceptMeta, type FHIRObservationResource, observationInterpretation } from '../../types';

import styles from './result-panel.scss';

const labConceptClassNames = new Set([
  'test',
  'labset',
  'lab set',
  'prueba',
  'examen',
  'analisis',
  'conjunto de laboratorio',
  'grupo de laboratorio',
  'panel de laboratorio',
]);

const normalizeConceptClassName = (value?: string) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim() ?? '';

export const isLabConcept = (concept: Concept) =>
  [concept.conceptClass?.display, concept.conceptClass?.name].some((value) =>
    labConceptClassNames.has(normalizeConceptClassName(value)),
  );

export const getConceptUuid = (obs: FHIRObservationResource) => obs?.code.coding[0].code;

export const getClass = (interpretation: OBSERVATION_INTERPRETATION) => {
  switch (interpretation) {
    case 'OFF_SCALE_HIGH':
      return styles['off-scale-high'] || styles['offScaleHigh'];

    case 'CRITICALLY_HIGH':
      return styles['critically-high'] || styles['criticallyHigh'];

    case 'HIGH':
      return styles['high'];

    case 'OFF_SCALE_LOW':
      return styles['off-scale-low'] || styles['offScaleLow'];

    case 'CRITICALLY_LOW':
      return styles['critically-low'] || styles['criticallyLow'];

    case 'LOW':
      return styles['low'];

    case 'NORMAL':
    default:
      return '';
  }
};

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

export const assessValue: (meta: any) => (value: string) => OBSERVATION_INTERPRETATION =
  (meta) =>
  (value: string): observationInterpretation => {
    const valueQuantity = parseNumber(value);
    if (valueQuantity === undefined) {
      return observationInterpretation.NORMAL;
    }

    let lowNormal = parseNumber(meta.lowNormal);
    let hiNormal = parseNumber(meta.hiNormal);

    if (lowNormal === undefined && hiNormal === undefined && meta.range) {
      const extracted = extractRangesFromRangeStr(meta.range);
      lowNormal = extracted.lowNormal;
      hiNormal = extracted.hiNormal;
    }

    const hiAbsolute = parseNumber(meta.hiAbsolute);
    if (hiAbsolute !== undefined && valueQuantity > hiAbsolute) {
      return observationInterpretation.OFF_SCALE_HIGH;
    }

    const hiCritical = parseNumber(meta.hiCritical);
    if (hiCritical !== undefined && valueQuantity > hiCritical) {
      return observationInterpretation.CRITICALLY_HIGH;
    }

    if (hiNormal !== undefined && valueQuantity > hiNormal) {
      return observationInterpretation.HIGH;
    }

    const lowAbsolute = parseNumber(meta.lowAbsolute);
    if (lowAbsolute !== undefined && valueQuantity < lowAbsolute) {
      return observationInterpretation.OFF_SCALE_LOW;
    }

    const lowCritical = parseNumber(meta.lowCritical);
    if (lowCritical !== undefined && valueQuantity < lowCritical) {
      return observationInterpretation.CRITICALLY_LOW;
    }

    if (lowNormal !== undefined && valueQuantity < lowNormal) {
      return observationInterpretation.LOW;
    }

    return observationInterpretation.NORMAL;
  };

export function extractMetaInformation(concept: Concept): ConceptMeta {
  const { display, hiAbsolute, hiCritical, hiNormal, lowAbsolute, lowCritical, lowNormal, units } = concept;

  let range = null;
  if (exist(hiNormal, lowNormal)) {
    range = `${lowNormal} – ${hiNormal}`;
  }

  const getInterpretation = assessValue({
    hiAbsolute,
    hiCritical,
    hiNormal,
    lowAbsolute,
    lowCritical,
    lowNormal,
    units,
    range,
  });

  return {
    display,
    hiAbsolute,
    hiCritical,
    hiNormal,
    lowAbsolute,
    lowCritical,
    lowNormal,
    units,
    range,
    getInterpretation,
  };
}
