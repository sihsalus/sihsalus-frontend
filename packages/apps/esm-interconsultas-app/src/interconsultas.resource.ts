import { openmrsFetch, restBaseUrl, toOmrsIsoString, useConfig } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import type { ConfigObject } from './config-schema';
import type {
  FulfillerStatus,
  InterconsultaOrder,
  InterconsultaResponseObs,
  InterconsultaStatus,
  InterconsultaTrayFilter,
  OrderableService,
} from './types';

export const ORDER_CUSTOM_REP =
  'custom:(uuid,orderNumber,action,dateActivated,dateStopped,autoExpireDate,scheduledDate,urgency,' +
  'instructions,fulfillerStatus,fulfillerComment,concept:(uuid,display),patient:(uuid,display),' +
  'orderer:(uuid,display),encounter:(uuid,location:(uuid,display),visit:(uuid)))';

const FULFILLER_COMMENT_MAX_LENGTH = 1024;

/**
 * Deriva el estado normativo de la interconsulta a partir de la orden.
 * Una orden descontinuada (dateStopped) o expirada se considera cancelada,
 * salvo que ya haya sido respondida o rechazada.
 */
export function deriveStatus(
  order: Pick<InterconsultaOrder, 'fulfillerStatus' | 'dateStopped' | 'action'>,
): InterconsultaStatus {
  if (order.fulfillerStatus === 'COMPLETED' || order.fulfillerStatus === 'DECLINED') {
    return order.fulfillerStatus;
  }
  if (order.dateStopped) {
    return 'CANCELLED';
  }
  if (!order.fulfillerStatus) {
    return 'REQUESTED';
  }
  return order.fulfillerStatus;
}

/** Decide si una orden pertenece a un tab de la bandeja. */
export function matchesTrayFilter(order: InterconsultaOrder, filter: InterconsultaTrayFilter): boolean {
  if (order.action === 'DISCONTINUE') {
    return false;
  }
  const status = deriveStatus(order);
  switch (filter) {
    case 'REQUESTED':
      return status === 'REQUESTED';
    case 'RECEIVED':
      // ON_HOLD y EXCEPTION se gestionan junto a las recibidas/pendientes
      return status === 'RECEIVED' || status === 'ON_HOLD' || status === 'EXCEPTION';
    case 'IN_PROGRESS':
      return status === 'IN_PROGRESS';
    case 'COMPLETED':
      return status === 'COMPLETED';
    case 'CLOSED':
      return status === 'DECLINED' || status === 'CANCELLED';
    default:
      return false;
  }
}

export function interconsultaOrdersUrl(orderTypeUuid: string, patientUuid?: string): string {
  const base = `${restBaseUrl}/order?orderTypes=${orderTypeUuid}&v=${ORDER_CUSTOM_REP}`;
  return patientUuid ? `${base}&patient=${patientUuid}` : base;
}

/**
 * Bandeja global de interconsultas. Trae todas las órdenes del order type
 * (incluidas las descontinuadas, para poder mostrar las canceladas) y
 * filtra por estado en el cliente — el REST API no permite filtrar
 * "sin fulfillerStatus" ni "DECLINED o canceladas" en una sola consulta.
 */
export function useInterconsultas(filter: InterconsultaTrayFilter) {
  const { interconsultaOrderTypeUuid } = useConfig<ConfigObject>();
  const url = interconsultaOrdersUrl(interconsultaOrderTypeUuid);

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Array<InterconsultaOrder> } }>(
    url,
    openmrsFetch,
  );

  const interconsultas = useMemo(
    () => (data?.data?.results ?? []).filter((order) => matchesTrayFilter(order, filter)),
    [data, filter],
  );

  return { interconsultas, isLoading, error, isValidating, mutate };
}

