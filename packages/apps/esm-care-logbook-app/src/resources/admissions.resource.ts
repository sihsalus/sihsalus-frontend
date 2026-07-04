import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import useSWR from 'swr';

interface Identifier {
  identifier?: string;
  preferred?: boolean;
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

interface VisitRelationship {
  uuid?: string;
  personA?: {
    uuid?: string;
    display?: string;
  };
  personB?: {
    uuid?: string;
    display?: string;
  };
  relationshipType?: {
    display?: string;
    aIsToB?: string;
    bIsToA?: string;
  };
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
  documentType: string;
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
  searchText: string;
}

function getMedicalRecordNumber(identifiers: Identifier[] = []) {
  const preferred = identifiers.find((identifier) =>
    /historia|clinical|openmrs|\bhce?\b|c[oó]digo.*temporal|temporary/i.test(identifier.identifierType?.display ?? ''),
  );

  return preferred?.identifier ?? '';
}

const identityDocumentTypePatterns = [
  /dni|documento nacional de identidad/i,
  /\bce\b|carn[eé].*extranjer/i,
  /\bdie\b|documento de identidad extranjero/i,
  /pasaporte|\bpass\b/i,
  /\bcnv\b|certificado de nacido vivo/i,
  /documento/i,
];

function getIdentityDocumentTypePriority(display?: string) {
  const priority = identityDocumentTypePatterns.findIndex((pattern) => pattern.test(display ?? ''));

  return priority === -1 ? Number.POSITIVE_INFINITY : priority;
}

const identityDocumentTypeAttributePattern =
  /tipo.*documento.*identidad|identity.*document.*type|document.*type.*identity/i;
const identityDocumentNumberAttributePattern =
  /(c[oó]digo|n[uú]mero).*documento.*identidad|identity.*document.*(code|number)|document.*identity.*(code|number)/i;
const identityVerificationStatusAttributePattern = /estado.*verificaci[oó]n.*identidad|identity.*verification.*status/i;

function getDocumentIdentifierFromAttributes(attributes: VisitPersonAttribute[] = []) {
  return {
    type: getAttributeValue(attributes, identityDocumentTypeAttributePattern).trim(),
    number: getAttributeValue(attributes, identityDocumentNumberAttributePattern).trim(),
  };
}

function getDocumentIdentifier(identifiers: Identifier[] = [], attributes: VisitPersonAttribute[] = []) {
  const candidates = identifiers
    .map((identifier, index) => ({
      identifier,
      index,
      priority: getIdentityDocumentTypePriority(identifier.identifierType?.display),
    }))
    .filter(
      ({ identifier, priority }) => priority < Number.POSITIVE_INFINITY && Boolean(identifier.identifier?.trim()),
    );

  const selected =
    candidates.find((candidate) => candidate.identifier.preferred) ??
    candidates.sort((left, right) => left.priority - right.priority || left.index - right.index)[0];

  if (selected?.identifier.identifier) {
    return {
      type: selected.identifier.identifierType?.display?.trim() ?? '',
      number: selected.identifier.identifier.trim(),
    };
  }

  return getDocumentIdentifierFromAttributes(attributes);
}

function getAttributeValue(attributes: VisitPersonAttribute[] = [], pattern: RegExp) {
  const attribute = attributes.find((attribute) => pattern.test(attribute.attributeType?.display ?? ''));
  const value = attribute?.value;

  return typeof value === 'string' ? value : (value?.display ?? '');
}

function getAttributeSearchText(attributes: VisitPersonAttribute[] = []) {
  return attributes
    .map((attribute) => {
      const value = typeof attribute.value === 'string' ? attribute.value : attribute.value?.display;
      return [attribute.attributeType?.display, value].filter(Boolean).join(' ');
    })
    .join(' ');
}

function getIdentifierSearchText(identifiers: Identifier[] = []) {
  return identifiers
    .map((identifier) => [identifier.identifierType?.display, identifier.identifier].filter(Boolean).join(' '))
    .join(' ');
}

function getIdentificationStatus(attributes: VisitPersonAttribute[] = []) {
  const configuredStatus = getAttributeValue(attributes, /estado.*identificaci[oó]n|identification status/i);
  if (configuredStatus) {
    return mapIdentificationStatus(configuredStatus);
  }

  const verificationStatus = getAttributeValue(attributes, identityVerificationStatusAttributePattern);
  if (verificationStatus) {
    return mapIdentificationStatus(verificationStatus);
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
    unverified: 'No verificado',
    no_verificado: 'No verificado',
    verified_reniec: 'Validado por RENIEC',
    validado_reniec: 'Validado por RENIEC',
    validado_por_reniec: 'Validado por RENIEC',
    verified_local: 'Validado localmente',
    validado_localmente: 'Validado localmente',
    conflict: 'Conflicto',
    conflicto: 'Conflicto',
    not_applicable: 'No aplica',
    no_aplica: 'No aplica',
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
  const identifiersText = getIdentifierSearchText(identifiers);
  const attributesText = getAttributeSearchText(attributes);

  return /sis|seguro integral/i.test(`${identifiersText} ${attributesText}`);
}

function getRelationshipDisplay(patientUuid: string, relationship: VisitRelationship) {
  if (relationship.personA?.uuid === patientUuid) {
    return {
      name: relationship.personB?.display ?? '',
      relationship: relationship.relationshipType?.bIsToA ?? relationship.relationshipType?.display ?? '',
    };
  }

  return {
    name: relationship.personA?.display ?? '',
    relationship: relationship.relationshipType?.aIsToB ?? relationship.relationshipType?.display ?? '',
  };
}

function isLikelyResponsibleRelationship(relationship: string) {
  return /madre|padre|apoderad|tutor|responsable|guardian|representante|acompa[nñ]ante|cuidador|familiar/i.test(
    relationship,
  );
}

function getResponsibleRelationship(patientUuid: string, relationships: VisitRelationship[] = []) {
  const relationshipRows = relationships
    .map((relationship) => getRelationshipDisplay(patientUuid, relationship))
    .filter((relationship) => relationship.name || relationship.relationship);

  return (
    relationshipRows.find((relationship) => isLikelyResponsibleRelationship(relationship.relationship)) ??
    relationshipRows[0] ?? { name: '', relationship: '' }
  );
}

function getRelationshipSearchText(patientUuid: string, relationships: VisitRelationship[] = []) {
  return relationships
    .map((relationship) => {
      const relationshipDisplay = getRelationshipDisplay(patientUuid, relationship);
      return [relationshipDisplay.name, relationshipDisplay.relationship, relationship.relationshipType?.display]
        .filter(Boolean)
        .join(' ');
    })
    .join(' ');
}

async function fetchRelationshipsForPatients(patientUuids: string[]) {
  const relationshipsByPatient: Record<string, VisitRelationship[]> = {};

  await Promise.all(
    patientUuids.map(async (patientUuid) => {
      try {
        const { data } = await openmrsFetch<{ results?: VisitRelationship[] }>(
          `${restBaseUrl}/relationship?person=${patientUuid}&v=${relationshipRepresentation}`,
        );
        relationshipsByPatient[patientUuid] = data.results ?? [];
      } catch {
        relationshipsByPatient[patientUuid] = [];
      }
    }),
  );

  return relationshipsByPatient;
}

function mapVisitToAdmission(visit: Visit, relationships: VisitRelationship[] = []): AdmissionRow {
  const identifiers = visit.patient?.identifiers ?? [];
  const person = visit.patient?.person;
  const attributes = person?.attributes ?? [];
  const patientUuid = visit.patient?.uuid ?? '';
  const responsibleRelationship = getResponsibleRelationship(patientUuid, relationships);
  const documentIdentifier = getDocumentIdentifier(identifiers, attributes);
  const fallbackResponsibleName = getAttributeValue(
    attributes,
    /nombre del acompa[nñ]ante|responsable|companion name/i,
  );
  const fallbackResponsibleRelationship = getAttributeValue(attributes, /parentesco del acompa[nñ]ante|relationship/i);

  return {
    uuid: visit.uuid,
    patientUuid,
    startDatetime: visit.startDatetime,
    patientName: person?.display ?? visit.patient?.display ?? '',
    medicalRecordNumber: getMedicalRecordNumber(identifiers),
    documentType: documentIdentifier.type,
    documentNumber: documentIdentifier.number,
    identificationStatus: getIdentificationStatus(attributes),
    communicationCondition: getCommunicationCondition(attributes),
    responsibleName: responsibleRelationship.name || fallbackResponsibleName,
    responsibleRelationship: responsibleRelationship.relationship || fallbackResponsibleRelationship,
    birthDate: person?.birthdate ?? '',
    hasSis: hasSis(identifiers, person?.attributes) ? 'Sí' : 'No',
    address: getAddress(person?.addresses),
    gender: person?.gender ?? '',
    service: visit.visitType?.display ?? '',
    location: visit.location?.display ?? '',
    status: visit.stopDatetime ? 'Finalizada' : 'Activa',
    searchText: [
      getIdentifierSearchText(identifiers),
      getAttributeSearchText(attributes),
      getRelationshipSearchText(patientUuid, relationships),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

const visitRepresentation =
  'custom:(uuid,startDatetime,stopDatetime,patient:(uuid,display,identifiers:(identifier,preferred,identifierType:(display)),person:(display,birthdate,gender,addresses:(preferred,address1,cityVillage,stateProvince),attributes:(attributeType:(display),value))),visitType:(display),location:(display))';

const relationshipRepresentation =
  'custom:(display,uuid,personA:(uuid,display),personB:(uuid,display),relationshipType:(uuid,display,description,aIsToB,bIsToA))';

export function useAdmissions(limit: number) {
  const url = `${restBaseUrl}/visit?includeInactive=true&v=${visitRepresentation}&limit=${limit}`;
  const { data, error, isLoading } = useSWR<{ data: VisitResponse }, Error>(url, openmrsFetch);
  const visits = data?.data.results ?? [];
  const patientUuids = Array.from(new Set(visits.map((visit) => visit.patient?.uuid).filter(Boolean))).sort();
  const relationshipsKey = patientUuids.length ? `admission-relationships:${patientUuids.join(',')}` : null;
  const { data: relationshipsByPatient, isLoading: isLoadingRelationships } = useSWR<
    Record<string, VisitRelationship[]>
  >(relationshipsKey, () => fetchRelationshipsForPatients(patientUuids));

  return {
    admissions: visits.map((visit) => mapVisitToAdmission(visit, relationshipsByPatient?.[visit.patient?.uuid ?? ''])),
    error,
    isLoading: isLoading || !!(relationshipsKey && isLoadingRelationships && !relationshipsByPatient),
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
