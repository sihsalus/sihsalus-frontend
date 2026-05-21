import type { FetchResponse, FHIRResource, OpenmrsResource } from '@openmrs/esm-framework';
import type { amPm } from '@openmrs/esm-patient-common-lib';
/**
 * My interfaces
 */
export interface Form {
  uuid: string;
  encounterType?: EncounterType;
  name: string;
  display?: string;
  version: string;
  published: boolean;
  retired: boolean;
  resources: Array<FormEncounterResource>;
  formCategory?: string;
}

/**
 * The resource part of a form encounter.
 */
export interface FormEncounterResource {
  uuid: string;
  name: string;
  dataType: string;
  valueReference: string;
}

/**
 * An encounter which references the form which created the encounter (by being filled out).
 */
export interface EncounterWithFormRef {
  uuid: string;
  encounterType?: EncounterType;
  encounterDatetime: string;
  form?: Form;
}

export interface Privilege {
  uuid: string;
  name: string;
  display?: string;
  description?: string;
}

export interface EncounterType {
  uuid: string;
  name: string;
  viewPrivilege: Privilege | null;
  editPrivilege: Privilege | null;
}

export interface CompletedFormInfo {
  form: Form;
  associatedEncounters: Array<EncounterWithFormRef>;
  lastCompletedDate?: Date;
}

export interface OpenmrsEncounter extends OpenmrsResource {
  encounterDatetime: string;
  encounterType: {
    uuid: string;
    display: string;
  };
  patient: string;
  location: string;
  encounterProviders?: Array<{
    encounterRole: string;
    provider: { uuid: string; person: { uuid: string; display: string }; name: string };
    display?: string;
  }>;
  obs: Array<Observation>;

  form?: { name: string; uuid: string; display?: string };

  visit?: {
    visitType: {
      uuid: string;
      display: string;
    };
  };
  diagnoses?: Array<{
    uuid: string;
    diagnosis: { coded: { display: string } };
  }>;
}
export interface LocationData {
  display: string;
  uuid: string;
}

export interface Concept {
  uuid: string;
  display: string;
  answers?: Concept[];
}

export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display?: string;
    conceptClass?: {
      uuid: string;
      display: string;
    };
    name?: {
      uuid: string;
      name: string;
    };
  };
  display?: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: string | number | { uuid: string; display: string };
    display: string;
  }>;
  value:
    | string
    | number
    | { uuid: string; display: string; names?: Array<{ uuid: string; conceptNameType: string; name: string }> }
    | null;
  obsDatetime?: string;
}

export interface Relationship {
  display: string;
  uuid: string;
  personA: Person;
  personB: Person;
  relationshipType: {
    uuid: string;
    display: string;
    aIsToB: string;
    bIsToA: string;
  };
  startDate: string;
  endDate: string | null;
}

export interface Contact {
  uuid: string;
  name: string;
  display: string;
  relativeAge: number;
  dead: boolean;
  causeOfDeath: string;
  relativeUuid: string;
  relationshipType: string;
  patientUuid: string;
  gender: string;
  contact: string | null;
  startDate: string | null;
  endDate: string | null;
  baselineHIVStatus: string | null;
  personContactCreated: string | null;
  livingWithClient: string | null;
  pnsAproach: string | null;
  ipvOutcome: string | null;
  age: number | null;
}

export interface Person {
  uuid: string;
  age: number;
  dead: boolean;
  display: string;
  causeOfDeath: string;
  gender: string;
  deathDate: string;
  attributes: {
    uuid: string;
    display: string;
    value: string;
    attributeType: {
      uuid: string;
      display: string;
    };
  }[];
}

export interface Patient {
  uuid: string;
  person: Person;
  identifiers: {
    uuid: string;
  }[];
}

export interface RelationShipType {
  uuid: string;
  displayAIsToB: string;
  displayBIsToA: string;
}

export interface Enrollment {
  uuid: string;
  program: {
    name: string;
    uuid: string;
  };
}

