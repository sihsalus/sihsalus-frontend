const conceptUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const peruDniPattern = /^\d{8}$/;

export interface NationalityAttribute {
  attributeType: string;
  value: string;
}

interface BuildNationalityAttributeOptions {
  allowedConceptUuids?: ReadonlySet<string>;
  attributeTypeUuid: string;
  isUnknown: boolean;
  nationality?: string;
}

interface GetAutomaticNationalityUpdateOptions {
  currentNationality?: string;
  hasCompletedDni: boolean;
  isUnknown: boolean;
  peruConceptUuid: string;
  wasAutoAssigned: boolean;
}

export interface AutomaticNationalityUpdate {
  nationality: string;
  shouldUpdate: boolean;
  wasAutoAssigned: boolean;
}

export function isNationalityConceptUuid(value: unknown): value is string {
  return typeof value === 'string' && conceptUuidPattern.test(value);
}

export function isCompletedPeruDni(value: unknown): value is string {
  return typeof value === 'string' && peruDniPattern.test(value.trim());
}

export function getAutomaticNationalityUpdate({
  currentNationality = '',
  hasCompletedDni,
  isUnknown,
  peruConceptUuid,
  wasAutoAssigned,
}: GetAutomaticNationalityUpdateOptions): AutomaticNationalityUpdate {
  if (isUnknown) {
    return {
      nationality: '',
      shouldUpdate: Boolean(currentNationality),
      wasAutoAssigned: false,
    };
  }

  if (hasCompletedDni) {
    if (currentNationality) {
      return {
        nationality: currentNationality,
        shouldUpdate: false,
        wasAutoAssigned: currentNationality === peruConceptUuid && wasAutoAssigned,
      };
    }

    return { nationality: peruConceptUuid, shouldUpdate: true, wasAutoAssigned: true };
  }

  if (wasAutoAssigned && currentNationality === peruConceptUuid) {
    return { nationality: '', shouldUpdate: true, wasAutoAssigned: false };
  }

  return { nationality: currentNationality, shouldUpdate: false, wasAutoAssigned: false };
}

export function buildNationalityAttribute({
  allowedConceptUuids,
  attributeTypeUuid,
  isUnknown,
  nationality,
}: BuildNationalityAttributeOptions): NationalityAttribute | null {
  const normalizedNationality = nationality?.trim();

  if (isUnknown || !normalizedNationality) {
    return null;
  }

  if (!isNationalityConceptUuid(normalizedNationality)) {
    throw new Error('La nacionalidad seleccionada no es un concepto válido de OpenMRS.');
  }

  if (allowedConceptUuids && !allowedConceptUuids.has(normalizedNationality)) {
    throw new Error('La nacionalidad seleccionada no pertenece al catálogo configurado.');
  }

  return {
    attributeType: attributeTypeUuid,
    value: normalizedNationality,
  };
}
