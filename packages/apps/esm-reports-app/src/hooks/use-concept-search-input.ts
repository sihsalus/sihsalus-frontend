import { useDebounce } from '@openmrs/esm-framework';
import { useCallback, useRef, useState } from 'react';

interface ConceptSearchInputOptions {
  parameterName: string;
  onConceptSelect?: (conceptUuid: string, conceptDisplay: string) => void;
}

interface SelectedConcept {
  uuid: string;
  display?: string;
}

export function useConceptSearchInput({ parameterName: _parameterName, onConceptSelect }: ConceptSearchInputOptions) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<SelectedConcept | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleSearchTermChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value ?? '');
      // Clear selected concept when user starts typing again
      if (selectedConcept) {
        setSelectedConcept(null);
      }
    },
    [selectedConcept],
  );

  const focusAndClearSearchInput = useCallback(() => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  }, []);

  const handleConceptSelect = useCallback(
    (concept: SelectedConcept) => {
      setSelectedConcept(concept);
      setSearchTerm(concept.display || '');

      // Notify parent component of selection
      if (onConceptSelect) {
        onConceptSelect(concept.uuid, concept.display || '');
      }
    },
    [onConceptSelect],
  );

  const resetSearch = useCallback(() => {
    setSearchTerm('');
    setSelectedConcept(null);
  }, []);

  return {
    searchInputRef,
    searchTerm,
    selectedConcept,
    debouncedSearchTerm,
    handleSearchTermChange,
    focusAndClearSearchInput,
    handleConceptSelect,
    resetSearch,
  };
}
