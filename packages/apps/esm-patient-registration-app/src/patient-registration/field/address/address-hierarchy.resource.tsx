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

export function useAddressHierarchy(searchString: string, separator: string) {
  const encodedSearchString = encodeURIComponent(searchString);
  const encodedSeparator = encodeURIComponent(separator);
  const { data, error, isLoading } = useSWRImmutable<
    FetchResponse<
      Array<{
        address: string;
      }>
    >,
    Error
  >(
    searchString
      ? `/module/addresshierarchy/ajax/getPossibleFullAddresses.form?separator=${encodedSeparator}&searchString=${encodedSearchString}`
      : null,
    openmrsFetch,
  );

  const addressHierarchy = Array.isArray(data?.data) ? data.data : [];

  const results = useMemo(
    () => ({
      addresses: addressHierarchy.map((address) => address.address),
      error,
      isLoading,
    }),
    [addressHierarchy, error, isLoading],
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
      ? `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=${addressField}&limit=20&searchString=${encodedQuery}&parentUuid=${encodedParentId}`
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
