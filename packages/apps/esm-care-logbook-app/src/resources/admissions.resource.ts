import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import useSWR from 'swr';

interface Identifier {
  identifier?: string;
  identifierType?: {
    display?: string;
  };
}

interface VisitPersonAttribute {
  attributeType?: {
    display?: string;
  };
  value?:
    | string
    | {
        display?: string;
      };
}

interface VisitPersonAddress {
  preferred?: boolean;
  address1?: string;
  cityVillage?: string;
  stateProvince?: string;
}

interface Visit {
  uuid: string;
  startDatetime?: string;
  stopDatetime?: string;
  patient?: {
    uuid?: string;
    display?: string;
    identifiers?: Identifier[];
    person?: {
      display?: string;
      birthdate?: string;
      gender?: string;
      addresses?: VisitPersonAddress[];
      attributes?: VisitPersonAttribute[];
    };
  };
  visitType?: {
    display?: string;
  };
  location?: {
    display?: string;
  };
}

interface VisitResponse {
  results?: Visit[];
}

export interface AdmissionRow {
  uuid: string;
  patientUuid: string;
  startDatetime?: string;
  patientName: string;
  medicalRecordNumber: string;
  documentNumber: string;
  identificationStatus: string;
  communicationCondition: string;
  responsibleName: string;
  responsibleRelationship: string;
  birthDate: string;
  hasSis: string;
  address: string;
  gender: string;
  service: string;
  location: string;
  status: string;
}

function getMedicalRecordNumber(identifiers: Identifier[] = []) {
  const preferred = identifiers.find((identifier) =>
    /historia|clinical|openmrs|hc/i.test(identifier.identifierType?.display ?? ''),
  );

  return preferred?.identifier ?? '';
}

function getDocumentNumber(identifiers: Identifier[] = []) {
  const preferred = identifiers.find((identifier) =>
    /dni|\bce\b|carn[eé].*extranjer|pasaporte|pass|documento|certificado de nacido vivo|cnv|\bdie\b/i.test(
      identifier.identifierType?.display ?? '',
    ),
  );

  return preferred?.identifier ?? '';
}

function getAttributeValue(attributes: VisitPersonAttribute[] = [], pattern: RegExp) {
  const attribute = attributes.find((attribute) => pattern.test(attribute.attributeType?.display ?? ''));
  const value = attribute?.value;

  return typeof value === 'string' ? value : (value?.display ?? '');
}

function getIdentificationStatus(attributes: VisitPersonAttribute[] = []) {
  const configuredStatus = getAttributeValue(attributes, /estado.*identificaci[oó]n|identification status/i);
  if (configuredStatus) {
    return mapIdentificationStatus(configuredStatus);
  }

  const unknownPatient = getAttributeValue(attributes, /paciente no identificado|unidentified patient/i);
  return /^true$/i.test(unknownPatient) ? 'Pendiente' : 'Confirmado';
}

function mapIdentificationStatus(status: string) {
  const normalizedStatus = status.trim().toLocaleLowerCase();
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    partial: 'Parcial',
    confirmed: 'Confirmado',
    merged: 'Fusionado',
  };

  return statusLabels[normalizedStatus] ?? status;
}

function getCommunicationCondition(attributes: VisitPersonAttribute[] = []) {
  const condition = getAttributeValue(attributes, /condici[oó]n.*comunicaci[oó]n|communication condition/i);
  const conditionLabels: Record<string, string> = {
    communicates: 'Puede comunicarse',
    unconscious: 'Inconsciente',
    comatose: 'Comatoso',
    disoriented: 'Desorientado',
    non_verbal: 'No verbal',
    minor_without_data: 'Menor sin datos',
    other: 'Otro',
  };

  return conditionLabels[condition] ?? condition;
}

function getAddress(addresses: VisitPersonAddress[] = []) {
  const preferred = addresses.find((address) => address.preferred) ?? addresses[0];

  return preferred
    ? [preferred.address1, preferred.cityVillage, preferred.stateProvince].filter(Boolean).join(', ')
    : '';
}

