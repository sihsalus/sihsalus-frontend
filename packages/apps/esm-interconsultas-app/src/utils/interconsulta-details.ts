import type { InterconsultaOrder } from '../types';

const EXTERNAL_DESTINATION_PREFIX = 'Destino externo/remoto: ';
const REASON_PREFIX = 'Motivo: ';

export interface InterconsultaInstructions {
  externalDestination: string | null;
  reason: string;
}

/**
 * OpenMRS requires an orderable concept even when the requested specialist is
 * not part of the local catalog. In that case the order uses the configured
 * non-coded concept and keeps the concrete destination together with the
 * clinical reason in the human-readable instructions field.
 */
export function buildInterconsultaInstructions(reason: string, externalDestination?: string): string {
  const normalizedReason = reason.trim();
  const normalizedDestination = externalDestination?.trim();

  if (!normalizedDestination) {
    return normalizedReason;
  }

  return `${EXTERNAL_DESTINATION_PREFIX}${normalizedDestination}\n${REASON_PREFIX}${normalizedReason}`;
}

export function parseInterconsultaInstructions(instructions?: string | null): InterconsultaInstructions {
  const value = instructions?.trim() ?? '';

  if (!value.startsWith(EXTERNAL_DESTINATION_PREFIX)) {
    return { externalDestination: null, reason: value };
  }

  const firstLineBreak = value.indexOf('\n');
  if (firstLineBreak < 0) {
    return {
      externalDestination: value.slice(EXTERNAL_DESTINATION_PREFIX.length).trim() || null,
      reason: '',
    };
  }

  const externalDestination = value.slice(EXTERNAL_DESTINATION_PREFIX.length, firstLineBreak).trim() || null;
  const reasonLine = value.slice(firstLineBreak + 1);
  const reason = reasonLine.startsWith(REASON_PREFIX)
    ? reasonLine.slice(REASON_PREFIX.length).trim()
    : reasonLine.trim();

  return { externalDestination, reason };
}

export function getInterconsultaDestinationDisplay(
  order: Pick<InterconsultaOrder, 'concept' | 'instructions'>,
): string {
  return parseInterconsultaInstructions(order.instructions).externalDestination ?? order.concept?.display ?? '—';
}

export function getInterconsultaReason(order: Pick<InterconsultaOrder, 'instructions'>): string {
  return parseInterconsultaInstructions(order.instructions).reason || '—';
}
