import type { OdontogramData } from '../types/odontogram';
import { adultConfig } from './adultConfig';
import { childConfig } from './childConfig';

/** Before dentition was persisted, every editor used the permanent configuration. */
export function getOdontogramConfig(data?: OdontogramData | null) {
  switch (data?.dentition) {
    case undefined:
    case 'adult':
      return adultConfig;
    case 'child':
      return childConfig;
    default:
      throw new Error('Unsupported odontogram dentition');
  }
}

/** A variant change must never discard clinical content, including notes without findings. */
export function hasOdontogramEntries(data: OdontogramData): boolean {
  return Boolean(
    data.especificaciones ||
      data.observaciones ||
      data.teeth.some((tooth) => tooth.findings.length || tooth.annotations?.length || tooth.notes) ||
      Object.values(data.spacingFindings).some((spaces) => spaces.some((space) => space.findings.length)) ||
      data.legendSpaces.some((space) => space.findings.length),
  );
}
