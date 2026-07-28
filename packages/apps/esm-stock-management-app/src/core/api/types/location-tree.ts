import { type BaseOpenmrsObject } from './base-openmrs-object';

export interface LocationTree extends BaseOpenmrsObject {
  parentLocationId: number;
  childLocationId: number;
  depth: number;
}
