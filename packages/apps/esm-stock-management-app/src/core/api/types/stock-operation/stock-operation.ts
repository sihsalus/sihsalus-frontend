import { type BaseOpenmrsData } from '../base-openmrs-data';
import { type Concept } from '../concept/concept';
import { type Patient } from '../identity/patient';
import { type User } from '../identity/user';
import { type OpenMRSLocation } from '../location';
import { type StockOperationItem } from './stock-operation-item';
import { type StockOperationStatus } from './stock-operation-status';
import { type StockOperationType } from './stock-operation-type';

export interface StockOperation extends BaseOpenmrsData {
  cancelReason: string;
  cancelledBy: User;
  cancelledDate: Date;
  completedBy: User;
  completedDate: Date;
  destination: OpenMRSLocation;
  externalReference: string;
  location: OpenMRSLocation;
  operationDate: Date;
  locked: boolean;
  operationNumber: string;
  operationOrder: number;
  patient: Patient;
  remarks: string;
  source: OpenMRSLocation;
  sourceOther: string;
  status: StockOperationStatus;
  returnReason: string;
  rejectionReason: string;
  workflowId: number;
  responsiblePerson: User;
  responsiblePersonOther: string;
  consignmentCategory: Concept;
  stockOperationType: StockOperationType;
  stockOperationItems: StockOperationItem[];
}
