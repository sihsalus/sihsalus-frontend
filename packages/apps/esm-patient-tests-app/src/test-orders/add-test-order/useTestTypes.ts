import { useOrderableConceptSets } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';

export interface TestType {
  label: string;
  conceptUuid: string;
  synonyms: Array<string>;
  groupLabel?: string;
}

const normalizeText = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// Función recursiva para aplanar conjuntos de conceptos anidados a nivel de hojas y registrar etiquetas de grupo
function flattenConcepts(concept: any, parentSetLabel?: string): Array<any> {
  if (concept.setMembers && concept.setMembers.length > 0) {
    const currentLabel = parentSetLabel ?? concept.display;
    return concept.setMembers.flatMap((member: any) => flattenConcepts(member, currentLabel));
  }
  return [{ ...concept, groupLabel: parentSetLabel }];
}

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

  const results = useMemo(() => {
    if (isLoading || error || !concepts) {
      return { testTypes: [], isLoading, error };
    }

    // Aplanamiento recursivo registrando el subconjunto intermedio
    const flattened = concepts.flatMap((c) => flattenConcepts(c));

    // Deduplicación por uuid y ordenamiento alfabético por grupo primero, luego por nombre
    const unique = flattened.filter((item, pos, array) => pos === 0 || array[pos - 1].uuid !== item.uuid);

    const sorted = unique.sort((a, b) => {
      const groupA = a.groupLabel ?? '';
      const groupB = b.groupLabel ?? '';
      if (groupA !== groupB) {
        return groupA.localeCompare(groupB);
      }
      return (a.display ?? '').localeCompare(b.display ?? '');
    });

    // Filtrar localmente según el término de búsqueda
    const filtered = searchTerm
      ? sorted.filter((c) => {
          const normalizedSearch = normalizeText(searchTerm);
          const displayMatches = normalizeText(c.display).includes(normalizedSearch);
          const synonymMatches = c.names?.some((name: any) =>
            normalizeText(name.display).includes(normalizedSearch),
          );
          return displayMatches || synonymMatches;
        })
      : sorted;

    return {
      testTypes: filtered.map((c) => ({
        label: c.display,
        conceptUuid: c.uuid,
        synonyms: c.synonyms ?? c.names?.map((n: any) => n.display) ?? [],
        groupLabel: c.groupLabel,
      })),
      isLoading,
      error,
    };
  }, [isLoading, concepts, error, searchTerm]);

  return results;
}
