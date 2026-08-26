/**
 * Financiador persona → visita (Fase 2 del plan de alineamiento de seguros SIS).
 *
 * Principio congelado por el equipo: «el financiador es dato de la VISITA,
 * copiado desde la afiliación de la PERSONA». Este módulo es el único punto de
 * verdad para esa copia: lee los person attributes de afiliación y hace upsert
 * idempotente de los visit attributes correspondientes.
 *
 * Ver docs/clinical/plan-alineamiento-seguros-sis.md (PR #606) y
 * sihsalus-content#163 (aprovisionamiento de los attribute types).
 */
import { omrsOfflineCachingStrategyHttpHeaderName, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

// ── Person attribute types (afiliación de la persona) ───────────────────────
export const INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID = '56188294-b42c-481d-a987-4b495116c580';
export const INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID = '374b130f-7457-476f-87b1-f182aa77c434';
export const ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db1005';
export const ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db1006';
export const INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID = 'bc1e5c92-e46a-4bc9-8cba-d9093a0eb659';

// ── Visit attribute types (financiador de ESTA atención) ────────────────────
export const FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID = '3a988e33-a6c0-4b76-b924-01abb998944b';
export const INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID = 'aac48226-d143-4274-80e0-264db4e368ee';
export const SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID = '5e13e902-2030-4f65-b9d5-9a4810c9a603';
export const SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID = 'e3a66f60-4abe-4948-b323-7c4935d8eb8a';

// ── Catálogo canónico «Tipo de seguro» ───────────────────────────────────────
export const INSURANCE_TYPE_CONCEPT_SET_UUID = '6b932638-242e-49ef-8ba7-0ae87199835c';
export const SIS_CONCEPT_UUID = '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c';
export const SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
export const SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';
export const SIS_ACCREDITATION_PENDING_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2053';
export const SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2054';
export const SELF_FINANCED_CONCEPT_UUID = 'cc72568e-d0d9-46a8-a618-91f0d679f518';
/** Afiliación temporal E-######## emitida/registrada por SIASIS/SIS y capturada en SIH Salus. */
export const SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID = '68a90c20-eec8-433a-aa92-83e549d801db';
export const SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD = 'siasis-adt';
export const TRUSTED_SIS_VERIFICATION_METHODS = [
  'manual-web',
  'setisis',
  SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD,
] as const;
export type TrustedSisVerificationMethod = (typeof TRUSTED_SIS_VERIFICATION_METHODS)[number];

const trustedSisVerificationMethods: ReadonlySet<string> = new Set(TRUSTED_SIS_VERIFICATION_METHODS);
const isoDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
let freshCoverageRequestSequence = 0;

function getFreshCoverageRequestNonce() {
  freshCoverageRequestSequence += 1;
  return `${Date.now()}-${freshCoverageRequestSequence}`;
}

function getFreshCoverageRequestOptions(signal?: AbortSignal) {
  return {
    cache: 'no-store' as const,
    headers: {
      'Cache-Control': 'no-store',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only' as const,
    },
    ...(signal ? { signal } : {}),
  };
}

const canonicalSisAccreditationStatusUuids: ReadonlySet<string> = new Set([
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
]);

/**
 * Conceptos legacy de productos SIS que pueden aparecer como valor de
 * `insuranceType` en datos existentes. Al copiar a la visita se normalizan al
 * concepto SIS canónico (el plan/producto no es el financiador).
 */
export const LEGACY_SIS_PRODUCT_CONCEPT_UUIDS: ReadonlyArray<string> = [
  'b61a9ff9-1485-4388-9f67-9c341f847f85', // SIS Gratuito
  'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a', // SIS Semicontributivo
  'cc6958d9-7948-4f29-b244-4ff896c0b2ee', // SIS Emprendedor
  // El catalogo «Tipo de seguro» sigue exponiendo «Plan de atencion SIS» como
  // financiador de primer nivel y el registro de pacientes ya lo trata como SIS
  // (isPeruSisFinancer). Sin esta entrada, un paciente admitido con esa opcion
  // se leia como no-SIS en triaje y quedaba derivado a Caja pese a tener SIS.
  'b76a9a24-4905-4132-a215-8a567281852a', // Plan de atencion SIS
];

// ── Tipos REST ───────────────────────────────────────────────────────────────

/** Los valores coded pueden venir hidratados como objeto o como uuid plano. */
export type RestAttributeValue = string | { uuid?: string; display?: string } | null | undefined;

interface RestAttribute {
  uuid: string;
  value?: RestAttributeValue;
  attributeType?: {
    uuid?: string;
  };
}

interface PersonAttributesResponse {
  attributes?: Array<RestAttribute>;
}

interface VisitAttributesResponse {
  attributes?: Array<RestAttribute>;
}

export type SisFinancingState = 'active' | 'inactive' | 'pending' | 'notConsulted' | 'missing' | 'notApplicable';

export interface VisitInsurance {
  financiadorUuid: string | null;
  insuranceNumber: string | null;
  accreditationStatusUuid: string | null;
  accreditationCheckedAt: string | null;
}

interface PatientIdentifiersResponse {
  identifiers?: Array<{
    identifier?: string;
    identifierType?: {
      uuid?: string;
    };
    voided?: boolean;
  }>;
}

export interface PatientIdentifierReference {
  value: string;
  /** Ausente significa procedencia desconocida y se trata de forma conservadora. */
  identifierTypeUuid?: string | null;
}

export type PatientIdentifierInput = PatientIdentifierReference | string;

// ── Helpers de mapeo/normalización ───────────────────────────────────────────

/** Extrae el UUID de un valor coded que puede venir como objeto o string. */
export function getCodedValueUuid(value: RestAttributeValue): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  return value.uuid?.trim() || null;
}

