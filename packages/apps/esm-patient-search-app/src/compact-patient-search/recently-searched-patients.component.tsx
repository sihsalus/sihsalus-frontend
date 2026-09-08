import { InlineLoading, Layer, Loading, Tile } from '@carbon/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientSearchResponse } from '../types';
import EmptyDataIllustration from '../ui-components/empty-data-illustration.component';

import CompactPatientBanner from './compact-patient-banner.component';
import Loader from './loader.component';
import styles from './patient-search.scss';

interface RecentPatientSearchProps extends PatientSearchResponse {
  standalone?: boolean;
}

export const RecentPatientResults = React.forwardRef<HTMLDivElement, RecentPatientSearchProps>(
  ({ data: searchResults, fetchError, hasMore, isLoading, isValidating, setPage, standalone = false }, ref) => {
    const { t } = useTranslation();
    const observer = useRef(null);
    const resultsClassName = classNames(styles.searchResults, { [styles.standaloneResults]: standalone });

    const loadingIconRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (isValidating) {
          return;
        }
        if (observer.current) {
          observer.current.disconnect();
        }
        observer.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore) {
              setPage((page) => page + 1);
            }
          },
          {
            threshold: 0.75,
          },
        );
        if (node) {
          observer.current.observe(node);
        }
      },
      [isValidating, hasMore, setPage],
    );

    useEffect(() => {
      return () => {
        if (observer.current) {
          observer.current.disconnect();
        }
      };
    }, []);

    if (!searchResults && isLoading) {
      return (
        <div className={styles.searchResultsContainer} role="progressbar">
          {[...Array(5)].map((_, index) => (
            <Loader key={index} />
          ))}
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className={resultsClassName}>
          <Layer>
            <Tile className={styles.emptySearchResultsTile}>
              <EmptyDataIllustration />
              <div>
                <p className={styles.errorMessage}>{t('error', 'Error')}</p>
                <p className={styles.errorCopy}>
                  {t('errorCopy', 'Sorry, there was an error. Please try again or contact the site administrator.')}
                </p>
              </div>
            </Tile>
          </Layer>
        </div>
      );
    }

    if (searchResults?.length) {
      return (
        <div className={styles.searchResultsContainer}>
          <div className={resultsClassName}>
            <div className={styles.resultsText}>
              <span className={styles.resultsTextCount}>
                {t('recentlyViewedPatientsCount', '{{count}} recently viewed patient', {
                  count: searchResults.length,
                })}
              </span>
              {isValidating && (
                <span className={styles.validationIcon}>
                  <InlineLoading className={styles.spinner} />
                </span>
              )}
            </div>
            <CompactPatientBanner patients={searchResults} ref={ref} />
            {hasMore && (
              <div className={styles.loadingIcon} ref={loadingIconRef}>
                <Loading withOverlay={false} small />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!searchResults?.length) {
      return (
        <div className={styles.searchResultsContainer}>
          <div className={resultsClassName}>
            <Layer>
              <Tile className={styles.emptySearchResultsTile}>
                <EmptyDataIllustration />
                <p className={styles.emptyResultText}>
                  {t('noRecentlyViewedPatients', 'No recently viewed patient charts are available in this session.')}
                </p>
                <p className={styles.actionText}>
                  <span>
                    {t(
                      'recentlyViewedPatientsEmptyHelp',
                      'Open a patient chart from search, a queue, a visit or a direct link to see it here.',
                    )}
                  </span>
                </p>
              </Tile>
            </Layer>
          </div>
        </div>
      );
    }
  },
);

const RecentlySearchedPatients = React.forwardRef<HTMLDivElement, RecentPatientSearchProps>((props, ref) => {
  const { t } = useTranslation();
  return (
    <section aria-label={t('recentlyViewedPatients', 'Recently viewed patients')}>
      <h2 className={styles.recentPatientsHeading}>{t('recentlyViewedPatients', 'Recently viewed patients')}</h2>
      <p className={styles.recentPatientsHelp}>
        {t(
          'recentlyViewedPatientsHelp',
          'The last 10 patient charts opened in this tab, from any entry point. Reopen a chart while waiting for results.',
        )}
      </p>
      <RecentPatientResults {...props} ref={ref} />
    </section>
  );
});

export default RecentlySearchedPatients;
