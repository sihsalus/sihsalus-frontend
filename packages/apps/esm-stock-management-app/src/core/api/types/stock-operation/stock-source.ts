import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type Concept } from '../concept/concept';

export interface StockSource extends BaseOpenmrsData {
  name: string;
  acronym: string;
  sourceType: Concept | undefined;
}
