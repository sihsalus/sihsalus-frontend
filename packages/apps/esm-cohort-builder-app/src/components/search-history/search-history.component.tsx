import {
  Button,
  DataTable,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { showModal, usePagination } from '@openmrs/esm-framework';
import React, { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mainStyles from '../../cohort-builder.scss';
import { clearStoredSearchHistory, removeStoredSearchHistoryEntry } from '../../search-history-store';
import { type PaginationData, type SearchHistoryItem } from '../../types';
import EmptyData from '../empty-data/empty-data.component';
import styles from './search-history.style.scss';
import { getSearchHistory } from './search-history.utils';
import SearchHistoryOptions from './search-history-options/search-history-options.component';

interface SearchHistoryProps {
  isHistoryUpdated: boolean;
  setIsHistoryUpdated: Dispatch<SetStateAction<boolean>>;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ isHistoryUpdated, setIsHistoryUpdated }) => {
  const { t } = useTranslation();
  const [searchResults, setSearchResults] = useState<SearchHistoryItem[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const { results: visibleResults, currentPage: page, totalPages, goTo } = usePagination(searchResults, pageSize);

  useEffect(() => {
    if (page > totalPages) goTo(totalPages);
  }, [page, totalPages, goTo]);

  useEffect(() => {
    if (isHistoryUpdated) {
      setSearchResults(getSearchHistory());
      setIsHistoryUpdated(false);
    }
  }, [isHistoryUpdated, setIsHistoryUpdated]);

  const handlePagination = ({ page: nextPage, pageSize: nextPageSize }: PaginationData) => {
    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      goTo(1);
    } else {
      goTo(nextPage);
    }
  };

  const headers = [
    {
      key: 'id',
      header: '#',
    },
    {
      key: 'description',
      header: t('query', 'Query'),
    },
    {
      key: 'results',
      header: t('results', 'Results'),
    },
  ];

  const clearHistory = () => {
    clearStoredSearchHistory();
    setSearchResults([]);
  };

  const updateSearchHistory = (selectedSearchItem: SearchHistoryItem) => {
    try {
      removeStoredSearchHistoryEntry(selectedSearchItem.historyKey);
    } finally {
      // Re-read even after a stale confirmation, preserving searches added meanwhile.
      setSearchResults(getSearchHistory());
    }
  };

  const launchClearSearchHistoryModal = () => {
    const dispose = showModal('clear-search-history-modal', {
      closeModal: () => dispose(),
      onClearHistory: clearHistory,
      size: 'sm',
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={mainStyles.heading}>{t('searchHistory', 'Search History')}</p>
        {searchResults.length > 0 && (
          <Button kind="danger--tertiary" onClick={launchClearSearchHistoryModal}>
            {t('clearSearchHistory', 'Clear search history')}
          </Button>
        )}
      </div>
      <DataTable rows={visibleResults} headers={headers} useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => {
                  const { key, ...headerProps } = getHeaderProps({ header });
                  return (
                    <TableHeader key={key} {...headerProps}>
                      {header.header}
                    </TableHeader>
                  );
                })}
                <TableHeader className={mainStyles.optionHeader}></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const searchItem = visibleResults.find((item) => item.id === row.id);
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TableRow key={key} {...rowProps}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className={mainStyles.optionCell}>
                      {searchItem && (
                        <SearchHistoryOptions searchItem={searchItem} updateSearchHistory={updateSearchHistory} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>
      {searchResults.length > 10 && (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          itemsPerPageText={t('itemsPerPage', 'Items per page:')}
          onChange={handlePagination}
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          size="md"
          totalItems={searchResults.length}
        />
      )}
      {!searchResults.length && <EmptyData displayText={t('data', 'data')} />}
    </div>
  );
};

export default SearchHistory;
