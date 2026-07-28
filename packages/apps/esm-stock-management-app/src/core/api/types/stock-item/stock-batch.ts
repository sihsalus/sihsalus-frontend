import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type StockItem } from './stock-item';

export interface StockBatch extends BaseOpenmrsData {
  batchNo: string;
  expiration: Date;
  stockItem: StockItem;
}