function hasSis(identifiers: Identifier[] = [], attributes: VisitPersonAttribute[] = []) {
  const identifiersText = identifiers
    .map((identifier) => [identifier.identifierType?.display, identifier.identifier].filter(Boolean).join(' '))
    .join(' ');
  const attributesText = attributes
    .map((attribute) => {
      const value = typeof attribute.value === 'string' ? attribute.value : attribute.value?.display;
      return [attribute.attributeType?.display, value].filter(Boolean).join(' ');
    })
    .join(' ');

  return /sis|seguro integral/i.test(`${identifiersText} ${attributesText}`);
}

function mapVisitToAdmission(visit: Visit): AdmissionRow {
  const identifiers = visit.patient?.identifiers ?? [];
  const person = visit.patient?.person;
  const attributes = person?.attributes ?? [];

  return {
    uuid: visit.uuid,
    patientUuid: visit.patient?.uuid ?? '',
    startDatetime: visit.startDatetime,
    patientName: person?.display ?? visit.patient?.display ?? '',
    medicalRecordNumber: getMedicalRecordNumber(identifiers),
    documentNumber: getDocumentNumber(identifiers),
    identificationStatus: getIdentificationStatus(attributes),
    communicationCondition: getCommunicationCondition(attributes),
    responsibleName: getAttributeValue(attributes, /nombre del acompa[nñ]ante|responsable|companion name/i),
    responsibleRelationship: getAttributeValue(attributes, /parentesco del acompa[nñ]ante|relationship/i),
    birthDate: person?.birthdate ?? '',
    hasSis: hasSis(identifiers, person?.attributes) ? 'Sí' : 'No',
    address: getAddress(person?.addresses),
    gender: person?.gender ?? '',
    service: visit.visitType?.display ?? '',
    location: visit.location?.display ?? '',
    status: visit.stopDatetime ? 'Finalizada' : 'Activa',
  };
}

const visitRepresentation =
  'custom:(uuid,startDatetime,stopDatetime,patient:(uuid,display,identifiers:(identifier,identifierType:(display)),person:(display,birthdate,gender,addresses:(preferred,address1,cityVillage,stateProvince),attributes:(attributeType:(display),value))),visitType:(display),location:(display))';

export function useAdmissions(limit: number) {
  const url = `${restBaseUrl}/visit?includeInactive=true&v=${visitRepresentation}&limit=${limit}`;
  const { data, error, isLoading } = useSWR<{ data: VisitResponse }, Error>(url, openmrsFetch);

  return {
    admissions: data?.data.results?.map(mapVisitToAdmission) ?? [],
    error,
    isLoading,
  };
}

export function useActiveVisitSummary(patientUuid?: string) {
  const url = patientUuid
    ? `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=false&v=${visitRepresentation}&limit=1`
    : null;
  const { data, error, isLoading } = useSWR<{ data: VisitResponse }, Error>(url, openmrsFetch);
  const visit = data?.data.results?.[0];

  return {
    visit: visit
      ? {
          service: visit.visitType?.display ?? '',
          location: visit.location?.display ?? '',
        }
      : null,
    error,
    isLoading,
  };
}

// ── Patient detail (N1.ADM.03.01 / N1.ADM.01.01) ───────────────────────────

export interface PatientIdentifier {
  identifier?: string;
  identifierType?: { display?: string; required?: boolean };
  preferred?: boolean;
}

export interface PersonAttribute {
  attributeType?: { display?: string };
  value?: string | { display?: string };
}

interface PersonAddress {
  preferred?: boolean;
  address1?: string;
  cityVillage?: string;
  stateProvince?: string;
}

export interface PatientFiliation {
  display?: string;
  birthdate?: string;
  birthdateEstimated?: boolean;
  gender?: string;
  age?: number;
  addresses?: PersonAddress[];
  attributes?: PersonAttribute[];
}

export interface PatientDetail {
  person?: PatientFiliation;
  identifiers?: PatientIdentifier[];
}