/** Extrae el texto de un valor libre que puede venir como objeto o string. */
export function getTextValue(value: RestAttributeValue): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  return value.display?.trim() || null;
}

export interface NormalizeFinanciadorOptions {
  sisConceptUuid?: string;
  legacySisProductConceptUuids?: ReadonlyArray<string>;
  selfFinancedConceptUuids?: ReadonlyArray<string>;
}

/**
 * Normaliza el concepto de financiador: los productos SIS legacy (Gratuito,
 * Semicontributivo, Emprendedor) se colapsan al concepto SIS canónico.
 */
export function normalizeFinanciadorConceptUuid(
  conceptUuid: string | null,
  {
    sisConceptUuid = SIS_CONCEPT_UUID,
    legacySisProductConceptUuids = LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  }: NormalizeFinanciadorOptions = {},
): string | null {
  if (!conceptUuid) {
    return null;
  }
  return legacySisProductConceptUuids.includes(conceptUuid) ? sisConceptUuid : conceptUuid;
}

/**
 * Interpreta si una atención cuenta con cobertura SIS vigente. Los productos
 * SIS antiguos se normalizan al financiador SIS canónico antes de evaluar la
 * acreditación.
 */
export function getSisFinancingState({
  financiadorUuid,
  insuranceNumber,
  accreditationStatusUuid,
  accreditationCheckedAt,
}: VisitInsurance): SisFinancingState {
  const normalizedFinanciadorUuid = normalizeFinanciadorConceptUuid(financiadorUuid);
  if (!normalizedFinanciadorUuid) {
    return 'missing';
  }

  if (normalizedFinanciadorUuid !== SIS_CONCEPT_UUID) {
    return 'notApplicable';
  }

  if (accreditationStatusUuid === SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID) {
    return insuranceNumber && accreditationCheckedAt ? 'active' : 'missing';
  }

  switch (accreditationStatusUuid) {
    case SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID:
      return 'inactive';
    case SIS_ACCREDITATION_PENDING_CONCEPT_UUID:
      return 'pending';
    case SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID:
      return 'notConsulted';
    default:
      return 'missing';
  }
}

/**
 * El triaje requiere un financiador identificado. SIS debe estar vigente y
 * completo; una IAFAS no-SIS o el autofinanciamiento no requieren
 * acreditación SIS. Este criterio no se aplica al FUA, que conserva su barrera
 * exclusiva de SIS vigente.
 */
export function isTriageFinancingEligible(state: SisFinancingState | null | undefined): boolean {
  return state === 'active' || state === 'notApplicable';
}

// ── Lectura de la afiliación de la persona ───────────────────────────────────

export interface PersonInsuranceAttributeTypeUuids {
  insuranceTypeAttributeTypeUuid?: string;
  insuranceCodeAttributeTypeUuid?: string;
  accreditationStatusAttributeTypeUuid?: string;
  accreditationCheckedAtAttributeTypeUuid?: string;
  verificationMethodAttributeTypeUuid?: string;
}

export interface PersonInsurance {
  /** Concepto del tipo de seguro tal como está en la persona (sin normalizar). */
  insuranceTypeUuid: string | null;
  /** Código/número de afiliación (texto). */
  insuranceCode: string | null;
  /** Concepto del estado de acreditación. */
  accreditationStatusUuid: string | null;
  /** Fecha/hora (texto) de la última verificación de acreditación. */
  accreditationCheckedAt: string | null;
  /** Fuente controlada de la verificación de acreditación. */
  verificationMethod: string | null;
}

const EMPTY_PERSON_INSURANCE: PersonInsurance = {
  insuranceTypeUuid: null,
  insuranceCode: null,
  accreditationStatusUuid: null,
  accreditationCheckedAt: null,
  verificationMethod: null,
};

function findAttribute(attributes: Array<RestAttribute>, attributeTypeUuid: string): RestAttribute | undefined {
  return attributes.find((attribute) => attribute.attributeType?.uuid === attributeTypeUuid);
}

const personInsuranceRepresentation = 'custom:(attributes:(uuid,value,attributeType:(uuid)))';

function mapPersonInsurance(
  attributes: Array<RestAttribute>,
  {
    insuranceTypeAttributeTypeUuid = INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
    insuranceCodeAttributeTypeUuid = INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
    accreditationStatusAttributeTypeUuid = ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
    accreditationCheckedAtAttributeTypeUuid = ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
    verificationMethodAttributeTypeUuid = INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID,
  }: PersonInsuranceAttributeTypeUuids = {},
): PersonInsurance {
  return {
    insuranceTypeUuid: getCodedValueUuid(findAttribute(attributes, insuranceTypeAttributeTypeUuid)?.value),
    insuranceCode: getTextValue(findAttribute(attributes, insuranceCodeAttributeTypeUuid)?.value),
    accreditationStatusUuid: getCodedValueUuid(findAttribute(attributes, accreditationStatusAttributeTypeUuid)?.value),
    accreditationCheckedAt: getTextValue(findAttribute(attributes, accreditationCheckedAtAttributeTypeUuid)?.value),
    verificationMethod: getTextValue(findAttribute(attributes, verificationMethodAttributeTypeUuid)?.value),
  };
}

