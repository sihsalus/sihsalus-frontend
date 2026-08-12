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
export const SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID = 'e3a66f60-4abe-4948-b323-7c4935d8eb8a';

// ── Catálogo canónico «Tipo de seguro» ───────────────────────────────────────
export const INSURANCE_TYPE_CONCEPT_SET_UUID = '6b932638-242e-49ef-8ba7-0ae87199835c';
export const SIS_CONCEPT_UUID = '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c';
export const SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
export const SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';
export const SIS_ACCREDITATION_PENDING_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2053';
export const SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID = '9b3df0a1-0c58-4f55-9868-9c38f1db2054';
export const SELF_FINANCED_CONCEPT_UUID = 'cc72568e-d0d9-46a8-a618-91f0d679f518';

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
    voided?: boolean;
  }>;
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
  if (normalizeFinanciadorConceptUuid(financiadorUuid) !== SIS_CONCEPT_UUID) {
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

/** Lee los documentos vigentes del paciente para impedir que se usen como afiliación. */
export async function fetchPatientIdentifierValues(patientUuid: string): Promise<Array<string>> {
  if (!patientUuid?.trim()) {
    return [];
  }

  const { data } = await openmrsFetch<PatientIdentifiersResponse>(
    `${restBaseUrl}/patient/${patientUuid}?v=custom:(identifiers:(identifier,voided))`,
  );
  return (data?.identifiers ?? [])
    .filter(({ voided }) => !voided)
    .map(({ identifier }) => identifier?.trim() ?? '')
    .filter(Boolean);
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
   * Identificadores documentales conocidos del paciente (DNI, CE, pasaporte,
   * etc.). Ninguno de ellos puede usarse como número de afiliación.
   */
  patientIdentifierValues?: ReadonlyArray<string>;
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

function isPatientIdentifier(value: string | null, patientIdentifierValues: ReadonlyArray<string>): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = normalizeDocumentValue(value);
  return patientIdentifierValues.some((identifier) => normalizeDocumentValue(identifier) === normalizedValue);
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
  patientIdentifierValues,
}: CopyFinanciadorToVisitParams): Promise<CopyFinanciadorToVisitResult> {
  const {
    financiadorVisitAttributeTypeUuid = FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
    insuranceNumberVisitAttributeTypeUuid = INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationStatusVisitAttributeTypeUuid = SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
    accreditationCheckedAtVisitAttributeTypeUuid = SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  } = visitAttributeTypeUuids ?? {};

  const personInsurance = await fetchPersonInsurance(patientUuid, personAttributeTypeUuids);
  const personFinanciador = normalizeFinanciadorConceptUuid(personInsurance.insuranceTypeUuid, {
    sisConceptUuid,
    legacySisProductConceptUuids,
  });
  const personIsSelfFinanced = Boolean(personFinanciador && selfFinancedConceptUuids.includes(personFinanciador));
  const resolvedPatientIdentifierValues =
    personFinanciador && personInsurance.insuranceCode && !personIsSelfFinanced
      ? patientIdentifierValues?.length
        ? patientIdentifierValues
        : await fetchPatientIdentifierValues(patientUuid)
      : [];
  const safeInsuranceCode = personIsSelfFinanced
    ? null
    : isPatientIdentifier(personInsurance.insuranceCode, resolvedPatientIdentifierValues)
      ? null
      : personInsurance.insuranceCode;

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
    console.error(
      `No se pudo copiar el financiador de la persona ${params.patientUuid} a la visita ${params.visitUuid}.`,
      error,
    );
    return { ok: false, error };
  }
}
