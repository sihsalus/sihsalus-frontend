import { openmrsFetch } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

const provenanceAddressFields = ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'];
const invalidProvenanceCharacterRegex = /[^\p{L}\s,]/gu;
const repeatedWhitespaceRegex = /\s{2,}/g;

interface AddressHierarchyEntry {
  name: string;
  parent?: AddressHierarchyEntry | null;
}

function isAddressHierarchyEntry(value: unknown): value is AddressHierarchyEntry {
  return typeof value === 'object' && value !== null && typeof (value as AddressHierarchyEntry).name === 'string';
}

function isAddressHierarchyEntryArray(value: unknown): value is Array<AddressHierarchyEntry> {
  return Array.isArray(value) && value.every(isAddressHierarchyEntry);
}

export function sanitizeVisitProvenance(value: string) {
  const text = Array.from(value)
    .filter((char) => {
      const charCode = char.charCodeAt(0);
      return charCode >= 32 && charCode !== 127;
    })
    .join('');

  return text.replace(invalidProvenanceCharacterRegex, '').replace(repeatedWhitespaceRegex, ' ');
}

export function normalizeVisitProvenance(value: string) {
  return sanitizeVisitProvenance(value)
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildAddressHierarchyPath(entry: AddressHierarchyEntry, separator: string) {
  const path = [];
  let cursor: AddressHierarchyEntry | null | undefined = entry;

  while (cursor) {
    path.unshift(cursor.name);
    cursor = cursor.parent;
  }

  return path.join(separator);
}

export async function fetchVisitProvenanceAddressOptions(searchString: string, separator = ', ') {
  const sanitizedSearchString = normalizeVisitProvenance(searchString);

  if (sanitizedSearchString.length < 3) {
    return [];
  }

  const encodedSearchString = encodeURIComponent(sanitizedSearchString);
  const addressResults = await Promise.all(
    provenanceAddressFields.map(async (addressField) => {
      const encodedAddressField = encodeURIComponent(addressField);
      const response = await openmrsFetch<Array<AddressHierarchyEntry>>(
        `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=${encodedAddressField}&limit=20&searchString=${encodedSearchString}&parentUuid=`,
      );

      if (!isAddressHierarchyEntryArray(response.data)) {
        throw new Error('Invalid address hierarchy response');
      }

      return response.data.map((entry) => buildAddressHierarchyPath(entry, separator));
    }),
  );

  return Array.from(new Set(addressResults.flat()))
    .sort((firstAddress, secondAddress) => {
      const firstDepth = firstAddress.split(separator).length;
      const secondDepth = secondAddress.split(separator).length;
      return firstDepth - secondDepth || firstAddress.localeCompare(secondAddress);
    })
    .slice(0, 50);
}

export function useVisitProvenanceAddressOptions(searchString: string, separator = ', ') {
  const normalizedSearchString = normalizeVisitProvenance(searchString);
  const cacheKey =
    normalizedSearchString.length >= 3
      ? `visit-provenance-address-options:${normalizedSearchString}:${separator}`
      : null;
  const { data, error, isLoading } = useSWRImmutable<Array<string>, Error>(cacheKey, () =>
    fetchVisitProvenanceAddressOptions(normalizedSearchString, separator),
  );

  return useMemo(
    () => ({
      addresses: data ?? [],
      error,
      isLoading,
    }),
    [data, error, isLoading],
  );
}