const patientDetailRepresentation =
  'custom:(person:(display,birthdate,birthdateEstimated,gender,age,addresses:(preferred,address1,cityVillage,stateProvince),attributes:(attributeType:(display),value)),identifiers:(identifier,identifierType:(display,required),preferred))';

export function usePatientDetail(patientUuid?: string) {
  const url = patientUuid ? `${restBaseUrl}/patient/${patientUuid}?v=${patientDetailRepresentation}` : null;
  const { data, error, isLoading } = useSWR<{ data: PatientDetail }, Error>(url, openmrsFetch);

  return {
    patient: data?.data ?? null,
    error,
    isLoading,
  };
}

export interface PatientVisitRow {
  uuid: string;
  startDatetime?: string;
  stopDatetime?: string;
  service: string;
  location: string;
  status: string;
}

interface VisitForHistory {
  uuid: string;
  startDatetime?: string;
  stopDatetime?: string;
  visitType?: { display?: string };
  location?: { display?: string };
}

const visitHistoryRepresentation = 'custom:(uuid,startDatetime,stopDatetime,visitType:(display),location:(display))';

export function usePatientVisitHistory(patientUuid?: string) {
  const url = patientUuid
    ? `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=true&v=${visitHistoryRepresentation}&limit=50`
    : null;
  const { data, error, isLoading } = useSWR<{ data: { results?: VisitForHistory[] } }, Error>(url, openmrsFetch);

  return {
    visits:
      data?.data.results?.map(
        (v): PatientVisitRow => ({
          uuid: v.uuid,
          startDatetime: v.startDatetime,
          stopDatetime: v.stopDatetime,
          service: v.visitType?.display ?? '-',
          location: v.location?.display ?? '-',
          status: v.stopDatetime ? 'Finalizada' : 'Activa',
        }),
      ) ?? [],
    error,
    isLoading,
  };
}

export interface PatientAppointmentRow {
  uuid: string;
  startDateTime?: string;
  endDateTime?: string;
  service: string;
  provider: string;
  location: string;
  status: string;
}

interface AppointmentSearchResult {
  uuid: string;
  startDateTime?: string;
  endDateTime?: string;
  status?: string;
  service?: {
    name?: string;
  };
  providers?: Array<{
    name?: string;
    display?: string;
  }>;
  location?: {
    name?: string;
    display?: string;
  };
}

const appointmentsSearchUrl = `${restBaseUrl}/appointments/search`;

function mapAppointment(appointment: AppointmentSearchResult): PatientAppointmentRow {
  const provider = appointment.providers
    ?.map((appointmentProvider) => appointmentProvider.name ?? appointmentProvider.display)
    .filter(Boolean)
    .join(', ');

  return {
    uuid: appointment.uuid,
    startDateTime: appointment.startDateTime,
    endDateTime: appointment.endDateTime,
    service: appointment.service?.name ?? '-',
    provider: provider || '-',
    location: appointment.location?.name ?? appointment.location?.display ?? '-',
    status: appointment.status ?? '-',
  };
}

export function usePatientUpcomingAppointments(patientUuid?: string) {
  const startDate = dayjs(new Date().toISOString()).subtract(6, 'month').toISOString();
  const fetcher = () =>
    openmrsFetch(appointmentsSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientUuid,
        startDate,
      }),
    });

  const { data, error, isLoading } = useSWR<{ data: AppointmentSearchResult[] }, Error>(
    patientUuid ? [appointmentsSearchUrl, patientUuid] : null,
    fetcher,
  );

  return {
    appointments:
      data?.data
        ?.filter((appointment) => appointment.status !== 'Cancelled')
        .filter((appointment) => appointment.startDateTime && dayjs(appointment.startDateTime).isAfter(new Date()))
        .sort((a, b) => ((a.startDateTime ?? '') > (b.startDateTime ?? '') ? 1 : -1))
        .map(mapAppointment) ?? [],
    error,
    isLoading,
  };
}
