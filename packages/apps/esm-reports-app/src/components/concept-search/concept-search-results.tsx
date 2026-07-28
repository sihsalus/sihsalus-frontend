import { Button, ButtonSkeleton, SkeletonText, Tile } from '@carbon/react';
import { useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import { useConceptSearch } from '../../hooks/use-concept-search';

import styles from './concept-search-results.scss';

export interface ConceptSearchResultsProps {
  searchTerm: string;
  focusAndClearSearchInput: () => void;
  onConceptSelect?: (concept: { uuid: string; display?: string }) => void;
}

export default function ConceptSearchResults({
  searchTerm,
  focusAndClearSearchInput,
  onConceptSelect,
}: ConceptSearchResultsProps) {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { concepts, isLoading, error } = useConceptSearch(searchTerm);

  if (!searchTerm) {
    return null;
  }

  if (isLoading) {
    return <ConceptSearchSkeleton />;
  }

  if (error) {
    return (
      <Tile className={styles.emptyState}>
        <div>
          <h4 className={styles.productiveHeading01}>
            {t('errorFetchingConceptResults', 'Error fetching results for "{{searchTerm}}"', {
              searchTerm,
            })}
          </h4>
          <p className={styles.bodyShort01}>
            <span>{t('trySearchingAgain', 'Please try searching again')}</span>
          </p>
        </div>
      </Tile>
    );
  }

  if (concepts?.length === 0) {
    return (
      <Tile className={styles.emptyState}>
        <div>
          <h4 className={styles.productiveHeading01}>
            {t('noResultsForConceptSearch', 'No results to display for "{{searchTerm}}"', {
              searchTerm,
            })}
          </h4>
          <p className={styles.bodyShort01}>
            <span>{t('tryTo', 'Try to')}</span>{' '}
            <span className={styles.link} role="link" tabIndex={0} onClick={focusAndClearSearchInput}>
              {t('searchAgain', 'search again')}
            </span>{' '}
            <span>{t('usingADifferentTerm', 'using a different term')}</span>
          </p>
        </div>
      </Tile>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.conceptBasketSearchResultsHeader}>
        <span className={styles.searchResultsCount}>
          {t('searchResultsMatchesForTerm', '{{count}} results for "{{searchTerm}}"', {
            count: concepts?.length,
            searchTerm,
          })}
        </span>
        <Button kind="ghost" onClick={focusAndClearSearchInput} size={isTablet ? 'md' : 'sm'}>
          {t('clearSearchResults', 'Clear Results')}
        </Button>
      </div>
      <div
        className={styles.resultsContainer}
        role="listbox"
        aria-label={t('conceptSearchResults', 'Concept search results')}
      >
        {concepts?.map((concept, _index) => (
          <div
            key={concept.uuid}
            role="option"
            tabIndex={0}
            aria-selected={false}
            onClick={() => {
              onConceptSelect?.(concept);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onConceptSelect?.(concept);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {concept.display}
          </div>
        ))}
      </div>
    </div>
  );
}

const ConceptSearchSkeleton = () => {
  const isTablet = useLayoutType() === 'tablet';
  const tileClassName = classNames({
    [styles.tabletSearchResultTile]: isTablet,
    [styles.desktopSearchResultTile]: !isTablet,
    [styles.skeletonTile]: true,
  });
  const buttonSize = isTablet ? 'md' : 'sm';

  return (
    <div className={styles.searchResultSkeletonWrapper}>
      <div className={styles.conceptBasketSearchResultsHeader}>
        <SkeletonText className={styles.searchResultCntSkeleton} />
        <ButtonSkeleton size={buttonSize} />
      </div>
      {[...Array(4)].map((_, index) => (
        <Tile key={index} className={tileClassName}>
          <SkeletonText />
        </Tile>
      ))}
    </div>
  );
};
