import { Button, Search } from '@carbon/react';
import {
  ExtensionSlot,
  ResponsiveWrapper,
  useConfig,
  useDebounce,
  useLayoutType,
  type Visit,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import styles from './order-basket-search.scss';
import OrderBasketSearchResults from './order-basket-search-results.component';

export interface DrugSearchProps {
  openOrderForm: (searchResult: DrugOrderBasketItem) => void;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
  patient: fhir.Patient;
  visit: Visit;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

export default function DrugSearch({
  closeWorkspace,
  openOrderForm,
  patient,
  visit,
  searchTerm,
  onSearchTermChange,
}: DrugSearchProps) {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { debounceDelayInMs, daysDurationUnit, minimumCharacterLengthForDrugSearch } = useConfig<ConfigObject>();
  const searchableSearchTerm =
    searchTerm.trim().length >= (minimumCharacterLengthForDrugSearch ?? 2) ? searchTerm.trim() : '';
  const debouncedSearchTerm = useDebounce(searchableSearchTerm, debounceDelayInMs ?? 300);
  const searchInputRef = useRef(null);

  const handleSearchTermChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onSearchTermChange(event.target.value ?? '');
    },
    [onSearchTermChange],
  );

  const focusAndClearSearchInput = useCallback(() => {
    onSearchTermChange('');
    searchInputRef.current?.focus();
  }, [onSearchTermChange]);

  return (
    <div className={styles.searchPopupContainer}>
      <ExtensionSlot name="allergy-list-pills-slot" state={{ patientUuid: patient?.id }} />
      <ResponsiveWrapper>
        <Search
          autoFocus
          className={styles.searchInput}
          labelText={t('searchFieldPlaceholder', 'Search for a drug or orderset (e.g. "Aspirin")')}
          onChange={handleSearchTermChange}
          placeholder={t('searchFieldPlaceholder', 'Search for a drug or orderset (e.g. "Aspirin")')}
          ref={searchInputRef}
          size="lg"
          value={searchTerm}
        />
      </ResponsiveWrapper>
      <ExtensionSlot
        name="drug-search-slot"
        state={{ openOrderForm, isSearching: Boolean(debouncedSearchTerm), visit, daysDurationUnit }}
      />
      <OrderBasketSearchResults
        searchTerm={debouncedSearchTerm}
        closeWorkspace={closeWorkspace}
        openOrderForm={openOrderForm}
        focusAndClearSearchInput={focusAndClearSearchInput}
        patient={patient}
        visit={visit}
      />
      {isTablet && (
        <div className={styles.separatorContainer}>
          <Button
            iconDescription={t('returnToOrderBasket', 'Return to order basket')}
            kind="ghost"
            onClick={() => closeWorkspace()}
          >
            {t('returnToOrderBasket', 'Return to order basket')}
          </Button>
        </div>
      )}
    </div>
  );
}
