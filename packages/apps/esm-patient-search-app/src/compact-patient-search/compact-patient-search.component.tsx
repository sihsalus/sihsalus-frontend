import {
  getUserFacingErrorMessage,
  interpolateString,
  navigate,
  showSnackbar,
  useConfig,
  useDebounce,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type PatientSearchConfig } from '../config-schema';
import useArrowNavigation from '../hooks/useArrowNavigation';
import { isPatientSearchTermValid, limitPatientSearchTerm } from '../patient-search-constants';
import {
  isForbiddenUserPropertiesError,
  useInfinitePatientSearch,
  useRecentlyViewedPatients,
  useRestPatients,
} from '../patient-search.resource';
import PatientSearchBar from '../patient-search-bar/patient-search-bar.component';
import { PatientSearchContext } from '../patient-search-context';

import styles from './compact-patient-search.scss';
import PatientSearch from './patient-search.component';
import RecentlySearchedPatients from './recently-searched-patients.component';

interface CompactPatientSearchProps {
  isSearchPage: boolean;
  initialSearchTerm: string;
  onPatientSelect?: () => void;
  shouldNavigateToPatientSearchPage?: boolean;
}

const CompactPatientSearchComponent: React.FC<CompactPatientSearchProps> = ({
  initialSearchTerm,
  isSearchPage,
  onPatientSelect,
  shouldNavigateToPatientSearchPage,
}) => {
  const { t } = useTranslation();

  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState(() => limitPatientSearchTerm(initialSearchTerm));
  const normalizedSearchTerm = searchTerm?.trim() ?? '';
  const debouncedSearchTerm = useDebounce(normalizedSearchTerm);
  const hasCurrentSearchTerm = Boolean(normalizedSearchTerm);
  const isDebouncing = normalizedSearchTerm !== debouncedSearchTerm;
  const shouldSearch = isPatientSearchTermValid(normalizedSearchTerm) && !isDebouncing;

  const config = useConfig<PatientSearchConfig>();
  const { showRecentlySearchedPatients } = config.search;

  const patientSearchResponse = useInfinitePatientSearch(debouncedSearchTerm, config.includeDead, shouldSearch);
  const { data: searchedPatients } = patientSearchResponse;

  const {
    error: errorFetchingUserProperties,
    mutateUserProperties,
    recentlyViewedPatientUuids,
    updateRecentlyViewedPatients,
  } = useRecentlyViewedPatients(showRecentlySearchedPatients);

  const recentPatientSearchResponse = useRestPatients(recentlyViewedPatientUuids, !hasCurrentSearchTerm);
  const { data: recentPatients, fetchError } = recentPatientSearchResponse;
  const patientsForKeyboardNavigation = shouldSearch
    ? searchedPatients
    : !hasCurrentSearchTerm
      ? recentPatients
      : null;

  const handleFocusToInput = useCallback(() => {
    if (searchInputRef.current) {
      const inputElement = searchInputRef.current;
      inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      inputElement.focus();
    }
  }, []);

  const handleCloseSearchResults = useCallback(() => {
    setSearchTerm('');
    onPatientSelect?.();
  }, [onPatientSelect]);

  const addViewedPatientAndCloseSearchResults = useCallback(
    async (patientUuid: string) => {
      handleCloseSearchResults();
      try {
        await updateRecentlyViewedPatients(patientUuid);
        await mutateUserProperties();
      } catch (error) {
        if (isForbiddenUserPropertiesError(error)) {
          return;
        }

        showSnackbar({
          kind: 'error',
          title: t('errorUpdatingRecentlyViewedPatients', 'Error updating recently viewed patients'),
          subtitle: getUserFacingErrorMessage(
            error,
            t('errorCopy', 'Sorry, there was an error. Please try again or contact the site administrator.'),
            { logContext: 'Error updating recently viewed patients' },
          ),
        });
      }
    },
    [handleCloseSearchResults, mutateUserProperties, updateRecentlyViewedPatients, t],
  );

  const handlePatientSelection = useCallback(
    (evt: React.KeyboardEvent<HTMLElement>, index: number) => {
      const patient = patientsForKeyboardNavigation?.[index];
      if (patient) {
        evt.preventDefault();
        void addViewedPatientAndCloseSearchResults(patient.uuid);
        navigate({
          to: interpolateString(config.search.patientChartUrl, {
            patientUuid: patient.uuid,
          }),
        });
      }
    },
    [addViewedPatientAndCloseSearchResults, config.search.patientChartUrl, patientsForKeyboardNavigation],
  );

  const isEventFromFocusedResult = useCallback((event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const result = bannerContainerRef.current?.children.item(index);
    return Boolean(result?.contains(event.target as Node));
  }, []);

  const { focusedResult, handleKeyPress, resetFocusedResult } = useArrowNavigation(
    patientsForKeyboardNavigation?.length ?? 0,
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
    } else if (bannerContainerRef.current && searchInputRef.current && focusedResult === -1) {
      handleFocusToInput();
    }
  }, [focusedResult, handleFocusToInput]);

  useEffect(() => {
    if (fetchError) {
      showSnackbar({
        kind: 'error',
        title: t('errorFetchingPatients', 'Error fetching patients'),
        subtitle: getUserFacingErrorMessage(
          fetchError,
          t('errorCopy', 'Sorry, there was an error. Please try again or contact the site administrator.'),
          { logContext: 'Error fetching recently viewed patients' },
        ),
      });
    }

    if (errorFetchingUserProperties && !isForbiddenUserPropertiesError(errorFetchingUserProperties)) {
      showSnackbar({
        kind: 'error',
        title: t('errorFetchingUserProperties', 'Error fetching user properties'),
        subtitle: getUserFacingErrorMessage(
          errorFetchingUserProperties,
          t('errorCopy', 'Sorry, there was an error. Please try again or contact the site administrator.'),
          { logContext: 'Error fetching patient search user properties' },
        ),
      });
    }
  }, [fetchError, errorFetchingUserProperties, t]);

  const handleSubmit = useCallback(
    (submittedSearchTerm: string) => {
      const normalizedSearchTerm = submittedSearchTerm?.trim();

      if (shouldNavigateToPatientSearchPage && normalizedSearchTerm) {
        if (!isSearchPage) {
          globalThis.sessionStorage.setItem(
            'searchReturnUrl',
            `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`,
          );
        }
        navigate({
          to: `${globalThis.spaBase}/search?query=${encodeURIComponent(normalizedSearchTerm)}`,
        });
      }
    },
    [isSearchPage, shouldNavigateToPatientSearchPage],
  );

  const handleClear = useCallback(() => {
    setSearchTerm('');
  }, []);

  const handleSearchTermChange = (searchTerm: string) => setSearchTerm(limitPatientSearchTerm(searchTerm));

  return (
    <PatientSearchContext.Provider
      value={{
        patientClickSideEffect: addViewedPatientAndCloseSearchResults,
      }}
    >
      <div
        aria-label={t('patientSearch', 'Patient search')}
        className={styles.patientSearchBar}
        onKeyDown={handleKeyPress}
        role="group"
      >
        <PatientSearchBar
          isCompact
          initialSearchTerm={initialSearchTerm ?? ''}
          onChange={handleSearchTermChange}
          onSubmit={handleSubmit}
          onClear={handleClear}
          onInputFocus={resetFocusedResult}
          ref={searchInputRef}
        />

        {!isSearchPage && shouldSearch && (
          <div className={styles.floatingSearchResultsContainer} data-testid="floatingSearchResultsContainer">
            <PatientSearch query={debouncedSearchTerm} ref={bannerContainerRef} {...patientSearchResponse} />
          </div>
        )}

        {!isSearchPage && !hasCurrentSearchTerm && showRecentlySearchedPatients && (
          <div className={styles.floatingSearchResultsContainer} data-testid="floatingSearchResultsContainer">
            <RecentlySearchedPatients ref={bannerContainerRef} {...recentPatientSearchResponse} />
          </div>
        )}
      </div>
    </PatientSearchContext.Provider>
  );
};

export default CompactPatientSearchComponent;
