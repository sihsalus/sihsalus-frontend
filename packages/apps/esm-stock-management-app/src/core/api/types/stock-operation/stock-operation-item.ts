import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type StockBatch } from '../stock-item/stock-batch';
import { type StockItem } from '../stock-item/stock-item';
import { type StockItemPackagingUOM } from '../stock-item/stock-item-packaging-uom';
import { type StockOperation } from './stock-operation';

export interface StockOperationItem extends BaseOpenmrsData {
  quantity: number;
  stockBatch: StockBatch;
  stockItemPackagingUOM: StockItemPackagingUOM;
  stockItem: StockItem;
  stockOperation: StockOperation;
}