export interface HTSEncounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  obs: {
    uuid: string;
    display: string;
    value: {
      uuid: string;
      display: string;
    };
  }[];
}

export interface BedDetails extends Bed {
  patient: null | {
    uuid: string;
    person: {
      gender: string;
      age: number;
      preferredName: {
        givenName: string;
        familyName: string;
      };
    };
    identifiers: Array<{ identifier: string }>;
  };
}

export type AdmissionLocation = {
  ward: {
    uuid: string;
    display: string;
    name: string;
    description: string;
  };
  totalBeds: number;
  occupiedBeds: number;
  bedLayouts: Array<BedDetails>;
};

export interface Bed {
  id: number;
  bedId: number;
  uuid: string;
  bedNumber: string;
  bedType: {
    uuid: string;
    name: string;
    displayName: string;
    description: string;
    resourceVersion: string;
  };
  row: number;
  column: number;
  status: 'AVAILABLE' | string;
  location: string;
}

export type MappedBedData = Array<{
  id: number;
  number: string;
  name: string;
  description: string;
  status: string;
  uuid: string;
}>;

export interface Encounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  location: {
    uuid: string;
    display: string;
  };
}

export interface Visit {
  uuid: string;
  display?: string;
  startDatetime: string;
  stopDatetime?: string;
  encounters;
}

export interface ProgramsFetchResponse {
  results: Array<PatientProgram>;
}

export interface PatientProgram {
  uuid: string;
  patient?: DisplayMetadata;
  program: Program;
  display: string;
  dateEnrolled: string;
  dateCompleted: string | null;
  location?: {
    uuid: string;
    display: string;
    links?: Links;
  };
  voided?: boolean;
  outcome?: null;
  states?: ProgramWorkflowState[];
  links?: Links;
  resourceVersion?: string;
}

export interface ProgramWorkflowState {
  state: {
    uuid: string;
    concept: DisplayMetadata;
  };
  startDate: string;
  endDate: string;
  voided: boolean;
}

export type Links = Array<{
  rel: string;
  uri: string;
}>;

export interface DisplayMetadata {
  display?: string;
  links?: Links;
  uuid?: string;
}

export interface Program {
  uuid: string;
  display: string;
  name: string;
  allWorkflows: Array<{
    uuid: string;
    concept: DisplayMetadata;
    retired: boolean;
    states: Array<{
      uuid: string;
      concept: DisplayMetadata;
    }>;
    links?: Links;
  }>;
  concept: {
    uuid: string;
    display: string;
  };
  links?: Links;
}

export interface ConfigurableProgram extends PatientProgram {
  uuid: string;
  display: string;
  enrollmentFormUuid: string;
  discontinuationFormUuid: string;
  enrollmentStatus: string;
  dateEnrolled: string;
  dateCompleted: string;
}

export interface Immunization {
  sequences?: Array<Sequence>;
  existingDoses: Array<ExistingDoses>;
  vaccineName: string;
  vaccineUuid: string;
  immunizationObsUuid?: string;
  manufacturer?: string;
  expirationDate?: string;
  occurrenceDateTime?: string;
  lotNumber?: string;
  doseNumber?: number;
  formChanged?: boolean;
}

export interface ImmunizationGrouped {
  vaccineName: string;
  vaccineUuid: string;
  existingDoses: Array<ExistingDoses>;
  sequences?: Array<Sequence>;
}

export interface ImmunizationFormState {
  vaccineUuid: string;
  immunizationId?: string;
  vaccinationDate: Date;
  doseNumber: number;
  expirationDate: Date;
  lotNumber: string;
  manufacturer: string;
  visitId?: string;
  locationId?: string;
  providers?: string[];
}

export interface ImmunizationFormData extends ImmunizationFormState {
  patientUuid: string;
  vaccineName: string;
}

export interface Sequence {
  sequenceLabel: string;
  sequenceNumber: string | number;
}

