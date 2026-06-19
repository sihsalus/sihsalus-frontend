import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type ResourceFilterCriteria, toQueryParams } from '../core/api/api';
import { type PageableResult } from '../core/api/types/PageableResult';
import { type InventoryGroupBy } from '../core/api/types/stockItem/StockItem';
import { type StockItemInventory } from '../core/api/types/stockItem/StockItemInventory';
import { type StopOperationAction } from '../core/api/types/stockOperation/StockOperationAction';
import { type StockOperationDTO } from '../core/api/types/stockOperation/StockOperationDTO';
import { type StockOperationItemCost } from '../core/api/types/stockOperation/StockOperationItemCost';
import { type StockOperationItemDtoSchema } from './validation-schema';

const emptyStockOperationResult: PageableResult<StockOperationDTO> = {
  results: [],
  links: null,
  totalCount: 0,
};

function normalizeStockOperationResult(responseData: unknown): PageableResult<StockOperationDTO> {
  if (!responseData) {
    return emptyStockOperationResult;
  }

  if (Array.isArray(responseData)) {
    return {
      results: responseData as Array<StockOperationDTO>,
      links: null,
      totalCount: responseData.length,
    };
  }

  if (typeof responseData === 'object') {
    const data = responseData as Partial<PageableResult<StockOperationDTO>> & {
      data?: unknown;
      stockOperations?: unknown;
    };

    if (Array.isArray(data.results)) {
      return {
        results: data.results,
        links: data.links ?? null,
        totalCount: data.totalCount ?? data.results.length,
      };
    }

    if (Array.isArray(data.data)) {
      return {
        results: data.data as Array<StockOperationDTO>,
        links: null,
        totalCount: data.data.length,
      };
    }

    if (Array.isArray(data.stockOperations)) {
      return {
        results: data.stockOperations as Array<StockOperationDTO>,
        links: null,
        totalCount: data.stockOperations.length,
      };
    }
  }

  return emptyStockOperationResult;
}

export type StockOperationPayload = Omit<StockOperationItemDtoSchema, 'stockOperationItems'> & {
  stockOperationItems: Array<StockOperationItemDtoSchema['stockOperationItems'][number]>;
};

