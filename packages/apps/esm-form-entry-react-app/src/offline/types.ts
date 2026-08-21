import type { Encounter, EncounterCreate, PersonUpdate } from '../types';

export interface PatientFormSyncItemForm {
  uuid: string;
  name?: string;
  display?: string;
  version?: string;
  published?: boolean;
  retired?: boolean;
  resources?: Array<unknown>;
}

interface BasePatientFormSyncItemContent {
  /** Stable client-generated OpenMRS UUID and queue replacement key for this new encounter. */
  _id: string;
  encounter: Partial<Encounter>;
  /** Durable checkpoints written by the offline queue consumer. Absent on legacy queued items. */
  _syncState?: {
    encounter?: PatientFormWriteCheckpoint<EncounterCreate>;
    person?: PatientFormWriteCheckpoint<PersonUpdate>;
  };
  _payloads: {
    encounterCreate?: EncounterCreate;
    personUpdate?: PersonUpdate;
  };
}

export type PatientFormWriteCheckpoint<T> =
  | {
      status: 'attempted';
      payload: T;
      attemptId: string;
    }
  | {
      status: 'completed';
      payload: T;
      attemptId?: string;
    };

export interface LegacyPatientFormSyncItemContent extends BasePatientFormSyncItemContent {
  formSchemaUuid: string;
  form?: never;
}

export interface CanonicalPatientFormSyncItemContent extends BasePatientFormSyncItemContent {
  form: PatientFormSyncItemForm;
  formSchemaUuid?: string;
}

export type PatientFormSyncItemContent = LegacyPatientFormSyncItemContent | CanonicalPatientFormSyncItemContent;