export interface ExistingDoses {
  expirationDate: string;
  immunizationObsUuid: string;
  visitUuid?: string;
  lotNumber: string;
  manufacturer: string;
  occurrenceDateTime: string;
  doseNumber: number;
}
export interface SearchParams {
  query: Query;
}

export interface Query {
  type: string;
  columns: Column[];
  rowFilters: RowFilters[];
  customRowFilterCombination: string;
  name?: string;
  description?: string;
}

export interface RowFilters {
  key?: string;
  parameterValues?: unknown;
  livingStatus?: string;
  type?: string;
}

export interface Column {
  name: string;
  key: string;
  type?: string;
}

export interface DataType {
  uuid: string;
  hl7Abbreviation: string;
  description: string;
  name: string;
}

export interface Cohort {
  id?: string;
  uuid?: string;
  display?: string;
  name: string;
  description: string;
  memberIds?: number[];
}

export interface SearchHistoryItem {
  id: string;
  parameters?: Query;
  results: string;
  description: string;
  patients: Patient[];
}

export interface PaginationData {
  page: number;
  pageSize: number;
}

export interface DropdownValue {
  id: number;
  label: string;
  value: string;
}

export interface SearchByProps {
  onSubmit: (searchParams: SearchParams, queryDescription: string) => Promise<boolean>;
}

export interface Response {
  uuid: string;
  display: string;
  description?: string;
  name?: string;
  id?: string;
}

export interface EncounterDetails {
  onOrAfter: string;
  onOrBefore: string;
  atLeastCount: number;
  atMostCount: number;
  encounterForms: DropdownValue[];
  encounterLocations: DropdownValue[];
  selectedEncounterTypes: DropdownValue[];
}

export interface DefinitionDataRow {
  id: string;
  name: string;
  description: string;
}

export type PatientAppointment = {
  [key: string]: unknown;
  serviceType: string;
  appointmentDate: string;
  appointmentId: string;
};

export interface AppointmentFilterCalendarProps {
  patientId: string;
  appointmentTypeFilter?: string;
}

export interface FHIRConditionResponse {
  entry: Array<{
    resource: FHIRCondition;
  }>;
  id: string;
  meta: {
    lastUpdated: string;
  };
  resourceType: string;
  total: number;
  type: string;
}

export interface FHIRCondition {
  clinicalStatus: {
    coding: Array<CodingData>;
    display: string;
  };
  code: {
    coding: Array<CodingData>;
  };
  id: string;
  onsetDateTime: string;
  recordedDate: string;
  recorder: {
    display: string;
    reference: string;
    type: string;
  };
  resourceType: string;
  subject: {
    display: string;
    reference: string;
    type: string;
  };
  text: {
    div: string;
    status: string;
  };
  abatementDateTime?: string;
}

export interface CodingData {
  code: string;
  display: string;
  extension?: Array<ExtensionData>;
  system?: string;
}

export interface ExtensionData {
  extension: [];
  url: string;
}

type ReferenceRangeValue = number | null | undefined;

export type FHIRSearchBundleResponse = FetchResponse<{
  entry: Array<FHIRResource>;
  link: Array<{ relation: string; url: string }>;
}>;

export interface ObsReferenceRanges {
  hiAbsolute: ReferenceRangeValue;
  hiCritical: ReferenceRangeValue;
  hiNormal: ReferenceRangeValue;
  lowNormal: ReferenceRangeValue;
  lowCritical: ReferenceRangeValue;
  lowAbsolute: ReferenceRangeValue;
}

export type ObservationInterpretation = 'critically_low' | 'critically_high' | 'high' | 'low' | 'normal';

export type MappedInterpretation = {
  code: string;
  interpretation: string;
  recordedDate: Date;
  value: number;
};

export interface AppointmentLocation {
  uuid: string;
  name: string;
}

// note that the API supports two other statuses that we are not currently supporting: "Requested" and "WaitList"
export enum AppointmentStatus {
  SCHEDULED = 'Scheduled',
  CANCELLED = 'Cancelled',
  MISSED = 'Missed',
  CHECKEDIN = 'CheckedIn',
  COMPLETED = 'Completed',
}

