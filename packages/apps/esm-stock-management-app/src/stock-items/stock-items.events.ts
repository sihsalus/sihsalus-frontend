import { type StockItemDTO } from '../core/api/types/stockItem/StockItem';

export const stockItemCreatedEvent = 'sihsalus-stock-item-created';

export interface StockItemCreatedEventDetail {
  stockItem: StockItemDTO;
}
