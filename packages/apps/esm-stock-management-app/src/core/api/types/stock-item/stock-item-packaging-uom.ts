import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type Concept } from '../concept/concept';
import { type StockItem } from './stock-item';

export interface StockItemPackagingUOM extends BaseOpenmrsData {
  factor: number;
  packagingUom: Concept;
  stockItem: StockItem;
}

export interface StockItemPackagingUOMDTO {
  id?: string;
  uuid?: string;
  stockItemUuid?: string;
  packagingUomName?: string;
  packagingUomUuid?: string;
  factor?: number | null;
  quantityFactor?: number | string | null;
  isDefaultStockOperationsUoM?: boolean;
  isDispensingUnit?: boolean;
}
