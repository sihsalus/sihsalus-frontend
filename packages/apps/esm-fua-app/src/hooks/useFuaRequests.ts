import { openmrsFetch, useAppContext } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR, { mutate as mutateSwr } from 'swr';

import { ModuleFuaRestURL } from '../constant';

export interface FuaEstado {
  uuid: string;
  id: number;
  nombre: string;
}

export interface FuaRequest {
  uuid: string;
  id: number;
  visitUuid: string;
  name: string;
  payload: string;
  fuaEstado?: FuaEstado | null;
  fechaCreacion: number;
  fechaActualizacion: number;
  /** Número correlativo oficial del FUA (ej: "FUA-2024-001234") */
  numeroFua?: string;
  /** Observaciones devueltas por SETI-SIS al rechazar el FUA */
  observacionesSetiSis?: string;
  /** Usuario que realizó el último cambio de estado */
  ultimoUsuario?: string;
  /** Comentario registrado al cancelar/rechazar */
  comentarioUltimoEstado?: string;
}

export interface DateFilterContext {
  dateRange: [Date, Date];
}

const useFuaRequestsDefaultParams: UseFuaRequestsParams = {
  status: null,
  newOrdersOnly: false,
  excludeCanceled: true,
};

export interface UseFuaRequestsParams {
  status: string | null;
  newOrdersOnly: boolean;
  excludeCanceled: boolean;
}

// Maps frontend status keys to the Spanish nombres stored in fua_estado table
const STATUS_NOMBRE_MAP: Record<string, string> = {
  IN_PROGRESS: 'En Proceso',
  'in-progress': 'En Proceso',
  COMPLETED: 'Completado',
  completed: 'Completado',
  DECLINED: 'Rechazado',
  declined: 'Rechazado',
  PENDIENTE: 'Pendiente',
  pendiente: 'Pendiente',
  ENVIADO: 'Enviado a SETI-SIS',
  enviado: 'Enviado a SETI-SIS',
};

function mapStatus(status: string): string {
  return STATUS_NOMBRE_MAP[status] ?? status;
}

export function revalidateFuaRequestCaches() {
  return mutateSwr((key) => typeof key === 'string' && key.startsWith(ModuleFuaRestURL), undefined, {
    revalidate: true,
  });
}

/**
 * Custom hook for retrieving FUA requests.
 *
 * - When `status` is provided: calls /solicitudes with server-side filtering
 *   (status, fechaInicio, fechaFin in yyyy-MM-dd format).
 * - When no `status`: calls /list to get all records (client-side filtering
 *   for newOrdersOnly).
 */
export function useFuaRequests(params: Partial<UseFuaRequestsParams> = useFuaRequestsDefaultParams) {
  const { status, newOrdersOnly } = { ...useFuaRequestsDefaultParams, ...params };
  const { dateRange } = useAppContext<DateFilterContext>('fua-date-filter') ?? {
    dateRange: [dayjs().startOf('day').toDate(), new Date()],
  };

  const url = useMemo(() => {
    if (status) {
      const queryParams: string[] = [`status=${encodeURIComponent(mapStatus(status))}`];

      if (dateRange) {
        queryParams.push(`fechaInicio=${dayjs(dateRange[0]).format('YYYY-MM-DD')}`);
        queryParams.push(`fechaFin=${dayjs(dateRange[1]).format('YYYY-MM-DD')}`);
      }

      return `${ModuleFuaRestURL}/solicitudes?${queryParams.join('&')}`;
    }

    return `${ModuleFuaRestURL}/list`;
  }, [status, dateRange]);

  const { data, error, mutate, isLoading, isValidating } = useSWR<{ data: Array<FuaRequest> }>(url, openmrsFetch);

  const allOrders = data?.data ?? [];

  // newOrdersOnly: only FUAs without an assigned estado (just generated)
  const filteredOrders = allOrders.filter(
    (order) => !newOrdersOnly || order?.fuaEstado === null || order?.fuaEstado === undefined,
  );

  return {
    fuaOrders: filteredOrders,
    isLoading,
    isError: error,
    mutate,
    isValidating,
  };
}

/**
 * Update the estado of a FUA.
 * OMOD endpoint: PUT /module/fua/estado/update/{fuaId}
 */
export async function setFuaEstado(fuaId: number, estadoId: number, abortController: AbortController) {
  const response = await openmrsFetch(`${ModuleFuaRestURL}/estado/update/${fuaId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: { estadoId },
  });

  await revalidateFuaRequestCaches();
  return response;
}

/**
 * Cancel a FUA.
 * Uses estadoId=6 (CANCELADO) which requires the OMOD to have that estado defined.
 * Falls back semantics: if the OMOD doesn't support id=6, the server will return an error.
 */
export async function cancelFuaRequest(fuaId: number, comment: string, abortController: AbortController) {
  const CANCELADO_ID = 6;
  const response = await openmrsFetch(`${ModuleFuaRestURL}/estado/update/${fuaId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: { estadoId: CANCELADO_ID, comentario: comment },
  });

  await revalidateFuaRequestCaches();
  return response;
}

/**
 * Fetch all FUAs for a specific patient.
 * OMOD endpoint: GET /ws/module/fua/patient/{patientUuid}
 */
export function useFuasByPatient(patientUuid: string | null | undefined) {
  const url = patientUuid ? `${ModuleFuaRestURL}/patient/${patientUuid}` : null;
  const { data, error, mutate, isLoading } = useSWR<{ data: Array<FuaRequest> }>(url, openmrsFetch);
  return {
    fuaOrders: data?.data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export default useFuaRequests;