/** Interconsultas de un paciente, para el widget del chart. */
export function usePatientInterconsultas(patientUuid: string) {
  const { interconsultaOrderTypeUuid } = useConfig<ConfigObject>();
  const url = patientUuid ? interconsultaOrdersUrl(interconsultaOrderTypeUuid, patientUuid) : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Array<InterconsultaOrder> } }>(
    url,
    openmrsFetch,
  );

  const interconsultas = useMemo(
    () => (data?.data?.results ?? []).filter((order) => order.action !== 'DISCONTINUE'),
    [data],
  );

  return { interconsultas, isLoading, error, mutate };
}

/** Invalida todas las consultas SWR de interconsultas tras una mutación. */
export function useInvalidateInterconsultas() {
  const { interconsultaOrderTypeUuid } = useConfig<ConfigObject>();
  return useCallback(() => {
    return mutate(
      (key) =>
        typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${interconsultaOrderTypeUuid}`),
      undefined,
      { revalidate: true },
    );
  }, [interconsultaOrderTypeUuid]);
}

export function setInterconsultaFulfillerStatus(
  orderUuid: string,
  fulfillerStatus: FulfillerStatus,
  fulfillerComment?: string,
  abortController?: AbortController,
) {
  return openmrsFetch(`${restBaseUrl}/order/${orderUuid}/fulfillerdetails/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: {
      fulfillerStatus,
      ...(fulfillerComment ? { fulfillerComment: fulfillerComment.slice(0, FULFILLER_COMMENT_MAX_LENGTH) } : {}),
    },
  });
}

export interface RespondInterconsultaPayload {
  order: InterconsultaOrder;
  respuesta: string;
  recomendaciones?: string;
  respuestaConceptUuid: string;
  recomendacionesConceptUuid?: string;
}

/**
 * Construye las obs de respuesta ligadas a la orden (mismo patrón que los
 * resultados de laboratorio: obs sobre el encounter de la orden con
 * referencia `order`). Si no hay concept para recomendaciones, se anexan
 * al texto de la respuesta para no perder el dato normativo.
 */
export function buildResponseObsPayload({
  order,
  respuesta,
  recomendaciones,
  respuestaConceptUuid,
  recomendacionesConceptUuid,
}: RespondInterconsultaPayload) {
  const obs: Array<Record<string, unknown>> = [];
  const trimmedRecomendaciones = recomendaciones?.trim();
  let respuestaValue = respuesta.trim();

  if (trimmedRecomendaciones && !recomendacionesConceptUuid) {
    respuestaValue += `\n\nRecomendaciones: ${trimmedRecomendaciones}`;
  }

  obs.push({
    concept: respuestaConceptUuid,
    value: respuestaValue,
    order: { uuid: order.uuid },
  });

  if (trimmedRecomendaciones && recomendacionesConceptUuid) {
    obs.push({
      concept: recomendacionesConceptUuid,
      value: trimmedRecomendaciones,
      order: { uuid: order.uuid },
    });
  }

  return { obs };
}

/**
 * Registra la respuesta/contrainterconsulta: guarda las obs en el encounter
 * de la solicitud y marca la orden como COMPLETED. El profesional que
 * responde queda auditado como creador de las obs y del cambio de estado.
 */
export async function respondInterconsulta(payload: RespondInterconsultaPayload, abortController?: AbortController) {
  const obsPayload = buildResponseObsPayload(payload);

  const saveObs = await openmrsFetch(`${restBaseUrl}/encounter/${payload.order.encounter.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: obsPayload,
  });

  if (!saveObs.ok) {
    throw new Error(`No se pudo guardar la respuesta de la interconsulta (${saveObs.status})`);
  }

  return setInterconsultaFulfillerStatus(payload.order.uuid, 'COMPLETED', payload.respuesta, abortController);
}

export interface CreateInterconsultaPayload {
  patientUuid: string;
  visitUuid?: string;
  locationUuid: string;
  providerUuid: string;
  serviceConceptUuid: string;
  urgency: 'ROUTINE' | 'STAT' | 'ON_SCHEDULED_DATE';
  scheduledDate?: Date;
  motivo: string;
  config: Pick<
    ConfigObject,
    'interconsultaOrderTypeUuid' | 'careSettingUuid' | 'requestEncounterTypeUuid' | 'clinicianEncounterRoleUuid'
  >;
}

/**
 * Crea la solicitud: un encounter (tipo Interconsulta — NTS 102) dentro de la
 * visita activa y la orden con los datos propios de la interconsulta. No se
 * persiste ningún dato demográfico ni clínico del paciente.
 */
export async function createInterconsulta(payload: CreateInterconsultaPayload, abortController?: AbortController) {
  const { config } = payload;

  const encounterResponse = await openmrsFetch<{ uuid: string }>(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: {
      patient: payload.patientUuid,
      encounterDatetime: toOmrsIsoString(new Date()),
      encounterType: config.requestEncounterTypeUuid,
      location: payload.locationUuid,
      ...(payload.visitUuid ? { visit: payload.visitUuid } : {}),
      encounterProviders: [
        {
          provider: payload.providerUuid,
          encounterRole: config.clinicianEncounterRoleUuid,
        },
      ],
    },
  });

  if (!encounterResponse.ok || !encounterResponse.data?.uuid) {
    throw new Error(`No se pudo crear el encuentro de la interconsulta (${encounterResponse.status})`);
  }

  return openmrsFetch<InterconsultaOrder>(`${restBaseUrl}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: {
      action: 'NEW',
      type: 'order',
      patient: payload.patientUuid,
      careSetting: config.careSettingUuid,
      orderer: payload.providerUuid,
      encounter: encounterResponse.data.uuid,
      concept: payload.serviceConceptUuid,
      orderType: config.interconsultaOrderTypeUuid,
      urgency: payload.urgency,
      instructions: payload.motivo,
      ...(payload.urgency === 'ON_SCHEDULED_DATE' && payload.scheduledDate
        ? { scheduledDate: toOmrsIsoString(payload.scheduledDate) }
        : {}),
    },
  });
}

