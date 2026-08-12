declare module '@sihsalus/esm-form-engine-lib' {
  import type React from 'react';
  import type { Encounter, OpenmrsResource, Visit } from '@openmrs/esm-framework';

  export type SessionMode = 'edit' | 'enter' | string;
  export type PreFilledQuestions = Record<string, unknown>;

  export interface FormSchema {
    uuid?: string;
    name?: string;
    pages?: Array<unknown>;
    [key: string]: unknown;
  }

  export interface OpenmrsEncounter extends Encounter {
    [key: string]: unknown;
  }

  export interface DataSource<T = unknown> {
    fetchData(searchTerm?: string, config?: Record<string, unknown>): Promise<Array<T>>;
    fetchSingleItem(uuid: string): Promise<T | null>;
    toUuidAndDisplay(item: T): OpenmrsResource;
  }

  export function registerCustomDataSource(registration: {
    name: string;
    load: () => Promise<{ default: DataSource<OpenmrsResource> }>;
  }): void;

  export interface FormEngineProps {
    encounterUUID?: string;
    formJson: FormSchema;
    formSessionIntent?: string;
    handleClose: () => void;
    handleConfirmQuestionDeletion?: () => Promise<void>;
    handleEncounterCreate?: (encounter: OpenmrsEncounter) => OpenmrsEncounter | void | Promise<OpenmrsEncounter | void>;
    onBeforeEncounterSave?: (encounter: OpenmrsEncounter) => void | Promise<void>;
    handleOnValidate?: (valid: boolean) => void;
    hideControls?: boolean;
    hidePatientBanner?: boolean;
    markFormAsDirty?: (isDirty: boolean) => void;
    mode?: SessionMode;
    onSubmit: (data: Array<OpenmrsResource>) => void;
    patientUUID: string;
    preFilledQuestions?: PreFilledQuestions;
    visit?: Visit;
  }

  export const FormEngine: React.ComponentType<FormEngineProps>;
}
