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
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

// ── Person attribute types (afiliación de la persona) ───────────────────────
export const INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID = '56188294-b42c-481d-a987-4b495116c580';
export const INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID = '374b130f-7457-476f-87b1-f182aa77c434';
export const ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db1005';
export const ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db1006';

// ── Visit attribute types (financiador de ESTA atención) ────────────────────
export const FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID = '3a988e33-a6c0-4b76-b924-01abb998944b';
export const INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID = 'aac48226-d143-4274-80e0-264db4e368ee';
export const SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID = '5e13e902-2030-4f65-b9d5-9a4810c9a603';

// ── Catálogo canónico «Tipo de seguro» ───────────────────────────────────────
export const INSURANCE_TYPE_CONCEPT_SET_UUID = '6b932638-242e-49ef-8ba7-0ae87199835c';
export const SIS_CONCEPT_UUID = '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c';

/**
 * Conceptos legacy de productos SIS que pueden aparecer como valor de
 * `insuranceType` en datos existentes. Al copiar a la visita se normalizan al
 * concepto SIS canónico (el plan/producto no es el financiador).
 */
export const LEGACY_SIS_PRODUCT_CONCEPT_UUIDS: ReadonlyArray<string> = [
  'b61a9ff9-1485-4388-9f67-9c341f847f85', // SIS Gratuito
  'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a', // SIS Semicontributivo
  'cc6958d9-7948-4f29-b244-4ff896c0b2ee', // SIS Emprendedor
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

// ── Lectura de la afiliación de la persona ───────────────────────────────────

export interface PersonInsuranceAttributeTypeUuids {
  insuranceTypeAttributeTypeUuid?: string;
  insuranceCodeAttributeTypeUuid?: string;
  accreditationStatusAttributeTypeUuid?: string;
  accreditationCheckedAtAttributeTypeUuid?: string;
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
}

const EMPTY_PERSON_INSURANCE: PersonInsurance = {
  insuranceTypeUuid: null,
  insuranceCode: null,
  accreditationStatusUuid: null,
  accreditationCheckedAt: null,
};

function findAttribute(attributes: Array<RestAttribute>, attributeTypeUuid: string): RestAttribute | undefined {
  return attributes.find((attribute) => attribute.attributeType?.uuid === attributeTypeUuid);
}

/**
 * Lee los person attributes de afiliación del paciente. Devuelve campos nulos
 * cuando la persona no tiene datos de seguro.
 */
export async function fetchPersonInsurance(
  patientUuid: string,
  {
    insuranceTypeAttributeTypeUuid = INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
    insuranceCodeAttributeTypeUuid = INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
    accreditationStatusAttributeTypeUuid = ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
    accreditationCheckedAtAttributeTypeUuid = ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
  }: PersonInsuranceAttributeTypeUuids = {},
): Promise<PersonInsurance> {
  if (!patientUuid?.trim()) {
    return EMPTY_PERSON_INSURANCE;
  }

  const { data } = await openmrsFetch<PersonAttributesResponse>(
    `${restBaseUrl}/person/${patientUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
  );
  const attributes = data?.attributes ?? [];

  return {
    insuranceTypeUuid: getCodedValueUuid(findAttribute(attributes, insuranceTypeAttributeTypeUuid)?.value),
    insuranceCode: getTextValue(findAttribute(attributes, insuranceCodeAttributeTypeUuid)?.value),
    accreditationStatusUuid: getCodedValueUuid(findAttribute(attributes, accreditationStatusAttributeTypeUuid)?.value),
    accreditationCheckedAt: getTextValue(findAttribute(attributes, accreditationCheckedAtAttributeTypeUuid)?.value),
  };
}

// ── Upsert persona → visita ──────────────────────────────────────────────────

export interface FinanciadorVisitAttributeTypeUuids {
  financiadorVisitAttributeTypeUuid?: string;
  insuranceNumberVisitAttributeTypeUuid?: string;
  accreditationStatusVisitAttributeTypeUuid?: string;
}

export interface CopyFinanciadorToVisitParams extends NormalizeFinanciadorOptions {
  patientUuid: string;
  visitUuid: string;
  personAttributeTypeUuids?: PersonInsuranceAttributeTypeUuids;
  visitAttributeTypeUuids?: FinanciadorVisitAttributeTypeUuids;
}

export interface CopyFinanciadorToVisitResult {
  ok: true;
  /** true cuando la persona no tenía datos de seguro y no se escribió nada. */
  skipped: boolean;
  created: number;
  updated: number;
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

/**
 * Copia el financiador desde la afiliación de la persona a los visit
 * attributes de la visita (Financiador, Número de Seguro, Estado de
 * Acreditación SIS).
 *
 * - Idempotente: lee los atributos existentes de la visita y solo escribe
 *   cuando el valor cambió (crea si falta, actualiza si difiere).
 * - Se salta silenciosamente cuando la persona no tiene datos de seguro.
 * - Normaliza los productos SIS legacy al concepto SIS canónico para el
 *   atributo Financiador.
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
}: CopyFinanciadorToVisitParams): Promise<CopyFinanciadorToVisitResult> {
  const {
    financiadorVisitAttributeTypeUuid = FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
    insuranceNumberVisitAttributeTypeUuid = INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationStatusVisitAttributeTypeUuid = SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  } = visitAttributeTypeUuids ?? {};

  const personInsurance = await fetchPersonInsurance(patientUuid, personAttributeTypeUuids);

  const desiredAttributes = [
    {
      attributeTypeUuid: financiadorVisitAttributeTypeUuid,
      value: normalizeFinanciadorConceptUuid(personInsurance.insuranceTypeUuid, {
        sisConceptUuid,
        legacySisProductConceptUuids,
      }),
    },
    {
      attributeTypeUuid: insuranceNumberVisitAttributeTypeUuid,
      value: personInsurance.insuranceCode,
    },
    {
      attributeTypeUuid: accreditationStatusVisitAttributeTypeUuid,
      value: personInsurance.accreditationStatusUuid,
    },
  ].filter((attribute): attribute is { attributeTypeUuid: string; value: string } => Boolean(attribute.value));

  if (desiredAttributes.length === 0) {
    return { ok: true, skipped: true, created: 0, updated: 0 };
  }

  const { data } = await openmrsFetch<VisitAttributesResponse>(
    `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
  );
  const existingAttributes = data?.attributes ?? [];

  let created = 0;
  let updated = 0;

  for (const { attributeTypeUuid, value } of desiredAttributes) {
    const existing = findAttribute(existingAttributes, attributeTypeUuid);

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
  }

  return { ok: true, skipped: false, created, updated };
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
    console.error(
      `No se pudo copiar el financiador de la persona ${params.patientUuid} a la visita ${params.visitUuid}.`,
      error,
    );
    return { ok: false, error };
  }
}
