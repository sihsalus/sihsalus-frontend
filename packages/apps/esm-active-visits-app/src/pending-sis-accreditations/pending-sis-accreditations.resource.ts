/**
 * Lista de trabajo «Acreditaciones SIS pendientes» (Fase 4 del plan de
 * alineamiento de seguros SIS, docs/clinical/plan-alineamiento-seguros-sis.md).
 *
 * Cuando se trabaja sin red, la verificación SIS queda como «pendiente» o «no
 * consultada» (o simplemente no se registra). Al volver la conexión, Admisión
 * necesita ver de un vistazo qué visitas activas con financiador SIS aún
 * requieren verificación de acreditación.
 */
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import { type PendingSisAccreditationsConfig } from '../config-schema';

/** La lista se refresca sola para reflejar verificaciones hechas en paralelo. */
const refreshIntervalMs = 60_000;

const pendingSisVisitsUrl =
  `${restBaseUrl}/visit?includeInactive=false&v=custom:(uuid,startDatetime,location:(display),` +
  'patient:(uuid,display,identifiers:(identifier,identifierType:(uuid,display))),' +
  'attributes:(uuid,value,attributeType:(uuid)))';

/** Los valores coded pueden venir hidratados como objeto o como uuid plano. */
type RestAttributeValue = string | { uuid?: string; display?: string } | null | undefined;

interface RestVisitAttribute {
  uuid: string;
  value?: RestAttributeValue;
  attributeType?: {
    uuid?: string;
  };
}

interface RestVisitIdentifier {
  identifier?: string;
  identifierType?: {
    uuid?: string;
    display?: string;
  };
}

export interface RestActiveVisit {
  uuid: string;
  startDatetime?: string;
  location?: {
    display?: string;
  };
  patient?: {
    uuid?: string;
    display?: string;
    identifiers?: Array<RestVisitIdentifier>;
  };
  attributes?: Array<RestVisitAttribute>;
}

interface VisitsResponse {
  results?: Array<RestActiveVisit>;
}

export type PendingAccreditationStatus = 'pending' | 'notConsulted' | 'missing';

export interface PendingSisVisit {
  visitUuid: string;
  patientUuid: string;
  patientName: string;
  identifier: string;
  startDatetime: string | null;
  location: string;
  accreditationStatus: PendingAccreditationStatus;
}

function getCodedValueUuid(value: RestAttributeValue): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  return value.uuid?.trim() || null;
}

function findAttributeValueUuid(attributes: Array<RestVisitAttribute>, attributeTypeUuid: string): string | null {
  const attribute = attributes.find((candidate) => candidate.attributeType?.uuid === attributeTypeUuid);
  return attribute ? getCodedValueUuid(attribute.value) : null;
}

/** DNI primero; si el paciente no tiene DNI, el primer identificador disponible. */
function getDisplayIdentifier(identifiers: Array<RestVisitIdentifier>, dniIdentifierTypeUuid: string): string {
  const dni = identifiers.find((identifier) => identifier.identifierType?.uuid === dniIdentifierTypeUuid);
  return dni?.identifier ?? identifiers[0]?.identifier ?? '--';
}

/**
 * Filtra las visitas activas que necesitan verificación SIS: financiador SIS
 * (canónico o producto legado) con acreditación pendiente, no consultada o sin
 * registrar. Las visitas de otros financiadores y las ya verificadas
 * (vigente / no vigente) quedan fuera. Ordena de la más antigua a la más
 * reciente (la que más tiempo lleva esperando primero).
 */
export function filterPendingSisVisits(
  visits: Array<RestActiveVisit>,
  config: PendingSisAccreditationsConfig,
): Array<PendingSisVisit> {
  const pendingVisits: Array<PendingSisVisit> = [];

  for (const visit of visits) {
    const attributes = visit.attributes ?? [];
    const financiadorUuid = findAttributeValueUuid(attributes, config.financiadorVisitAttributeTypeUuid);

    if (!financiadorUuid || !config.sisConceptUuids.includes(financiadorUuid)) {
      continue;
    }

    const statusUuid = findAttributeValueUuid(attributes, config.accreditationStatusVisitAttributeTypeUuid);

    let accreditationStatus: PendingAccreditationStatus;
    if (statusUuid === config.pendingStatusConceptUuid) {
      accreditationStatus = 'pending';
    } else if (statusUuid === config.notConsultedStatusConceptUuid) {
      accreditationStatus = 'notConsulted';
    } else if (!statusUuid) {
      accreditationStatus = 'missing';
    } else {
      // Vigente o no vigente: ya fue verificada, no es trabajo pendiente.
      continue;
    }

    pendingVisits.push({
      visitUuid: visit.uuid,
      patientUuid: visit.patient?.uuid ?? '',
      patientName: visit.patient?.display ?? '--',
      identifier: getDisplayIdentifier(visit.patient?.identifiers ?? [], config.dniIdentifierTypeUuid),
      startDatetime: visit.startDatetime ?? null,
      location: visit.location?.display ?? '--',
      accreditationStatus,
    });
  }

  return pendingVisits.sort((a, b) => {
    const timeA = a.startDatetime ? new Date(a.startDatetime).getTime() : Number.POSITIVE_INFINITY;
    const timeB = b.startDatetime ? new Date(b.startDatetime).getTime() : Number.POSITIVE_INFINITY;
    return timeA - timeB;
  });
}

export function usePendingSisAccreditations(config: PendingSisAccreditationsConfig, isEnabled = true) {
  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<VisitsResponse>, Error>(
    isEnabled ? pendingSisVisitsUrl : null,
    openmrsFetch,
    { refreshInterval: refreshIntervalMs },
  );

  return {
    pendingVisits: filterPendingSisVisits(data?.data?.results ?? [], config),
    error,
    isLoading,
    isValidating,
  };
}