/**
 * Respuesta registrada de una interconsulta: obs del encounter de la
 * solicitud que referencian la orden.
 */
export function useInterconsultaResponse(order: InterconsultaOrder | null) {
  const url = order
    ? `${restBaseUrl}/encounter/${order.encounter.uuid}?v=custom:(obs:(uuid,obsDatetime,value,` +
      'concept:(uuid,display),order:(uuid),auditInfo:(creator:(display))))'
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { obs: Array<InterconsultaResponseObs> } }>(
    url,
    openmrsFetch,
  );

  const responseObs = useMemo(
    () => (data?.data?.obs ?? []).filter((obs) => obs.order?.uuid === order?.uuid),
    [data, order],
  );

  return { responseObs, isLoading, error, mutate };
}

/**
 * Servicios/especialidades destino ordenables. Si hay concept sets
 * configurados se usan sus miembros; si no, búsqueda libre de concepts.
 */
export function useDestinationServices(searchTerm: string) {
  const { orderableConceptSets } = useConfig<ConfigObject>();
  const hasSets = orderableConceptSets.length > 0;

  const setsUrl = hasSets
    ? `${restBaseUrl}/concept?references=${orderableConceptSets.join(',')}&v=custom:(uuid,display,setMembers:(uuid,display))`
    : null;
  const searchUrl =
    !hasSets && searchTerm?.trim().length >= 2
      ? `${restBaseUrl}/concept?q=${encodeURIComponent(searchTerm.trim())}&searchType=fuzzy&v=custom:(uuid,display)&limit=25`
      : null;

  const { data, error, isLoading } = useSWR<{
    data: { results: Array<OrderableService & { setMembers?: Array<OrderableService> }> };
  }>(setsUrl ?? searchUrl, openmrsFetch);

  const services = useMemo(() => {
    const results = data?.data?.results ?? [];
    if (!hasSets) {
      return results.map(({ uuid, display }) => ({ uuid, display }));
    }
    const members = results.flatMap((set) => set.setMembers ?? []);
    const lowerTerm = searchTerm?.trim().toLowerCase();
    return lowerTerm ? members.filter((member) => member.display?.toLowerCase().includes(lowerTerm)) : members;
  }, [data, hasSets, searchTerm]);

  return { services, isLoading, error };
}
