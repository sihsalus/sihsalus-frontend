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
import { showModal } from '@openmrs/esm-framework';
import React, { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mainStyles from '../../cohort-builder.scss';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (isHistoryUpdated) {
      setSearchResults(getSearchHistory());
      setIsHistoryUpdated(false);
    }
  }, [isHistoryUpdated, setIsHistoryUpdated]);

  const handlePagination = ({ page, pageSize }: PaginationData) => {
    setPage(page);
    setPageSize(pageSize);
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
    window.sessionStorage.removeItem('openmrsHistory');
    setSearchResults([]);
  };

  const updateSearchHistory = (selectedSearchItem: SearchHistoryItem) => {
    const updatedSearchResults = [...searchResults].filter(
      (_searchResult, index) => index !== searchResults.indexOf(selectedSearchItem),
    );
    setSearchResults(updatedSearchResults);
    window.sessionStorage.setItem(
      'openmrsHistory',
      JSON.stringify(
        updatedSearchResults.map((searchResult) => ({
          description: searchResult.description,
          memberIds: searchResult.memberIds,
          parameters: searchResult.parameters,
        })),
      ),
    );
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
      <DataTable rows={searchResults} headers={headers} useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
                <TableHeader className={mainStyles.optionHeader}></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows
                .slice((page - 1) * pageSize)
                .slice(0, pageSize)
                .map((row, index: number) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className={mainStyles.optionCell}>
                      <SearchHistoryOptions
                        searchItem={searchResults[index]}
                        updateSearchHistory={updateSearchHistory}
                      />
                    </TableCell>
                  </TableRow>
                ))}
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
          page={1}
          pageSize={10}
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
