import { Search } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useConceptSearchInput } from '../../hooks/use-concept-search-input';

import styles from './concept-search-input.scss';
import ConceptSearchResults from './concept-search-results';

interface ConceptSearchInputProps {
  parameterName: string;
  labelText?: string;
  placeholder?: string;
  onConceptSelect: (conceptUuid: string, conceptDisplay: string) => void;
}

const ConceptSearchInput: React.FC<ConceptSearchInputProps> = ({
  parameterName,
  labelText,
  placeholder,
  onConceptSelect,
}) => {
  const { t } = useTranslation();

  const {
    searchInputRef,
    searchTerm,
    selectedConcept,
    debouncedSearchTerm,
    handleSearchTermChange,
    focusAndClearSearchInput,
    handleConceptSelect,
  } = useConceptSearchInput({
    parameterName,
    onConceptSelect,
  });

  return (
    <div className={styles.conceptSearchContainer}>
      <Search
        size="lg"
        placeholder={placeholder || t('searchFieldPlaceholder', 'Search for a concept')}
        labelText={labelText || t('searchFieldPlaceholder', 'Search for a concept')}
        onChange={handleSearchTermChange}
        ref={searchInputRef}
        value={searchTerm}
      />
      {!selectedConcept && (
        <div className={styles.conceptSearchResultsDropdown}>
          <ConceptSearchResults
            searchTerm={debouncedSearchTerm}
            focusAndClearSearchInput={focusAndClearSearchInput}
            onConceptSelect={handleConceptSelect}
          />
        </div>
      )}
    </div>
  );
};

export default ConceptSearchInput;
