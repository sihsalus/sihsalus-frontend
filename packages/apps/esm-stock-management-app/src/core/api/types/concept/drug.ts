import { type BaseOpenmrsMetadata } from '../base-openmrs-metadata';
import { type Concept } from './concept';

export interface Drug extends BaseOpenmrsMetadata {
  drugId: number;
  display: string;
  combination: boolean;
  dosageForm: Concept;
  maximumDailyDose: number;
  minimumDailyDose: number;
  strength: string;
  concept: Concept;
  displayName: string;
}
