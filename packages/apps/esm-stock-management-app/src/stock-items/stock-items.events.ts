import { type StockItemDTO } from '../core/api/types/stock-item/stock-item';

export const stockItemCreatedEvent = 'sihsalus-stock-item-created';

export interface StockItemCreatedEventDetail {
  stockItem: StockItemDTO;
}
