import { type Order, openmrsFetch, restBaseUrl, useAppContext, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { type Config } from './config-schema';
import type { DateFilterContext, FulfillerStatus } from './types';
import { extractPriorityFromInstructions } from './utils/priority-parser';

const useLabOrdersDefaultParams: UseLabOrdersParams = {
  status: null,
  newOrdersOnly: false,
  excludeCanceled: true,
  includePatientId: false,
};

interface UseLabOrdersParams {
  status: FulfillerStatus;
  newOrdersOnly: boolean;
  excludeCanceled: boolean;
  includePatientId: boolean;
}

/**
 * Custom hook for retrieving laboratory orders.
 *
 * @param status - The fulfiller status to filter by (e.g. 'IN_PROGRESS', 'COMPLETED')
 * @param newOrdersOnly - Whether to return only new orders that haven't been picked (action=NEW, fulfillerStatus=null). Filtered client-side as the REST API doesn't support this query natively.
 * @param excludeCanceled - Whether to exclude canceled, discontinued and expired orders
 * @param includePatientId - Whether to include patient identifiers in the response
 */
export function useLabOrders(params: Partial<UseLabOrdersParams> = useLabOrdersDefaultParams) {
  const definedParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const { status, newOrdersOnly, excludeCanceled, includePatientId } = {
    ...useLabOrdersDefaultParams,
    ...definedParams,
  };
  const { dateRange } = useAppContext<DateFilterContext>('laboratory-date-filter') ?? {
    dateRange: [dayjs().startOf('day').toDate(), new Date()],
  };

  const { laboratoryOrderTypeUuid } = useConfig();
  const customRepresentation = `custom:(uuid,orderNumber,patient:(uuid,display,person:(uuid,display,age,birthdate,gender)${
    includePatientId ? ',identifiers' : ''
  }),concept:(uuid,display),action,careSetting:(uuid,display,description,careSettingType,display),previousOrder,dateActivated,scheduledDate,dateStopped,autoExpireDate,encounter:(uuid,display),orderer:(uuid,display),orderReason,orderReasonNonCoded,orderType:(uuid,display,name,description,conceptClasses,parent),urgency,instructions,commentToFulfiller,display,fulfillerStatus,fulfillerComment,accessionNumber,specimenSource,laterality,clinicalHistory,frequency,numberOfRepeats)`;
  let url = `${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}&v=${customRepresentation}`;
  url = status ? url + `&fulfillerStatus=${status}` : url;
  url = excludeCanceled ? `${url}&excludeCanceledAndExpired=true&excludeDiscontinueOrders=true` : url;
  const extendedStartDate = dateRange && dateRange.at(0)
    ? dayjs(dateRange.at(0)).subtract(30, 'day').startOf('day').toDate()
    : null;

  url = dateRange && extendedStartDate
    ? `${url}&activatedOnOrAfterDate=${extendedStartDate.toISOString()}&activatedOnOrBeforeDate=${dayjs(dateRange.at(1))
        .endOf('day')
        .toDate()
        .toISOString()}`
    : url;

  const { data, error, mutate, isLoading, isValidating } = useSWR<{
    data: { results: Array<Order> };
  }>(`${url}`, openmrsFetch);

  const filteredOrders = data?.data?.results?.filter(
    (order) => {
      if (newOrdersOnly && !((order?.action === 'NEW' || order?.action === 'REVISE') && order?.fulfillerStatus === null)) {
        return false;
      }

      if (!dateRange) {
        return true;
      }

      const dateActivated = dayjs(order.dateActivated);
      const filterStart = dayjs(dateRange.at(0)).startOf('day');
      const filterEnd = dayjs(dateRange.at(1)).endOf('day');

      const isInRange = (d: dayjs.Dayjs) => {
        return (d.isAfter(filterStart) || d.isSame(filterStart)) && 
               (d.isBefore(filterEnd) || d.isSame(filterEnd));
      };

      const { urgency } = extractPriorityFromInstructions(order.instructions, order.urgency);
      const esProgramada = urgency?.toUpperCase() === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' || urgency?.toUpperCase() === 'ON_SCHEDULED_DATE';

      if (!esProgramada) {
        return isInRange(dateActivated);
      }

      // Lógica para orden programada:
      // 1. Creada en el rango seleccionado
      const creadaEnRango = isInRange(dateActivated);

      // 2. Programada para el rango seleccionado (se trunca para evitar desfasamientos por zona horaria)
      const scheduledDate = order.scheduledDate ? dayjs(order.scheduledDate.substring(0, 10)) : null;
      const programadaEnRango = scheduledDate && isInRange(scheduledDate);

      // 3. Pendiente del pasado (para evitar que se pierda)
      const esPendiente = order.fulfillerStatus !== 'COMPLETED' && order.fulfillerStatus !== 'DECLINED' && order.fulfillerStatus !== 'EXCEPTION';
      const pendienteYPasada = esPendiente && scheduledDate && scheduledDate.isBefore(filterStart);

      return creadaEnRango || programadaEnRango || pendienteYPasada;
    }
  );
  return {
    labOrders: filteredOrders ?? [],
    isLoading,
    isError: error,
    mutate,
    isValidating,
  };
}

export function setFulfillerStatus(orderId: string, status: FulfillerStatus, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/order/${orderId}/fulfillerdetails/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: { fulfillerStatus: status },
  });
}

export function rejectLabOrder(orderId: string, comment: string, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/order/${orderId}/fulfillerdetails/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      fulfillerStatus: 'DECLINED',
      fulfillerComment: comment,
    },
  });
}

/**
 * Custom hook that returns a function to invalidate and refetch all lab orders.
 * Use this after mutations to ensure the UI reflects the latest data.
 */
export function useInvalidateLabOrders() {
  const { laboratoryOrderTypeUuid } = useConfig<Config>();

  return useCallback(() => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}`),
      undefined,
      { revalidate: true },
    );
  }, [laboratoryOrderTypeUuid]);
}
