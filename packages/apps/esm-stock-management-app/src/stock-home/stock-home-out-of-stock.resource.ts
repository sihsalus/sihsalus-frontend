import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { ResourceRepresentation } from '../core/api/api';
import { LocationStockItem, type StockItemDTO } from '../core/api/types/stockItem/StockItem';
import { type StockItemInventory } from '../core/api/types/stockItem/StockItemInventory';

type StockItemsResponse = {
  results?: Array<StockItemDTO>;
};

type StockInventoryResponse = {
  results?: Array<StockItemInventory>;
};

async function fetchOutOfStockDrugs() {
  const stockItemsResponse = await openmrsFetch<StockItemsResponse>(
    `${restBaseUrl}/stockmanagement/stockitem?v=${ResourceRepresentation.Default}&totalCount=true&startIndex=0&limit=1000&isDrug=true`,
  );

  const drugStockItems = stockItemsResponse.data.results?.filter((item) => item.uuid && !item.voided) ?? [];

  const inventoryByDrug = await Promise.all(
    drugStockItems.map(async (stockItem) => {
      const inventoryResponse = await openmrsFetch<StockInventoryResponse>(
        `${restBaseUrl}/stockmanagement/stockiteminventory?v=${ResourceRepresentation.Default}&totalCount=true&startIndex=0&limit=1000&stockItemUuid=${stockItem.uuid}&groupBy=${LocationStockItem}`,
      );

      const quantity = inventoryResponse.data.results?.reduce((total, item) => total + Number(item.quantity ?? 0), 0) ?? 0;
      return {
        stockItem,
        quantity,
      };
    }),
  );

  return inventoryByDrug.filter(({ quantity }) => quantity <= 0).map(({ stockItem }) => stockItem);
}

export function useOutOfStockDrugs() {
  const { data, error, isLoading } = useSWR('stockmanagement/out-of-stock-drugs', fetchOutOfStockDrugs);

  return {
    items: data ?? [],
    isLoading,
    error,
  };
}
