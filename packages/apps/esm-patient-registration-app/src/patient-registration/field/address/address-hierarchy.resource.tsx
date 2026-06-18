import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { useField } from 'formik';
import { useCallback, useContext, useEffect, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import { PatientRegistrationContext } from '../../patient-registration-context';

interface AddressFields {
  name: string;
  addressField: string;
  required?: boolean;
}

interface OrderedAddressHierarchyLevelsResult {
  orderedFields?: Array<string>;
  requiredFields?: Set<string>;
  isLoadingFieldOrder: boolean;
  errorFetchingFieldOrder?: Error;
}

interface AddressHierarchyEntry {
  uuid: string;
  name: string;
  userGeneratedId?: string;
  parent?: AddressHierarchyEntry | null;
}

export interface AddressHierarchyPathSegment {
  addressField?: string;
  name: string;
  userGeneratedId?: string;
}

export interface AddressHierarchySearchResult {
  display: string;
  fieldValues: Record<string, string>;
  searchText: string;
  segments: Array<AddressHierarchyPathSegment>;
  userGeneratedId?: string;
}

export function useOrderedAddressHierarchyLevels(): OrderedAddressHierarchyLevelsResult {
  const url = '/module/addresshierarchy/ajax/getOrderedAddressHierarchyLevels.form';
  const { data, isLoading, error } = useSWRImmutable<FetchResponse<Array<AddressFields>>, Error>(url, openmrsFetch);

  const orderedAddressFields = Array.isArray(data?.data) ? data.data : [];

  const results = useMemo(
    () => ({
      orderedFields: orderedAddressFields.map((field) => field.addressField),
      requiredFields: new Set(
        orderedAddressFields.filter((field) => field.required).map((field) => field.addressField),
      ),
      isLoadingFieldOrder: isLoading,
      errorFetchingFieldOrder: error,
    }),
    [orderedAddressFields, isLoading, error],
  );

  return results;
}

export function useAddressEntries(fetchResults, searchString) {
  const encodedSearchString = encodeURIComponent(searchString);
  const { data, isLoading, error } = useSWRImmutable<FetchResponse<Array<{ name: string }>>>(
    fetchResults
      ? `module/addresshierarchy/ajax/getChildAddressHierarchyEntries.form?searchString=${encodedSearchString}`
      : null,
    openmrsFetch,
  );

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  const addressEntries = Array.isArray(data?.data) ? data.data : [];

  const results = useMemo(
    () => ({
      entries: addressEntries.map((item) => item.name),
      isLoadingAddressEntries: isLoading,
      errorFetchingAddressEntries: error,
    }),
    [addressEntries, isLoading, error],
  );
  return results;
}

/**
 * This hook is being used to fetch ordered address fields as configured in the address hierarchy
 * This hook returns the valid search term for valid fields to get suitable entries for the field
 * This also returns the function to reset the lower ordered fields if the value of a field is changed.
 */
export function useAddressEntryFetchConfig(addressField: string, fieldPrefix = 'address') {
  const { orderedFields, isLoadingFieldOrder } = useOrderedAddressHierarchyLevels();
  const { setFieldValue } = useContext(PatientRegistrationContext);
  const [, { value: addressValues }] = useField(fieldPrefix);

  const index = useMemo(
    () => (!isLoadingFieldOrder ? (orderedFields?.indexOf(addressField) ?? -1) : -1),
    [orderedFields, addressField, isLoadingFieldOrder],
  );

  const previousSelectedFields = useMemo(() => orderedFields?.slice(0, index) ?? [], [orderedFields, index]);
  const previousSelectedValues = useMemo(
    () => previousSelectedFields.map((fieldName) => addressValues?.[fieldName] ?? ''),
    [addressValues, previousSelectedFields],
  );

  const addressFieldSearchConfig = useMemo(() => {
    let fetchEntriesForField = true;
    const selectedValues = [];
    for (const selectedValue of previousSelectedValues) {
      if (!selectedValue) {
        fetchEntriesForField = false;
        break;
      }
      selectedValues.push(selectedValue);
    }
    return {
      fetchEntriesForField,
      searchString: selectedValues.join('|'),
    };
  }, [previousSelectedValues]);

  const updateChildElements = useCallback(() => {
    if (isLoadingFieldOrder || !orderedFields) {
      return;
    }
    orderedFields.slice(index + 1).forEach((fieldName) => {
      setFieldValue(`${fieldPrefix}.${fieldName}`, '', false);
    });
  }, [fieldPrefix, index, isLoadingFieldOrder, orderedFields, setFieldValue]);

  const results = useMemo(
    () => ({
      ...addressFieldSearchConfig,
      updateChildElements,
    }),
    [addressFieldSearchConfig, updateChildElements],
  );

  return results;
}

function isAddressHierarchyEntry(value: unknown): value is AddressHierarchyEntry {
  return typeof value === 'object' && value !== null && typeof (value as AddressHierarchyEntry).name === 'string';
}

function isAddressHierarchyEntryArray(value: unknown): value is Array<AddressHierarchyEntry> {
  return Array.isArray(value) && value.every(isAddressHierarchyEntry);
}

export function buildAddressHierarchyPath(entry: AddressHierarchyEntry, separator: string) {
  return getAddressHierarchyPathSegments(entry)
    .map((segment) => segment.name)
    .join(separator);
}

function getAddressHierarchyPathSegments(entry: AddressHierarchyEntry) {
  const path: Array<AddressHierarchyPathSegment> = [];
  let cursor: AddressHierarchyEntry | null | undefined = entry;

  while (cursor) {
    path.unshift({
      name: cursor.name,
      userGeneratedId: cursor.userGeneratedId,
    });
    cursor = cursor.parent;
  }

  return path;
}

function buildAddressHierarchySearchResult(
  entry: AddressHierarchyEntry,
  separator: string,
  addressFields: Array<string>,
  segmentLimit?: number,
): AddressHierarchySearchResult {
  const segments = getAddressHierarchyPathSegments(entry)
    .slice(0, segmentLimit)
    .map((segment, index) => ({
      ...segment,
      addressField: addressFields[index],
    }));
  const display = segments.map((segment) => segment.name).join(separator);
  const fieldValues = Object.fromEntries(
    segments
      .filter((segment): segment is AddressHierarchyPathSegment & { addressField: string } => !!segment.addressField)
      .map((segment) => [segment.addressField, segment.name]),
  );
  const lastSegment = segments[segments.length - 1];
  const userGeneratedIds = segments.map((segment) => segment.userGeneratedId).filter(Boolean);

  return {
    display,
    fieldValues,
    searchText: `${display} ${userGeneratedIds.join(' ')}`.toLowerCase(),
    segments,
    userGeneratedId: lastSegment?.userGeneratedId,
  };
}

function getUbigeoFromSearchString(searchString: string) {
  const trimmedSearchString = searchString.trim();

  if (/^\d{1,10}$/.test(trimmedSearchString)) {
    return trimmedSearchString;
  }

  return trimmedSearchString.match(/%(\d{1,10})(?!.*%\d)/)?.[1] ?? null;
}

function getUbigeoSearchTarget(searchString: string, addressFields: Array<string>) {
  const ubigeo = getUbigeoFromSearchString(searchString);

  if (!ubigeo) {
    return null;
  }

  const searchTarget =
    ubigeo.length <= 2
      ? { addressField: 'address1', parentCode: '00' }
      : ubigeo.length <= 4
        ? { addressField: 'stateProvince', parentCode: ubigeo.slice(0, 2) }
        : ubigeo.length <= 6
          ? { addressField: 'countyDistrict', parentCode: ubigeo.slice(0, 4) }
          : { addressField: 'cityVillage', parentCode: ubigeo.slice(0, 6) };

  if (!addressFields.includes(searchTarget.addressField)) {
    return null;
  }

  return {
    ...searchTarget,
    ubigeo,
  };
}

async function fetchAddressHierarchyByUbigeo(
  searchString: string,
  separator: string,
  addressFields: Array<string>,
): Promise<Array<AddressHierarchySearchResult>> {
  const target = getUbigeoSearchTarget(searchString, addressFields);

  if (!target) {
    return [];
  }

  const response = await openmrsFetch<Array<AddressHierarchyEntry>>(
    `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=${encodeURIComponent(target.addressField)}&limit=1000&searchString=%25&parentUuid=&userGeneratedIdForParent=${encodeURIComponent(target.parentCode)}`,
  );

  if (!isAddressHierarchyEntryArray(response.data)) {
    throw new Error('Invalid address hierarchy response');
  }

  return response.data
    .filter((entry) => entry.userGeneratedId?.startsWith(target.ubigeo))
    .map((entry) => buildAddressHierarchySearchResult(entry, separator, addressFields));
}

function deduplicateAddressHierarchyResults(results: Array<AddressHierarchySearchResult>) {
  return Array.from(
    new Map(results.map((result) => [`${result.userGeneratedId ?? ''}:${result.display}`, result])).values(),
  );
}

export async function fetchAddressHierarchyQuickSearch(
  searchString: string,
  separator: string,
  addressFields: Array<string>,
) {
  const encodedSearchString = encodeURIComponent(searchString);
  const [nameSearchResults, ubigeoSearchResults] = await Promise.all([
    Promise.all(
      addressFields.map(async (addressField) => {
        const encodedAddressField = encodeURIComponent(addressField);
        const response = await openmrsFetch<Array<AddressHierarchyEntry>>(
          `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=${encodedAddressField}&limit=20&searchString=${encodedSearchString}&parentUuid=`,
        );

        if (!isAddressHierarchyEntryArray(response.data)) {
          throw new Error('Invalid address hierarchy response');
        }

        return response.data.map((entry) => buildAddressHierarchySearchResult(entry, separator, addressFields));
      }),
    ),
    fetchAddressHierarchyByUbigeo(searchString, separator, addressFields),
  ]);
  const normalizedUbigeoSearch = getUbigeoFromSearchString(searchString);

  return deduplicateAddressHierarchyResults([...nameSearchResults.flat(), ...ubigeoSearchResults])
    .sort((firstAddress, secondAddress) => {
      const firstExactUbigeo = firstAddress.userGeneratedId === normalizedUbigeoSearch ? 0 : 1;
      const secondExactUbigeo = secondAddress.userGeneratedId === normalizedUbigeoSearch ? 0 : 1;
      const firstDepth = firstAddress.segments.length;
      const secondDepth = secondAddress.segments.length;
      if (firstExactUbigeo !== secondExactUbigeo) {
        return firstExactUbigeo - secondExactUbigeo;
      }
      return firstDepth - secondDepth || firstAddress.display.localeCompare(secondAddress.display);
    })
    .slice(0, 50);
}

export function useAddressHierarchy(searchString: string, separator: string, addressFields: Array<string>) {
  const cacheKey =
    searchString && addressFields.length
      ? `address-hierarchy-quick-search:${searchString}:${separator}:${addressFields.join('|')}`
      : null;

  const { data, error, isLoading } = useSWRImmutable<Array<AddressHierarchySearchResult>, Error>(cacheKey, () =>
    fetchAddressHierarchyQuickSearch(searchString, separator, addressFields),
  );

  const results = useMemo(
    () => ({
      addresses: data ?? [],
      error,
      isLoading,
    }),
    [data, error, isLoading],
  );
  return results;
}

export function useAddressHierarchyWithParentSearch(addressField: string, parentid: string, query: string) {
  const encodedQuery = encodeURIComponent(query);
  const encodedParentId = encodeURIComponent(parentid);
  const { data, error, isLoading } = useSWRImmutable<
    FetchResponse<
      Array<{
        uuid: string;
        name: string;
      }>
    >,
    Error
  >(
    query
      ? `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=${encodeURIComponent(addressField)}&limit=20&searchString=${encodedQuery}&parentUuid=${encodedParentId}`
      : null,
    openmrsFetch,
  );

  const possibleParentEntries = Array.isArray(data?.data) ? data.data : [];

  const results = useMemo(
    () => ({
      error: error,
      isLoading,
      addresses: possibleParentEntries,
    }),
    [possibleParentEntries, error, isLoading],
  );

  return results;
}
