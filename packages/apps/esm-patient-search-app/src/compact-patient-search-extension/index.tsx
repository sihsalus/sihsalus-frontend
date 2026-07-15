import { Button, Search } from '@carbon/react';
import { interpolateString, navigate, useConfig, useDebounce } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import PatientSearch from '../compact-patient-search/patient-search.component';
import { type PatientSearchConfig } from '../config-schema';
import useArrowNavigation from '../hooks/useArrowNavigation';
import { useInfinitePatientSearch } from '../patient-search.resource';
import { PatientSearchContext } from '../patient-search-context';

import styles from './compact-patient-search.scss';

interface CompactPatientSearchProps {
  initialSearchTerm: string;
  /** An action to take when the patient is selected, other than navigation. If not provided, navigation takes place. */
  selectPatientAction?: (patientUuid: string) => undefined;
  buttonProps?: object;
}

const CompactPatientSearchComponent: React.FC<CompactPatientSearchProps> = ({
  selectPatientAction,
  initialSearchTerm = '',
  buttonProps,
}) => {
  const { t } = useTranslation();
  const config = useConfig<PatientSearchConfig>();
  const inputRef = useRef<HTMLInputElement>(null);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const normalizedSearchTerm = useMemo(() => searchTerm?.trim() ?? '', [searchTerm]);
  const debouncedSearchTerm = useDebounce(normalizedSearchTerm);
  const shouldSearch = Boolean(normalizedSearchTerm) && normalizedSearchTerm === debouncedSearchTerm;
  const patientSearchResponse = useInfinitePatientSearch(
    debouncedSearchTerm,
    config.includeDead,
    shouldSearch,
  );
  const { data: patients } = patientSearchResponse;
  const visiblePatients = shouldSearch ? patients : null;

  const handleChange = useCallback((val) => setSearchTerm(val), []);

  const handleClear = useCallback(() => setSearchTerm(''), []);

  /**
   * handlePatientSelection: Manually handles everything that needs to happen when a patient
   * from the result list is selected. This is used for the arrow navigation, but is not used
   * for click handling.
   */
  const handlePatientSelection = useCallback(
    (event, index: number) => {
      const patient = visiblePatients?.[index];
      if (!patient) {
        return;
      }

      event.preventDefault();
      if (selectPatientAction) {
        selectPatientAction(patient.uuid);
      } else {
        navigate({
          to: interpolateString(config.search.patientChartUrl, {
            patientUuid: patient.uuid,
          }),
        });
      }
      handleClear();
    },
    [config.search, selectPatientAction, visiblePatients, handleClear],
  );

  const handleFocusToInput = useCallback(() => {
    if (inputRef.current) {
      const len = inputRef.current.value?.length ?? 0;
      inputRef.current.setSelectionRange(len, len);
      inputRef.current.focus();
    }
  }, []);

  const isEventFromFocusedResult = useCallback((event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const result = bannerContainerRef.current?.children.item(index);
    return Boolean(result?.contains(event.target as Node));
  }, []);

  const { focusedResult, handleKeyPress, resetFocusedResult } = useArrowNavigation(
    visiblePatients?.length ?? 0,
    handlePatientSelection,
    handleFocusToInput,
    {
      isEventFromFocusedResult,
      resetKey: normalizedSearchTerm,
    },
  );

  useEffect(() => {
    if (bannerContainerRef.current && focusedResult > -1) {
      (bannerContainerRef.current.children?.[focusedResult] as HTMLElement | undefined)?.focus();
      bannerContainerRef.current.children?.[focusedResult]?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest',
      });
    } else if (bannerContainerRef.current && inputRef.current && focusedResult === -1) {
      handleFocusToInput();
    }
  }, [focusedResult, handleFocusToInput]);

  return (
    <div
      aria-label={t('patientSearch', 'Patient search')}
      className={styles.patientSearchBar}
      onKeyDown={handleKeyPress}
      role="group"
    >
      <form onSubmit={(event) => event.preventDefault()} className={styles.searchArea}>
        <Search
          autoFocus
          className={styles.patientSearchInput}
          closeButtonLabelText={t('clearSearch', 'Clear')}
          labelText=""
          onChange={(event) => handleChange(event.target.value)}
          onClear={handleClear}
          onFocus={resetFocusedResult}
          placeholder={t('searchForPatient', 'Search for a patient by name or identifier number')}
          ref={inputRef}
          size="lg"
          value={searchTerm}
        />
        <Button type="submit" onClick={(event) => event.preventDefault()} {...buttonProps}>
          {t('search', 'Search')}
        </Button>
      </form>
      {shouldSearch && (
        <PatientSearchContext.Provider
          value={{
            nonNavigationSelectPatientAction: selectPatientAction,
            patientClickSideEffect: handleClear,
          }}
        >
          <div className={styles.floatingSearchResultsContainer}>
            <PatientSearch query={debouncedSearchTerm} ref={bannerContainerRef} {...patientSearchResponse} />
          </div>
        </PatientSearchContext.Provider>
      )}
    </div>
  );
};

export default CompactPatientSearchComponent;