/**
 * Lee los person attributes de afiliación del paciente. Devuelve campos nulos
 * cuando la persona no tiene datos de seguro.
 */
export async function fetchPersonInsurance(
  patientUuid: string,
  attributeTypeUuids: PersonInsuranceAttributeTypeUuids = {},
): Promise<PersonInsurance> {
  if (!patientUuid?.trim()) {
    return EMPTY_PERSON_INSURANCE;
  }

  const { data } = await openmrsFetch<PersonAttributesResponse>(
    `${restBaseUrl}/person/${patientUuid}?v=${personInsuranceRepresentation}`,
  );
  return mapPersonInsurance(data?.attributes ?? [], attributeTypeUuids);
}

/** Lee la afiliación de persona sin permitir que el service worker satisfaga la verificación. */
export async function fetchFreshPersonInsurance(
  patientUuid: string,
  signal?: AbortSignal,
  attributeTypeUuids: PersonInsuranceAttributeTypeUuids = {},
): Promise<PersonInsurance> {
  if (!patientUuid?.trim()) {
    return EMPTY_PERSON_INSURANCE;
  }

  const searchParams = new URLSearchParams({
    v: personInsuranceRepresentation,
    _: getFreshCoverageRequestNonce(),
  });
  const { data } = await openmrsFetch<PersonAttributesResponse>(
    `${restBaseUrl}/person/${encodeURIComponent(patientUuid)}?${searchParams.toString()}`,
    getFreshCoverageRequestOptions(signal),
  );
  return mapPersonInsurance(data?.attributes ?? [], attributeTypeUuids);
}

