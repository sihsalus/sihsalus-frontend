import type { SearchedPatient } from '../types';

export const admissionIdentificationStatusAttributeTypeUuid = '787f1ea9-1792-45e5-9076-699b1a0638cb';
export const identityVerificationStatusAttributeTypeUuid = 'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e';

export const identityVerificationStatusConceptUuids = {
  unverified: '4ff1586e-2186-4820-bc98-2535ddfbcb33',
  verifiedByReniec: '01c97f73-9e7d-420c-bd08-3ba82e8cc825',
  verifiedManually: '3f00a2b4-8de8-45d0-bf03-5d785f44df08',
  conflict: '67dd2ba3-b9d5-4338-8151-7cf0617b8e0a',
  undocumented: '48e7cf4d-8f2f-41a3-9b8d-5b28d1a17352',
} as const;

export const admissionIdentificationStatusConceptUuids = {
  pending: 'bdb57e2a-d8fd-4e2b-8622-1ba60dcd3024',
  partial: '37ea79cb-9ae7-4297-8e56-8c374561c73c',
  confirmed: '9e42f0f1-d989-4604-902e-8a33f474f01e',
  merged: '8e9518a2-828d-4e50-a110-d964b63e51e2',
} as const;

type PersonAttribute = SearchedPatient['attributes'][number];
type StringMatchMode = 'contains' | 'exact' | 'prefix';

const admissionIdentificationStatusAliases = [
  {
    uuid: admissionIdentificationStatusConceptUuids.pending,
    aliases: ['pending', 'not_identified', 'no_identificado', 'no identificado', 'pendiente'],
  },
  {
    uuid: admissionIdentificationStatusConceptUuids.partial,
    aliases: ['partial', 'identificacion parcial', 'parcial'],
  },
  {
    uuid: admissionIdentificationStatusConceptUuids.confirmed,
    aliases: ['confirmed', 'identificacion confirmada', 'confirmado'],
  },
  {
    uuid: admissionIdentificationStatusConceptUuids.merged,
    aliases: ['merged', 'fusionado', 'fusionado con registro existente'],
  },
] as const;

const identityVerificationStatusAliases = [
  {
    uuid: identityVerificationStatusConceptUuids.unverified,
    aliases: ['unverified', 'no_verificado', 'no verificado'],
  },
  {
    uuid: identityVerificationStatusConceptUuids.verifiedByReniec,
    aliases: ['verified_by_reniec', 'validado_reniec', 'validado por reniec'],
  },
  {
    uuid: identityVerificationStatusConceptUuids.verifiedManually,
    aliases: ['verified_manually', 'validado_manual', 'validado manualmente'],
  },
  {
    uuid: identityVerificationStatusConceptUuids.conflict,
    aliases: ['conflict', 'conflicto', 'datos en conflicto'],
  },
  {
    uuid: identityVerificationStatusConceptUuids.undocumented,
    aliases: ['undocumented', 'indocumentado', 'sin documento'],
  },
] as const;

function normalizeAttributeValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getAttributeValues(attribute: PersonAttribute) {
  const values = [attribute.display];

  if (typeof attribute.value === 'string') {
    values.push(attribute.value);
  } else if (attribute.value) {
    values.push(attribute.value.uuid, attribute.value.display);
  }

  return values.filter((value): value is string => Boolean(value)).map(normalizeAttributeValue);
}

function matchesStatusAttribute(
  attribute: PersonAttribute,
  selectedValue: string,
  statuses: ReadonlyArray<{ uuid: string; aliases: ReadonlyArray<string> }>,
) {
  const normalizedSelectedValue = normalizeAttributeValue(selectedValue);
  const attributeValues = getAttributeValues(attribute);

  // Preserve generic concept matching for configurable or newly added statuses.
  if (attributeValues.includes(normalizedSelectedValue)) {
    return true;
  }

  const selectedStatus = statuses.find(
    ({ uuid, aliases }) =>
      normalizeAttributeValue(uuid) === normalizedSelectedValue ||
      aliases.some((alias) => normalizeAttributeValue(alias) === normalizedSelectedValue),
  );

  if (!selectedStatus) {
    return false;
  }

  const acceptedValues = new Set(
    [selectedStatus.uuid, ...selectedStatus.aliases].map((value) => normalizeAttributeValue(value)),
  );

  return attributeValues.some((value) => acceptedValues.has(value));
}

export function matchesPersonAttributeFilter(
  attribute: PersonAttribute,
  attributeTypeUuid: string,
  selectedValue: string,
  stringMatchMode: StringMatchMode = 'contains',
) {
  if (attributeTypeUuid === admissionIdentificationStatusAttributeTypeUuid) {
    return matchesStatusAttribute(attribute, selectedValue, admissionIdentificationStatusAliases);
  }

  if (attributeTypeUuid === identityVerificationStatusAttributeTypeUuid) {
    return matchesStatusAttribute(attribute, selectedValue, identityVerificationStatusAliases);
  }

  const normalizedSelectedValue = normalizeAttributeValue(selectedValue);
  const value = attribute.value;

  if (value && typeof value === 'object') {
    return normalizeAttributeValue(value.uuid) === normalizedSelectedValue;
  }

  const normalizedAttributeValue = normalizeAttributeValue(String(value ?? ''));
  if (stringMatchMode === 'exact') {
    return normalizedAttributeValue === normalizedSelectedValue;
  }
  if (stringMatchMode === 'prefix') {
    return normalizedAttributeValue.startsWith(normalizedSelectedValue);
  }
  return normalizedAttributeValue.includes(normalizedSelectedValue);
}
