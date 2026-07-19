import { type OpenmrsResource } from '@openmrs/esm-framework';

import { type amPm } from '../helpers';

export enum SearchTypes {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  SEARCH_RESULTS = 'search_results',
  SCHEDULED_VISITS = 'scheduled-visits',
}

export interface AppointmentLocation {
  uuid: string;
  name: string;
}

export enum AppointmentStatus {
  REQUESTED = 'Requested',
  WAITLIST = 'WaitList',
  SCHEDULED = 'Scheduled',
  ARRIVED = 'Arrived',
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
  startDateTime: string | number | Date;
  dateAppointmentScheduled: string | number | Date;
  status: AppointmentStatus;
  uuid: string;
  additionalInfo?: string | null;
  serviceTypes?: Array<ServiceTypes> | null;
  voided: boolean;
  extensions: Record<string, unknown>;
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
  speciality?: OpenmrsResource | Record<string, never>;
  startTime: string;
  uuid: string;
  serviceTypes?: Array<ServiceTypes>;
  gender?: string;
  allowedGenders?: Array<string>;
  color?: string;
  startTimeTimeFormat?: amPm;
  endTimeTimeFormat?: amPm;
}

export interface ServiceTypes {
  duration: number;
  name: string;
  uuid: string;
}

export interface DashboardConfig {
  name: string;
  slot: string;
  title: string;
}

export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display: string;
    conceptClass: {
      uuid: string;
      display: string;
    };
  };
  display: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: {
      uuid: string;
      display: string;
    };
  }>;
  value: unknown;
  obsDatetime: string;
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
  missedAppointmentsCount: number;
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
  attributes?: Array<{
    uuid: string;
    attributeType?: OpenmrsResource;
    value?: unknown;
    voided?: boolean;
  }>;
}

export enum DurationPeriod {
  monthly = 0,
  weekly = 1,
  daily = 2,
}

export interface Identifier {
  identifier: string;
  identifierName?: string;
  identifierType?: {
    uuid?: string;
    name?: string;
    display?: string;
  };
  preferred?: boolean;
}

export interface DailyAppointmentsCountByService {
  appointmentDate: string;
  services: Array<{
    serviceName: string;
    serviceUuid: string;
    count: number;
  }>;
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