/** Lee el financiador y la acreditación persistidos para una atención. */
export async function fetchVisitInsurance(
  visitUuid: string,
  {
    financiadorVisitAttributeTypeUuid = FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
    insuranceNumberVisitAttributeTypeUuid = INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationStatusVisitAttributeTypeUuid = SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationCheckedAtVisitAttributeTypeUuid = SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  }: FinanciadorVisitAttributeTypeUuids = {},
): Promise<VisitInsurance> {
  const { data } = await openmrsFetch<VisitAttributesResponse>(
    `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
  );
  const attributes = data?.attributes ?? [];

  return {
    financiadorUuid: getCodedValueUuid(findAttribute(attributes, financiadorVisitAttributeTypeUuid)?.value),
    insuranceNumber: getTextValue(findAttribute(attributes, insuranceNumberVisitAttributeTypeUuid)?.value),
    accreditationStatusUuid: getCodedValueUuid(
      findAttribute(attributes, accreditationStatusVisitAttributeTypeUuid)?.value,
    ),
    accreditationCheckedAt: getTextValue(
      findAttribute(attributes, accreditationCheckedAtVisitAttributeTypeUuid)?.value,
    ),
  };
}

/** Lee los identificadores vigentes con su tipo para validar su uso como afiliación. */
export async function fetchPatientIdentifiers(patientUuid: string): Promise<Array<PatientIdentifierReference>> {
  if (!patientUuid?.trim()) {
    return [];
  }

  const { data } = await openmrsFetch<PatientIdentifiersResponse>(
    `${restBaseUrl}/patient/${patientUuid}?v=custom:(identifiers:(identifier,identifierType:(uuid),voided))`,
  );
  return mapPatientIdentifiers(data?.identifiers ?? []);
}

function mapPatientIdentifiers(
  identifiers: NonNullable<PatientIdentifiersResponse['identifiers']>,
): Array<PatientIdentifierReference> {
  return identifiers
    .filter(({ voided }) => !voided)
    .map(({ identifier, identifierType }) => ({
      value: identifier?.trim() ?? '',
      identifierTypeUuid: identifierType?.uuid?.trim() || null,
    }))
    .filter(({ value }) => Boolean(value));
}

/** Lee identificadores tipados sin permitir una respuesta del cache offline. */
export async function fetchFreshPatientIdentifiers(
  patientUuid: string,
  signal?: AbortSignal,
): Promise<Array<PatientIdentifierReference>> {
  if (!patientUuid?.trim()) {
    return [];
  }

  const searchParams = new URLSearchParams({
    v: 'custom:(identifiers:(identifier,identifierType:(uuid),voided))',
    _: getFreshCoverageRequestNonce(),
  });
  const { data } = await openmrsFetch<PatientIdentifiersResponse>(
    `${restBaseUrl}/patient/${encodeURIComponent(patientUuid)}?${searchParams.toString()}`,
    getFreshCoverageRequestOptions(signal),
  );
  return mapPatientIdentifiers(data?.identifiers ?? []);
}

/** Compatibilidad; las decisiones de cobertura deben usar `fetchPatientIdentifiers`. */
export async function fetchPatientIdentifierValues(patientUuid: string): Promise<Array<string>> {
  return (await fetchPatientIdentifiers(patientUuid)).map(({ value }) => value);
}

// ── Upsert persona → visita ──────────────────────────────────────────────────

export interface FinanciadorVisitAttributeTypeUuids {
  financiadorVisitAttributeTypeUuid?: string;
  insuranceNumberVisitAttributeTypeUuid?: string;
  accreditationStatusVisitAttributeTypeUuid?: string;
  accreditationCheckedAtVisitAttributeTypeUuid?: string;
}

export interface CopyFinanciadorToVisitParams extends NormalizeFinanciadorOptions {
  patientUuid: string;
  visitUuid: string;
  personAttributeTypeUuids?: PersonInsuranceAttributeTypeUuids;
  visitAttributeTypeUuids?: FinanciadorVisitAttributeTypeUuids;
  /**
   * Rellena atributos compatibles ausentes y conserva el financiador elegido
   * manualmente. Los complementos sin financiador se eliminan como huérfanos.
   */
  onlyFillMissing?: boolean;
  /**
   * Identificadores conocidos con su tipo. Solo el tipo temporal SIS
   * configurado puede compartir un valor E-######## con la afiliación SIS.
   */
  patientIdentifiers?: ReadonlyArray<PatientIdentifierInput>;
  /**
   * Identificadores leídos de REST para este intento de persistencia. La
   * presencia de este campo, incluso como arreglo vacío, prueba que el caller
   * no está reutilizando el snapshot FHIR para decidir una afiliación E.
   */
  freshPatientIdentifiers?: ReadonlyArray<PatientIdentifierInput>;
  /**
   * Afiliación de persona leída para este intento. `null` representa una
   * lectura fallida y evita que el copier repita la consulta dentro del mismo
   * intento; `undefined` solicita una lectura nueva.
   */
  freshPersonInsurance?: PersonInsurance | null;
  /**
   * Compatibilidad con consumidores antiguos. Sin tipo, todos los valores
   * fallan cerrado y no habilitan la excepción SIS.
   * @deprecated Use `patientIdentifiers`.
   */
  patientIdentifierValues?: ReadonlyArray<string>;
  /** Tipo que identifica la afiliación temporal SIS E-########. */
  sisTemporaryAffiliationPatientIdentifierTypeUuid?: string;
}

export interface CopyFinanciadorToVisitResult {
  ok: true;
  /** true cuando no existe un financiador efectivo que copiar o conservar. */
  skipped: boolean;
  created: number;
  updated: number;
  reviewReason?:
    | 'missing-financiador'
    | 'incomplete-coverage'
    | 'sis-accreditation-conflict'
    | 'unknown-accreditation-status';
}

export type SafeCopyFinanciadorToVisitResult = CopyFinanciadorToVisitResult | { ok: false; error: unknown };

/** Compara el valor persistido (objeto coded, uuid plano o texto) con el deseado. */
function attributeValueEquals(persisted: RestAttributeValue, desired: string): boolean {
  if (persisted === null || persisted === undefined) {
    return false;
  }
  if (typeof persisted === 'string') {
    return persisted === desired;
  }
  return persisted.uuid === desired || (!persisted.uuid && persisted.display === desired);
}

function normalizeDocumentValue(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function toPatientIdentifierReference(identifier: PatientIdentifierInput): PatientIdentifierReference {
  return typeof identifier === 'string'
    ? { value: identifier, identifierTypeUuid: null }
    : {
        value: identifier.value,
        identifierTypeUuid: identifier.identifierTypeUuid?.trim() || null,
      };
}

export function normalizeTemporarySisAffiliationCode(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLocaleUpperCase() ?? '';
  return /^E-\d{8}$/.test(normalizedValue) ? normalizedValue : null;
}

export function isTemporarySisAffiliationCode(value: string | null | undefined): boolean {
  return Boolean(normalizeTemporarySisAffiliationCode(value));
}

/** Detecta la intención de un código temporal E, aunque su forma o longitud sea inválida. */
export function isTemporarySisAffiliationLikeCode(value: string | null | undefined): boolean {
  return /^E(?:[-\s]?\d)/.test(value?.trim().toLocaleUpperCase() ?? '');
}

/** Exige fecha, hora, segundos y zona explícita; una fecha civil no acredita. */
export function isValidInsuranceVerificationIsoDateTime(value: string | null | undefined): boolean {
  const normalizedValue = value?.trim() ?? '';
  const match = isoDateTimePattern.exec(normalizedValue);
  if (!match || Number.isNaN(Date.parse(normalizedValue))) {
    return false;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, millisecondValue = '0'] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const millisecond = Number(millisecondValue.padEnd(3, '0'));
  const localParts = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

  return (
    localParts.getUTCFullYear() === year &&
    localParts.getUTCMonth() === month - 1 &&
    localParts.getUTCDate() === day &&
    localParts.getUTCHours() === hour &&
    localParts.getUTCMinutes() === minute &&
    localParts.getUTCSeconds() === second &&
    localParts.getUTCMilliseconds() === millisecond
  );
}

export function hasTrustedSisVerificationEvidence(
  accreditationCheckedAt: string | null | undefined,
  verificationMethod: string | null | undefined,
): boolean {
  return (
    isValidInsuranceVerificationIsoDateTime(accreditationCheckedAt) &&
    trustedSisVerificationMethods.has(verificationMethod?.trim() ?? '')
  );
}

/** Contrato mínimo de persona para convertir un E temporal en cobertura activa. */
export function hasTrustedTemporarySisCoverageEvidence(
  {
    insuranceTypeUuid,
    insuranceCode,
    accreditationStatusUuid,
    accreditationCheckedAt,
    verificationMethod,
  }: PersonInsurance,
  sisConceptUuid = SIS_CONCEPT_UUID,
): boolean {
  return Boolean(
    normalizeFinanciadorConceptUuid(insuranceTypeUuid, { sisConceptUuid }) === sisConceptUuid &&
      normalizeTemporarySisAffiliationCode(insuranceCode) &&
      accreditationStatusUuid === SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID &&
      hasTrustedSisVerificationEvidence(accreditationCheckedAt, verificationMethod),
  );
}

/**
 * Permite un match únicamente si todos los identificadores coincidentes son
 * E-######## del tipo temporal configurado y el financiador efectivo es SIS.
 * Toda intención de código E exige forma canónica y al menos un match;
 * FHIR/REST vacío, identificadores sin tipo o duplicados bajo otro tipo fallan
 * cerrado.
 */
export function isInsuranceCodeAllowed(
  value: string | null | undefined,
  financiadorUuid: string | null | undefined,
  patientIdentifiers: ReadonlyArray<PatientIdentifierInput> = [],
  sisTemporaryAffiliationPatientIdentifierTypeUuid = SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
  sisConceptUuid = SIS_CONCEPT_UUID,
): boolean {
  if (!value) {
    return true;
  }

  const normalizedValue = normalizeDocumentValue(value);
  const matchingIdentifiers = patientIdentifiers
    .map(toPatientIdentifierReference)
    .filter(({ value: identifierValue }) => normalizeDocumentValue(identifierValue) === normalizedValue);
  const isTemporarySisAffiliationLike = isTemporarySisAffiliationLikeCode(value);

  if (matchingIdentifiers.length === 0) {
    return !isTemporarySisAffiliationLike;
  }

  const normalizedFinanciador = normalizeFinanciadorConceptUuid(financiadorUuid ?? null, { sisConceptUuid });
  const configuredTypeUuid = sisTemporaryAffiliationPatientIdentifierTypeUuid.trim();
  const canonicalTemporaryCode = normalizeTemporarySisAffiliationCode(value);
  return Boolean(
    normalizedFinanciador === sisConceptUuid &&
      configuredTypeUuid &&
      canonicalTemporaryCode &&
      matchingIdentifiers.every(
        ({ value: identifierValue, identifierTypeUuid }) =>
          identifierTypeUuid === configuredTypeUuid &&
          normalizeTemporarySisAffiliationCode(identifierValue) === canonicalTemporaryCode,
      ),
  );
}

/**
 * Copia el financiador desde la afiliación de la persona a los visit
 * attributes de la visita (Financiador, Número de Seguro, Estado y Fecha de
 * Acreditación SIS).
 *
 * - Idempotente: lee los atributos existentes de la visita y solo escribe
 *   cuando el valor cambió (crea si falta, actualiza si difiere).
 * - Devuelve `reviewReason` cuando falta el financiador, la cobertura queda
 *   incompleta, la acreditación SIS contradice la afiliación o su estado no
 *   pertenece al catálogo canónico; la UI debe hacerlo visible.
 * - Normaliza los productos SIS legacy al concepto SIS canónico para el
 *   atributo Financiador.
 * - Autofinanciamiento copia únicamente el financiador. Otras IAFAS conservan
 *   su número de póliza, pero no reciben estado/fecha SIS.
 * - Con `onlyFillMissing`, el financiador efectivo de la visita gana. Si difiere
 *   de la afiliación de la persona, no se mezclan sus datos complementarios;
 *   si no existe financiador, primero se eliminan los complementos huérfanos.
 * - Un identificador documental del paciente nunca se copia como afiliación.
 *   Solo E-######## del tipo temporal SIS configurado puede coincidir, y
 *   únicamente cuando el financiador efectivo es SIS y la persona conserva
 *   acreditación activa con fecha ISO completa y método de verificación
 *   controlado. El método aún no se transporta al snapshot de visita.
 *
 * Lanza en caso de error de red/servidor; los flujos de UI deben usar
 * {@link safeCopyFinanciadorToVisit}, que nunca lanza.
 */
export async function copyFinanciadorToVisit({
  patientUuid,
  visitUuid,
  personAttributeTypeUuids,
  visitAttributeTypeUuids,
  sisConceptUuid,
  legacySisProductConceptUuids,
  selfFinancedConceptUuids = [SELF_FINANCED_CONCEPT_UUID],
  onlyFillMissing = false,
  patientIdentifiers,
  freshPatientIdentifiers,
  freshPersonInsurance,
  patientIdentifierValues,
  sisTemporaryAffiliationPatientIdentifierTypeUuid = SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
}: CopyFinanciadorToVisitParams): Promise<CopyFinanciadorToVisitResult> {
  const {
    financiadorVisitAttributeTypeUuid = FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
    insuranceNumberVisitAttributeTypeUuid = INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationStatusVisitAttributeTypeUuid = SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationCheckedAtVisitAttributeTypeUuid = SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  } = visitAttributeTypeUuids ?? {};

  const personInsurance =
    freshPersonInsurance === undefined
      ? await fetchFreshPersonInsurance(patientUuid, undefined, personAttributeTypeUuids)
      : (freshPersonInsurance ?? EMPTY_PERSON_INSURANCE);
  const personFinanciador = normalizeFinanciadorConceptUuid(personInsurance.insuranceTypeUuid, {
    sisConceptUuid,
    legacySisProductConceptUuids,
  });
  const personIsSelfFinanced = Boolean(personFinanciador && selfFinancedConceptUuids.includes(personFinanciador));
  const personHasTemporarySisAffiliationCode = isTemporarySisAffiliationCode(personInsurance.insuranceCode);
  const resolvedPatientIdentifiers =
    personFinanciador && personInsurance.insuranceCode && !personIsSelfFinanced
      ? personHasTemporarySisAffiliationCode
        ? (freshPatientIdentifiers ?? (await fetchFreshPatientIdentifiers(patientUuid)))
        : patientIdentifiers?.length
          ? patientIdentifiers
          : patientIdentifierValues?.length
            ? patientIdentifierValues
            : await fetchFreshPatientIdentifiers(patientUuid)
      : [];
  const safeInsuranceCode = personIsSelfFinanced
    ? null
    : isInsuranceCodeAllowed(
          personInsurance.insuranceCode,
          personFinanciador,
          resolvedPatientIdentifiers,
          sisTemporaryAffiliationPatientIdentifierTypeUuid,
          sisConceptUuid,
        ) &&
        (!personHasTemporarySisAffiliationCode ||
          hasTrustedTemporarySisCoverageEvidence(personInsurance, sisConceptUuid))
      ? personInsurance.insuranceCode
      : null;

  const { data } = await openmrsFetch<VisitAttributesResponse>(
    `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
  );
  const existingAttributes = data?.attributes ?? [];
  const existingFinanciador = normalizeFinanciadorConceptUuid(
    getCodedValueUuid(findAttribute(existingAttributes, financiadorVisitAttributeTypeUuid)?.value),
    { sisConceptUuid, legacySisProductConceptUuids },
  );
  const complementAttributeTypeUuids = [
    insuranceNumberVisitAttributeTypeUuid,
    accreditationStatusVisitAttributeTypeUuid,
    accreditationCheckedAtVisitAttributeTypeUuid,
  ];
  // A complement without a persisted payer has no trustworthy owner. If a
  // payer is now copied from the person, remove those orphan values before
  // writing the new bundle; otherwise `onlyFillMissing` could silently relabel
  // an old SIS number as EsSalud (or vice versa).
  const orphanedComplementAttributeTypeUuids = new Set(
    !existingFinanciador && personFinanciador
      ? complementAttributeTypeUuids.filter((attributeTypeUuid) =>
          Boolean(findAttribute(existingAttributes, attributeTypeUuid)),
        )
      : [],
  );
  const preserveExistingVisitSnapshot = Boolean(!personFinanciador && existingFinanciador);
  const effectiveFinanciador =
    onlyFillMissing && existingFinanciador ? existingFinanciador : (personFinanciador ?? existingFinanciador);
  const complementsMatchEffectiveFinanciador = Boolean(personFinanciador) && effectiveFinanciador === personFinanciador;
  const resolvedSisConceptUuid = sisConceptUuid ?? SIS_CONCEPT_UUID;
  const isSis = effectiveFinanciador === resolvedSisConceptUuid;
  const isSelfFinanced = Boolean(effectiveFinanciador && selfFinancedConceptUuids.includes(effectiveFinanciador));
  const existingAccreditationStatus = getCodedValueUuid(
    findAttribute(existingAttributes, accreditationStatusVisitAttributeTypeUuid)?.value,
  );
  const existingAccreditationCheckedAt = getTextValue(
    findAttribute(existingAttributes, accreditationCheckedAtVisitAttributeTypeUuid)?.value,
  );
  const accreditationStatusConflicts = Boolean(
    onlyFillMissing &&
      existingFinanciador &&
      isSis &&
      existingAccreditationStatus &&
      personInsurance.accreditationStatusUuid &&
      existingAccreditationStatus !== personInsurance.accreditationStatusUuid,
  );
  const orphanAccreditationDateConflicts = Boolean(
    onlyFillMissing &&
      existingFinanciador &&
      isSis &&
      !existingAccreditationStatus &&
      existingAccreditationCheckedAt &&
      existingAccreditationCheckedAt !== personInsurance.accreditationCheckedAt,
  );
  const accreditationBundleConflicts = accreditationStatusConflicts || orphanAccreditationDateConflicts;
  const shouldCopySisAccreditation = complementsMatchEffectiveFinanciador && isSis && !accreditationBundleConflicts;
  const desiredAttributes = [
    {
      attributeTypeUuid: financiadorVisitAttributeTypeUuid,
      value: personFinanciador,
    },
    {
      attributeTypeUuid: insuranceNumberVisitAttributeTypeUuid,
      value: complementsMatchEffectiveFinanciador && !isSelfFinanced ? safeInsuranceCode : null,
    },
    {
      attributeTypeUuid: accreditationCheckedAtVisitAttributeTypeUuid,
      value:
        shouldCopySisAccreditation && personInsurance.accreditationStatusUuid
          ? personInsurance.accreditationCheckedAt
          : null,
    },
    {
      // El estado se escribe al final: si una escritura previa falla, la lista
      // de acreditaciones pendientes todavía puede detectar la visita.
      attributeTypeUuid: accreditationStatusVisitAttributeTypeUuid,
      value: shouldCopySisAccreditation ? personInsurance.accreditationStatusUuid : null,
    },
  ].filter((attribute): attribute is { attributeTypeUuid: string; value: string } => Boolean(attribute.value));
  const desiredAttributeTypes = new Set(desiredAttributes.map(({ attributeTypeUuid }) => attributeTypeUuid));
  const preserveCompatibleVisitComplements = onlyFillMissing || preserveExistingVisitSnapshot;
  const attributesToRemove = (
    preserveCompatibleVisitComplements
      ? [
          ...(!effectiveFinanciador || isSelfFinanced ? [insuranceNumberVisitAttributeTypeUuid] : []),
          ...(!isSis ? [accreditationStatusVisitAttributeTypeUuid, accreditationCheckedAtVisitAttributeTypeUuid] : []),
        ]
      : [
          insuranceNumberVisitAttributeTypeUuid,
          accreditationStatusVisitAttributeTypeUuid,
          accreditationCheckedAtVisitAttributeTypeUuid,
        ].filter((attributeTypeUuid) => !desiredAttributeTypes.has(attributeTypeUuid))
  ).filter(
    (attributeTypeUuid) =>
      !orphanedComplementAttributeTypeUuids.has(attributeTypeUuid) &&
      Boolean(findAttribute(existingAttributes, attributeTypeUuid)),
  );

  const getResultingValue = (attributeTypeUuid: string): RestAttributeValue => {
    if (orphanedComplementAttributeTypeUuids.has(attributeTypeUuid)) {
      return desiredAttributes.find((attribute) => attribute.attributeTypeUuid === attributeTypeUuid)?.value ?? null;
    }

    if (attributesToRemove.includes(attributeTypeUuid)) {
      return null;
    }

    const desired = desiredAttributes.find((attribute) => attribute.attributeTypeUuid === attributeTypeUuid);
    const existing = findAttribute(existingAttributes, attributeTypeUuid);
    if (desired && (!existing || !onlyFillMissing)) {
      return desired.value;
    }
    return existing?.value;
  };
  const resultingInsuranceNumber = getTextValue(getResultingValue(insuranceNumberVisitAttributeTypeUuid));
  const resultingAccreditationStatus = getCodedValueUuid(getResultingValue(accreditationStatusVisitAttributeTypeUuid));
  const resultingAccreditationCheckedAt = getTextValue(getResultingValue(accreditationCheckedAtVisitAttributeTypeUuid));
  const coverageIsIncomplete = Boolean(
    effectiveFinanciador &&
      !isSelfFinanced &&
      (!resultingInsuranceNumber || (isSis && (!resultingAccreditationStatus || !resultingAccreditationCheckedAt))),
  );
  const hasUnknownSisAccreditationStatus = Boolean(
    isSis && resultingAccreditationStatus && !canonicalSisAccreditationStatusUuids.has(resultingAccreditationStatus),
  );
  const reviewReason: CopyFinanciadorToVisitResult['reviewReason'] = accreditationBundleConflicts
    ? 'sis-accreditation-conflict'
    : !effectiveFinanciador
      ? 'missing-financiador'
      : coverageIsIncomplete
        ? 'incomplete-coverage'
        : hasUnknownSisAccreditationStatus
          ? 'unknown-accreditation-status'
          : undefined;

  if (desiredAttributes.length === 0 && attributesToRemove.length === 0) {
    return {
      ok: true,
      skipped: !effectiveFinanciador,
      created: 0,
      updated: 0,
      ...(reviewReason ? { reviewReason } : {}),
    };
  }

  let created = 0;
  let updated = 0;

  const deleteAttribute = async (existing: RestAttribute | undefined) => {
    if (existing) {
      await openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute/${existing.uuid}`, {
        method: 'DELETE',
      });
      updated += 1;
    }
  };

  const upsertAttribute = async (
    { attributeTypeUuid, value }: { attributeTypeUuid: string; value: string },
    existing?: RestAttribute,
  ) => {
    if (!existing) {
      await openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { attributeType: attributeTypeUuid, value },
      });
      created += 1;
    } else if (!attributeValueEquals(existing.value, value)) {
      await openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute/${existing.uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { value },
      });
      updated += 1;
    }
  };

  if (onlyFillMissing) {
    // Orphans are deleted before the payer is written. This ordering keeps the
    // operation retry-safe: a failure cannot leave a newly assigned payer beside
    // complements whose provenance is unknown.
    for (const attributeTypeUuid of orphanedComplementAttributeTypeUuids) {
      await deleteAttribute(findAttribute(existingAttributes, attributeTypeUuid));
    }

    for (const desiredAttribute of desiredAttributes) {
      const existing = orphanedComplementAttributeTypeUuids.has(desiredAttribute.attributeTypeUuid)
        ? undefined
        : findAttribute(existingAttributes, desiredAttribute.attributeTypeUuid);

      if (!existing) {
        await upsertAttribute(desiredAttribute);
      }
    }

    for (const attributeTypeUuid of attributesToRemove) {
      await deleteAttribute(findAttribute(existingAttributes, attributeTypeUuid));
    }
  } else {
    const existingPayerAttribute = findAttribute(existingAttributes, financiadorVisitAttributeTypeUuid);
    const existingStatusAttribute = findAttribute(existingAttributes, accreditationStatusVisitAttributeTypeUuid);
    const desiredPayerAttribute = desiredAttributes.find(
      ({ attributeTypeUuid }) => attributeTypeUuid === financiadorVisitAttributeTypeUuid,
    );
    const desiredStatusAttribute = desiredAttributes.find(
      ({ attributeTypeUuid }) => attributeTypeUuid === accreditationStatusVisitAttributeTypeUuid,
    );
    const desiredComplementAttributes = desiredAttributes.filter(
      ({ attributeTypeUuid }) =>
        attributeTypeUuid !== financiadorVisitAttributeTypeUuid &&
        attributeTypeUuid !== accreditationStatusVisitAttributeTypeUuid,
    );
    const payerIsChanging = Boolean(desiredPayerAttribute && existingFinanciador !== desiredPayerAttribute.value);
    const payerBecomesSis = Boolean(payerIsChanging && desiredPayerAttribute?.value === resolvedSisConceptUuid);

    if (payerIsChanging) {
      // The SIS status is the commit marker for the former accreditation, so
      // invalidate it before changing the bundle. Payer order then depends on
      // direction: preserve the complete non-SIS bundle until SIS is committed,
      // or keep the old SIS payer as a worklist marker while leaving SIS.
      await deleteAttribute(existingStatusAttribute);
      // Commit transitions into SIS before deleting the former non-SIS
      // complements. If the payer write itself fails, the original bundle is
      // still intact; after it succeeds, every later failure is discoverable
      // as SIS + missing status.
      if (payerBecomesSis && desiredPayerAttribute) {
        await upsertAttribute(desiredPayerAttribute, existingPayerAttribute);
      }
      for (const attributeTypeUuid of complementAttributeTypeUuids) {
        if (attributeTypeUuid !== accreditationStatusVisitAttributeTypeUuid) {
          await deleteAttribute(findAttribute(existingAttributes, attributeTypeUuid));
        }
      }

      // Entering SIS is asymmetric: commit the SIS payer before its
      // complements so a later failure remains discoverable as SIS + missing
      // status. When leaving SIS, keep the former payer until cleanup and
      // complement staging finish, preserving the old SIS retry marker.
      for (const desiredAttribute of desiredComplementAttributes) {
        await upsertAttribute(desiredAttribute);
      }
      if (!payerBecomesSis && desiredPayerAttribute) {
        await upsertAttribute(desiredPayerAttribute, existingPayerAttribute);
      }
      if (desiredStatusAttribute) {
        await upsertAttribute(desiredStatusAttribute);
      }
    } else {
      const desiredAttributesByType = new Map(
        desiredAttributes.map((attribute) => [attribute.attributeTypeUuid, attribute]),
      );
      const attributeWillChange = (attributeTypeUuid: string) => {
        const desired = desiredAttributesByType.get(attributeTypeUuid);
        const existing = findAttribute(existingAttributes, attributeTypeUuid);
        if (desired) {
          return !existing || !attributeValueEquals(existing.value, desired.value);
        }
        return attributesToRemove.includes(attributeTypeUuid) && Boolean(existing);
      };
      const sisAccreditationWillChange = Boolean(
        isSis &&
          existingStatusAttribute &&
          [
            insuranceNumberVisitAttributeTypeUuid,
            accreditationCheckedAtVisitAttributeTypeUuid,
            accreditationStatusVisitAttributeTypeUuid,
          ].some(attributeWillChange),
      );
      const statusMustBeRemovedFirst = Boolean(
        existingStatusAttribute &&
          (sisAccreditationWillChange || attributesToRemove.includes(accreditationStatusVisitAttributeTypeUuid)),
      );

      // The prior status is a commit marker for its number/date pair. Invalidate
      // it before changing any member, then recreate it only after every prior
      // write succeeds.
      if (statusMustBeRemovedFirst) {
        await deleteAttribute(existingStatusAttribute);
      }
      for (const attributeTypeUuid of attributesToRemove) {
        if (attributeTypeUuid !== accreditationStatusVisitAttributeTypeUuid) {
          await deleteAttribute(findAttribute(existingAttributes, attributeTypeUuid));
        }
      }
      for (const desiredAttribute of desiredComplementAttributes) {
        await upsertAttribute(desiredAttribute, findAttribute(existingAttributes, desiredAttribute.attributeTypeUuid));
      }
      if (desiredPayerAttribute) {
        await upsertAttribute(desiredPayerAttribute, existingPayerAttribute);
      }
      if (desiredStatusAttribute) {
        await upsertAttribute(desiredStatusAttribute, statusMustBeRemovedFirst ? undefined : existingStatusAttribute);
      }
    }
  }

  return {
    ok: true,
    skipped: !effectiveFinanciador,
    created,
    updated,
    ...(reviewReason ? { reviewReason } : {}),
  };
}

/**
 * Variante que nunca lanza, para flujos que no deben bloquearse por la copia
 * del financiador (p. ej. el encolado de emergencia — Ley 27604). Devuelve
 * `{ ok: false, error }` y registra el error en consola.
 */
export async function safeCopyFinanciadorToVisit(
  params: CopyFinanciadorToVisitParams,
): Promise<SafeCopyFinanciadorToVisitResult> {
  try {
    return await copyFinanciadorToVisit(params);
  } catch (error) {
    console.error('No se pudo copiar el financiador de la persona a la visita.', error);
    return { ok: false, error };
  }
}
