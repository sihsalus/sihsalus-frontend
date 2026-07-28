import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type StockSource } from '../stock-operation/stock-source';
import { type StockItem } from './stock-item';

export interface StockItemReference extends BaseOpenmrsData {
  referenceCode: string;
  stockSource: StockSource;
  stockItem: StockItem;
}

export interface StockItemReferenceDTO {
  id?: string;
  uuid?: string;
  stockItemUuid?: string;
  stockSourceName?: string;
  stockSourceUuid?: string;
  referenceCode?: string | null;
}
