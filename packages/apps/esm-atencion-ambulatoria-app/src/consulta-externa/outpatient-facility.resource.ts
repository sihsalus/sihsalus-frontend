import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

const LOCATION_REPRESENTATION =
  'custom:(uuid,display,retired,address1,address4,cityVillage,countyDistrict,stateProvince,country,attributes:(uuid,voided,value,attributeType:(uuid)))';

interface OutpatientFacilityLocationAttribute {
  uuid?: string;
  voided?: boolean;
  value?: unknown;
  attributeType?: {
    uuid?: string;
  } | null;
}

export interface OutpatientFacilityLocation {
  uuid?: string;
  display?: string;
  retired?: boolean;
  address1?: string | null;
  address4?: string | null;
  cityVillage?: string | null;
  countyDistrict?: string | null;
  stateProvince?: string | null;
  country?: string | null;
  attributes?: OutpatientFacilityLocationAttribute[] | null;
}

export interface OutpatientFacilityIdentity {
  facilityAddress: string | null;
  facilityPhone: string | null;
  facilityIpressCode: string | null;
}

export interface OutpatientFacilityIdentityState extends OutpatientFacilityIdentity {
  isLoading: boolean;
}

export interface OutpatientFacilityIdentityOptions {
  sessionLocationUuid?: string | null;
  fallbackLocationUuid?: string | null;
  phoneAttributeTypeUuid?: string | null;
  ipressCodeAttributeTypeUuid?: string | null;
  fallbackAddress?: string | null;
  fallbackPhone?: string | null;
  fallbackIpressCode?: string | null;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('es-PE');
}

function sameUuid(first?: string | null, second?: string | null): boolean {
  const normalizedFirst = cleanText(first)?.toLowerCase();
  const normalizedSecond = cleanText(second)?.toLowerCase();
  return Boolean(normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond);
}

function addUniquePart(parts: string[], candidate?: string | null): void {
  const value = cleanText(candidate);
  if (!value || parts.some((part) => normalized(part) === normalized(value))) return;
  parts.push(value);
}

export function buildOutpatientFacilityAddress(location?: OutpatientFacilityLocation | null): string | null {
  if (!location) return null;

  const parts: string[] = [];
  const display = cleanText(location.display);
  const cityVillage = cleanText(location.cityVillage);

  // In the SIH Salus address hierarchy, address4 is the explicit street/address
  // field and address1 is the region. Never synthesize a street from other data.
  addUniquePart(parts, location.address4);
  if (cityVillage && (!display || !normalized(display).includes(normalized(cityVillage)))) {
    addUniquePart(parts, cityVillage);
  }
  const district = cleanText(location.countyDistrict);
  addUniquePart(parts, district ? `distrito de ${district}` : null);
  const province = cleanText(location.stateProvince);
  addUniquePart(parts, province ? `provincia de ${province}` : null);
  addUniquePart(parts, location.address1);

  if (!parts.length) addUniquePart(parts, location.country);
  const address = parts.join(', ');
  return address ? `${address.charAt(0).toLocaleUpperCase('es-PE')}${address.slice(1)}` : null;
}

function getLocationAttributeValue(
  location: OutpatientFacilityLocation,
  attributeTypeUuid?: string | null,
): string | null {
  const expectedUuid = cleanText(attributeTypeUuid)?.toLowerCase();
  if (!expectedUuid) return null;
  for (const attribute of location.attributes ?? []) {
    if (attribute.voided || attribute.attributeType?.uuid?.toLowerCase() !== expectedUuid) continue;
    const value = cleanText(attribute.value);
    if (value) return value;
  }
  return null;
}

export function resolveOutpatientFacilityIdentity(
  location: OutpatientFacilityLocation | null | undefined,
  options: OutpatientFacilityIdentityOptions,
): OutpatientFacilityIdentity {
  const mayUseFallback = sameUuid(options.sessionLocationUuid, options.fallbackLocationUuid);
  const fallback: OutpatientFacilityIdentity = {
    facilityAddress: mayUseFallback ? cleanText(options.fallbackAddress) : null,
    facilityPhone: mayUseFallback ? cleanText(options.fallbackPhone) : null,
    facilityIpressCode: mayUseFallback ? cleanText(options.fallbackIpressCode) : null,
  };

  if (
    !cleanText(options.sessionLocationUuid) ||
    !location ||
    location.retired ||
    !sameUuid(location.uuid, options.sessionLocationUuid)
  ) {
    return fallback;
  }

  const facilityPhone = getLocationAttributeValue(location, options.phoneAttributeTypeUuid);
  const facilityIpressCode = getLocationAttributeValue(location, options.ipressCodeAttributeTypeUuid);
  const coordinatedContentIdentityIsAvailable = Boolean(facilityPhone && facilityIpressCode);

  return {
    // These attributes mark the coordinated content version that also fixes
    // HSC's address hierarchy. Do not let legacy fields override the verified
    // fallback with a partially migrated HSC address.
    facilityAddress:
      mayUseFallback && !coordinatedContentIdentityIsAvailable
        ? fallback.facilityAddress
        : (buildOutpatientFacilityAddress(location) ?? fallback.facilityAddress),
    facilityPhone: facilityPhone ?? fallback.facilityPhone,
    facilityIpressCode: facilityIpressCode ?? fallback.facilityIpressCode,
  };
}

export function getOutpatientFacilityLocationUrl(locationUuid: string): string {
  return `${restBaseUrl}/location/${encodeURIComponent(locationUuid)}?v=${encodeURIComponent(LOCATION_REPRESENTATION)}`;
}

export function useOutpatientFacilityIdentity(
  options: OutpatientFacilityIdentityOptions,
): OutpatientFacilityIdentityState {
  const sessionLocationUuid = cleanText(options.sessionLocationUuid);
  const { data, isLoading } = useSWR<FetchResponse<OutpatientFacilityLocation>, Error>(
    sessionLocationUuid ? getOutpatientFacilityLocationUrl(sessionLocationUuid) : null,
    openmrsFetch,
  );

  return {
    ...resolveOutpatientFacilityIdentity(data?.data, options),
    isLoading: Boolean(sessionLocationUuid && isLoading),
  };
}
