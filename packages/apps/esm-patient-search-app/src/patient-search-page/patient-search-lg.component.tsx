import { usePagination } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useLogPatientSearchError } from '../hooks/useLogPatientSearchError';
import type { SearchedPatient } from '../types';
import Pagination from '../ui-components/pagination/pagination.component';

import styles from './patient-search-lg.scss';
import { EmptyState, ErrorState, LoadingState, PatientSearchResults } from './patient-search-views.component';

interface PatientSearchComponentProps {
  query: string;
  inTabletOrOverlay?: boolean;
  stickyPagination?: boolean;
  searchResults: Array<SearchedPatient>;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  fetchError: Error | null;
  showAddPatient?: boolean;
}

const PatientSearchComponent: React.FC<PatientSearchComponentProps> = ({
  stickyPagination,
  inTabletOrOverlay,
  searchResults,
  isLoading,
  isValidating,
  hasMore,
  fetchError,
  query,
  showAddPatient = true,
}) => {
  const { t } = useTranslation();
  const resultsToShow = inTabletOrOverlay ? 15 : 20;
  const totalResults = searchResults.length;

  const { results, goTo, totalPages, currentPage, showNextButton, paginated } = usePagination(
    searchResults,
    resultsToShow,
  );
  const previousQuery = useRef(query);
  const lastValidPage = Math.max(1, totalPages);
  const isCurrentPageOutOfRange = currentPage > lastValidPage;
  const searchInProgress = isLoading || isValidating || hasMore || isCurrentPageOutOfRange;
  useLogPatientSearchError(fetchError, 'Patient search request failed');

  useEffect(() => {
    if (previousQuery.current !== query) {
      previousQuery.current = query;
      goTo(1);
    } else if (isCurrentPageOutOfRange) {
      goTo(lastValidPage);
    }
  }, [goTo, isCurrentPageOutOfRange, lastValidPage, query]);

  let searchResultsView: React.ReactNode;
  if (fetchError) {
    searchResultsView = <ErrorState />;
  } else if (searchInProgress && (!results || results.length === 0)) {
    searchResultsView = <LoadingState />;
  } else if (!results || results.length === 0) {
    searchResultsView = <EmptyState showAddPatient={showAddPatient} />;
  } else {
    searchResultsView = <PatientSearchResults searchResults={results} />;
  }

  return (
    <div
      className={classNames({
        [styles.searchResultsDesktop]: !inTabletOrOverlay,
        [styles.searchResultsTabletOrOverlay]: inTabletOrOverlay,
      })}
    >
      <div
        className={classNames({
          [styles.broadBottomMargin]: stickyPagination,
        })}
      >
        <h2
          className={classNames(styles.resultsHeader, styles.productiveHeading02, {
            [styles.leftPaddedResultHeader]: inTabletOrOverlay,
          })}
        >
          {searchInProgress
            ? t('searchingText', 'Searching...')
            : t('searchResultsCount', '{{count}} search result', {
                count: totalResults,
              })}
        </h2>
        {searchResultsView}
      </div>
      {paginated && !searchInProgress ? (
        <div
          className={classNames(styles.pagination, {
            [styles.stickyPagination]: stickyPagination,
          })}
        >
          <Pagination
            setCurrentPage={goTo}
            currentPage={currentPage}
            hasMore={showNextButton}
            totalPages={totalPages}
          />
        </div>
      ) : (
        <div className={styles.spacer} />
      )}
    </div>
  );
};

export default PatientSearchComponent;