function toDateOnlyString(date: Date | string | null | undefined) {
  if (!date) {
    return date;
  }

  if (typeof date === 'string') {
    return date.split('T')[0];
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toStockOperationRequestPayload(data: StockOperationPayload) {
  const payload = {
    ...data,
    stockOperationItems: data.stockOperationItems.map((item) => ({
      ...item,
      expiration: toDateOnlyString(item.expiration),
    })),
  };
  delete payload.atLocationName;
  return payload;
}

export interface StockOperationFilter extends ResourceFilterCriteria {
  status?: string | null | undefined;
  operationTypeUuid?: string | null | undefined;
  locationUuid?: string | null | undefined;
  isLocationOther?: boolean | null | undefined;
  stockItemUuid?: string | null | undefined;
  operationDateMin?: string | null | undefined;
  operationDateMax?: string | null | undefined;
  sourceTypeUuid?: string | null | undefined;
}

export interface StockItemInventoryFilter extends ResourceFilterCriteria {
  stockItemUuid?: string | null;
  partyUuid?: string | null;
  locationUuid?: string | null;
  includeBatchNo?: boolean | null;
  stockBatchUuid?: string | null;
  groupBy?: InventoryGroupBy | null;
  totalBy?: InventoryGroupBy | null;
  stockOperationUuid?: string | null;
  date?: string | null;
  includeStockItemName?: 'true' | 'false' | '0' | '1';
  excludeExpired?: boolean | null;
}

// getStockOperations
export function useStockOperations(filter: StockOperationFilter) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation${toQueryParams(filter)}`;
  const { data, error, isLoading } = useSWR<FetchResponse<unknown>, Error>(apiUrl, openmrsFetch);

  return {
    items: normalizeStockOperationResult(data?.data),
    isLoading,
    error,
  };
}

// getStockOperationLinks
export function getStockOperationLinks(filter: string) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperationlink?v=default&q=${filter}`;
  const abortController = new AbortController();

  return openmrsFetch(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

// getStockOperation

export function useStockOperation(id: string | null) {
  const apiUrl = id ? `${restBaseUrl}/stockmanagement/stockoperation/${id}` : null;
  const { data, error, isLoading } = useSWR<{ data: StockOperationDTO }, Error>(apiUrl, apiUrl ? openmrsFetch : null);
  return {
    items: data?.data,
    isLoading,
    error,
  };
}

// getStockOperation
export function getStockOperation(id: string): Promise<FetchResponse<StockOperationDTO>> {
  if (!id) {
    return;
  }
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation/${id}?v=full`;
  return openmrsFetch(apiUrl);
}

// getStockOperationAndItems
export function useStockOperationAndItems(id = '') {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation/${id}?v=full`;
  const { data, error, isLoading } = useSWR<{ data: StockOperationDTO }, Error>(id ? apiUrl : null, openmrsFetch);
  return {
    items: data?.data,
    isLoading,
    error,
  };
}

// deleteStockOperations
export function deleteStockOperations(ids: string[]) {
  let otherIds = ids.reduce((p, c, i) => {
    if (i === 0) return p;
    p += (p.length > 0 ? ',' : '') + encodeURIComponent(c);
    return p;
  }, '');
  if (otherIds.length > 0) {
    otherIds = '?ids=' + otherIds;
  }
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation/${ids[0]}${otherIds}`;
  const abortController = new AbortController();
  return openmrsFetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

// deleteStockOperationItem
export function deleteStockOperationItem(id: string) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperationitem/${id}`;
  const abortController = new AbortController();
  return openmrsFetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

// createStockOperation
export function createStockOperation(data: StockOperationPayload) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation`;
  const abortController = new AbortController();
  const payload = toStockOperationRequestPayload(data);
  return openmrsFetch<StockOperationDTO>(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: payload,
  });
}

// updateStockOperation
export function updateStockOperation(stockOperation: StockOperationDTO, data: StockOperationPayload) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperation/${stockOperation.uuid}`;
  const abortController = new AbortController();
  const payload = toStockOperationRequestPayload(data);
  return openmrsFetch<StockOperationDTO>(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: payload,
  });
}

// executeStockOperationAction
export function executeStockOperationAction(item: StopOperationAction) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperationaction`;
  const abortController = new AbortController();
  return openmrsFetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: item,
  });
}

// updateStockOperationBatchNumbers
export function updateStockOperationBatchNumbers(item: StockOperationDTO, uuid: string) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperationbatchnumbers/${uuid}`;
  const abortController = new AbortController();
  return openmrsFetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: item,
  });
}

// get stock operation itemcosts
export function getStockOperationItemsCost(filter: StockOperationFilter) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockoperationitemcost?v=default&stockOperationUuid=${filter}`;
  const abortController = new AbortController();
  return openmrsFetch<{ results: Array<StockOperationItemCost> }>(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}
// get stockiteminvoentory
export function getStockItemInventory(filter: StockItemInventoryFilter) {
  const apiUrl = `${restBaseUrl}/stockmanagement/stockiteminventory${toQueryParams(filter)}&v=default`;
  const abortController = new AbortController();
  return openmrsFetch<{ results: Array<StockItemInventory> }>(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

export const operationStatusColor = (status: string) => {
  switch (status) {
    case 'NEW':
      return '#0f62fe';
    case 'SUBMITTED':
      return '#4589ff';
    case 'DISPATCHED':
      return '#8a3ffc';
    case 'COMPLETED':
      return '#24a148';
    case 'CANCELLED':
      return '#da1e28';
    case 'RETURNED':
      return '#eb6200';
    default:
      break;
  }
};
