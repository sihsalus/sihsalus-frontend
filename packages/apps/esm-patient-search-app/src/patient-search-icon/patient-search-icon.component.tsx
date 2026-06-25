import { HeaderGlobalAction } from '@carbon/react';
import { Close, Search } from '@carbon/react/icons';
import { isDesktop, navigate, useLayoutType, useOnClickOutside } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import CompactPatientSearchComponent from '../compact-patient-search/compact-patient-search.component';
import PatientSearchOverlay from '../patient-search-overlay/patient-search-overlay.component';
import { getPatientSearchReturnUrl } from '../search-return-url';

import styles from './patient-search-icon.scss';

interface PatientSearchLaunchProps {}

const PatientSearchLaunch: React.FC<PatientSearchLaunchProps> = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { page } = useParams();
  const isSearchPage = useMemo(() => page === 'search', [page]);
  const [searchParams] = useSearchParams();
  const initialSearchTerm = isSearchPage ? searchParams.get('query') : '';

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [canClickOutside, setCanClickOutside] = useState(false);

  const handleCloseSearchInput = useCallback(() => {
    // Clicking outside of the search input when "/search" page is open should not close the search input.
    // In tabletView, the overlay should be closed when the overlay's back button (<-) is clicked
    if (isDesktop(layout) && !isSearchPage) {
      setShowSearchInput(false);
    }
  }, [isSearchPage, layout]);

  const ref = useOnClickOutside<HTMLDivElement>(handleCloseSearchInput, canClickOutside);

  const closePatientSearch = useCallback(() => {
    if (isSearchPage) {
      navigate({
        to: getPatientSearchReturnUrl(),
      });
      globalThis.sessionStorage.removeItem('searchReturnUrl');
    }
    setShowSearchInput(false);
  }, [isSearchPage]);

  const handleShowSearchInput = useCallback(() => {
    setShowSearchInput(true);
  }, []);

  const resetToInitialState = useCallback(() => {
    setShowSearchInput(false);
    setCanClickOutside(false);
  }, []);

  useEffect(() => {
    // Search input should always be open when we direct to the search page.
    setShowSearchInput(isSearchPage);
  }, [isSearchPage]);

  useEffect(() => {
    if (showSearchInput) {
      if (isSearchPage) {
        setCanClickOutside(false);
      } else {
        setCanClickOutside(true);
      }
    } else {
      setCanClickOutside(false);
    }
  }, [showSearchInput, isSearchPage]);

  return (
    <div className={styles.patientSearchIconWrapper} ref={ref}>
      {showSearchInput ? (
        <>
          {isDesktop(layout) ? (
            /* CompactPatientSearchComponent provides the search context */
            <CompactPatientSearchComponent
              isSearchPage={isSearchPage}
              initialSearchTerm={initialSearchTerm}
              shouldNavigateToPatientSearchPage
              onPatientSelect={resetToInitialState}
            />
          ) : (
            <PatientSearchOverlay
              onClose={closePatientSearch}
              query={initialSearchTerm}
              patientClickSideEffect={closePatientSearch}
            />
          )}
          <div className={styles.closeButton}>
            <HeaderGlobalAction
              aria-label={t('closeSearch', 'Close Search Panel')}
              className={styles.activeSearchIconButton}
              data-testid="closeSearchIcon"
              onClick={closePatientSearch}
            >
              <Close size={20} />
            </HeaderGlobalAction>
          </div>
        </>
      ) : (
        <div data-testid="searchPatientIcon">
          <HeaderGlobalAction
            aria-label={t('searchPatient', 'Search patient')}
            className={styles.searchIconButton}
            onClick={handleShowSearchInput}
          >
            <Search size={20} />
          </HeaderGlobalAction>
        </div>
      )}
    </div>
  );
};

export default PatientSearchLaunch;