export enum AppointmentKind {
  SCHEDULED = 'Scheduled',
  WALKIN = 'WalkIn',
  VIRTUAL = 'Virtual',
}
// TODO: remove interface elements that aren't actually present on the Appointment object returned from the Appointment API
export interface Appointment {
  appointmentKind: AppointmentKind;
  appointmentNumber: string;
  comments: string;
  endDateTime: Date | number | string;
  location: AppointmentLocation;
  patient: {
    identifier: string;
    identifiers: Array<Identifier>;
    name: string;
    uuid: string;
    age?: string;
    gender?: string;
  };
  provider: OpenmrsResource;
  providers: Array<OpenmrsResource>;
  recurring: boolean;
  service: AppointmentService;
  startDateTime: string | number;
  dateAppointmentScheduled: string | number;
  status: AppointmentStatus;
  uuid: string;
  additionalInfo?: string | null;
  serviceTypes?: Array<ServiceTypes> | null;
  voided: boolean;
  extensions: { unknown };
  teleconsultationLink: string | null;
}

export interface AppointmentsFetchResponse {
  data: Array<Appointment>;
}

export interface AppointmentService {
  appointmentServiceId: number;
  creatorName: string;
  description: string;
  durationMins?: number;
  endTime: string;
  initialAppointmentStatus: string;
  location?: OpenmrsResource;
  maxAppointmentsLimit: number | null;
  name: string;
  specialityUuid?: OpenmrsResource | { unknown };
  startTime: string;
  uuid: string;
  serviceTypes?: Array<ServiceTypes>;
  color?: string;
  startTimeTimeFormat?: amPm;
  endTimeTimeFormat?: amPm;
}

export interface ServiceTypes {
  duration: number;
  name: string;
  uuid: string;
}

export interface AppointmentPayload {
  patientUuid: string;
  serviceUuid: string;
  dateAppointmentScheduled: string;
  startDateTime: string;
  endDateTime: string;
  appointmentKind: string;
  providers?: Array<OpenmrsResource>;
  locationUuid: string;
  comments: string;
  status?: string;
  appointmentNumber?: string;
  uuid?: string;
  providerUuid?: string | OpenmrsResource;
}

export interface AppointmentCountMap {
  allAppointmentsCount: number;
  missedAppointmentsCount;
  appointmentDate: number;
  appointmentServiceUuid: string;
}

export interface AppointmentSummary {
  appointmentService: OpenmrsResource;
  appointmentCountMap: Record<string, AppointmentCountMap>;
}

export interface Provider {
  uuid: string;
  display: string;
  comments?: string;
  response?: string;
  person: OpenmrsResource;
  name?: string;
}

export interface Identifier {
  identifier: string;
  identifierName?: string;
}

export interface RecurringPattern {
  type: 'DAY' | 'WEEK';
  period: number;
  endDate: string;
  daysOfWeek?: Array<string>; //'MONDAY' | 'TUESDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'>;
}

export interface RecurringAppointmentsPayload {
  appointmentRequest: AppointmentPayload;
  recurringPattern: RecurringPattern;
}

export interface PatientDetails {
  dateOfBirth: string;
}

export interface PrenatalResponse {
  entry: Array<{
    resource: FHIRResource['resource'];
  }>;
  id: string;
  meta: {
    lastUpdated: string;
  };
  link: Array<{
    relation: string;
    url: string;
  }>;
  resourceType: string;
  total: number;
  type: string;
}

export interface PatientPrenatalAntecedents {
  id: string;
  date: string;
  gravidez?: number;
  partoAlTermino?: number;
  partoPrematuro?: number;
  partoAborto?: number;
  partoNacidoVivo?: number;
  partoNacidoMuerto?: number;
}

export type LegendConfigObject = {
  legendConceptSet: string;
  colorDefinitions: Array<ColourDefinition>;
};

export type ColourDefinition = {
  conceptUuid: string;
  colour: string;
};
