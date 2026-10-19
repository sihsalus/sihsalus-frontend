export type WritableImmunizationStatus = 'completed' | 'not-done';
export type ImmunizationRecordStatus = WritableImmunizationStatus | 'unverified';

export interface Immunization {
  sequences?: Array<Sequence>;
  existingDoses: Array<ExistingDoses>;
  vaccineName: string;
  vaccineUuid: string;
  immunizationObsUuid?: string;
  manufacturer?: string;
  nextDoseDate?: string;
  programContext?: string;
  expirationDate?: string;
  occurrenceDateTime?: string;
  lotNumber?: string;
  doseNumber?: number;
  status?: ImmunizationRecordStatus;
  statusReason?: string;
}

export interface ImmunizationGrouped {
  vaccineName: string;
  vaccineUuid: string;
  existingDoses: Array<ExistingDoses>;
  sequences?: Array<Sequence>;
}

export interface ImmunizationFormState {
  persistenceSource?: 'fhir' | 'ampath-form';
  vaccineUuid: string;
  immunizationId?: string;
  vaccinationDate: string;
  doseNumber: number;
  note: string;
  expirationDate: string;
  lotNumber: string;
  nextDoseDate: string;
  manufacturer: string;
  programContext?: string;
  status?: ImmunizationRecordStatus;
  statusReason?: string;
  visitId?: string;
  locationId?: string;
  providers?: string[];
}

export interface ImmunizationFormData extends Omit<ImmunizationFormState, 'status'> {
  status: WritableImmunizationStatus;
  patientUuid: string;
  vaccineName: string;
}

export interface Sequence {
  sequenceLabel: string;
  sequenceNumber: string | number;
}

export interface ExistingDoses {
  persistenceSource?: 'fhir' | 'ampath-form';
  expirationDate: string;
  immunizationObsUuid: string;
  note: Array<{
    text: string;
  }>;
  visitUuid?: string;
  locationUuid?: string;
  nextDoseDate: string;
  lotNumber: string;
  manufacturer: string;
  occurrenceDateTime: string;
  doseNumber: number;
  programContext?: string;
  status?: ImmunizationRecordStatus;
  statusReason?: string;
}
