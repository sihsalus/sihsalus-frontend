import { useConfig } from '@openmrs/esm-framework';
import { useOrderableConceptSets } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';
import type { ConfigObject } from '../../config-schema';
import { collectTestTypes, type SearchableTestType, searchTestTypes } from './test-type-matching';

export interface TestType extends SearchableTestType {}

export function useTestTypes(
  searchTerm: string,
  orderableConceptSets: Array<string>,
): {
  testTypes: Array<TestType>;
  isLoading: boolean;
  error: Error;
} {
  // Pasamos un string vacío a useOrderableConceptSets para que retorne todos los miembros sin filtrar
  // prematuramente a nivel del set principal o intermedio.
  const { concepts, isLoading, error } = useOrderableConceptSets('', orderableConceptSets);
  const { testTypeSearchAliases = {} } = useConfig<ConfigObject>();
  const catalog = useMemo(
    () => collectTestTypes(concepts ?? [], testTypeSearchAliases),
    [concepts, testTypeSearchAliases],
  );

  const results = useMemo(() => {
    if (isLoading || error || !concepts) {
      return { testTypes: [], isLoading, error };
    }

    return {
      testTypes: searchTestTypes(catalog, searchTerm),
      isLoading,
      error,
    };
  }, [isLoading, concepts, error, searchTerm, catalog]);

  return results;
}
