import { DataTable, Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { showSnackbar, usePagination } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mainStyles from '../../cohort-builder.scss';
import type { DefinitionDataRow, PaginationData } from '../../types';
import EmptyData from '../empty-data/empty-data.component';
import { deleteDataSet, getQueries } from './saved-queries.resources';
import styles from './saved-queries.scss';
import SavedQueriesOptions from './saved-queries-options/saved-queries-options.component';

interface SavedQueriesProps {
  onViewQuery: (queryId: string) => Promise<void>;
}

const SavedQueries: React.FC<SavedQueriesProps> = ({ onViewQuery }) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const [queries, setQueries] = useState<DefinitionDataRow[]>([]);
  const { results: paginatedQueries, currentPage: page, totalPages, goTo } = usePagination(queries, pageSize);

  useEffect(() => {
    if (page > totalPages) goTo(totalPages);
  }, [page, totalPages, goTo]);

  const getTableData = useCallback(async () => {
    const queries = await getQueries();
    setQueries(queries);
  }, []);

  const deleteQuery = async (queryId: string) => {
    try {
      await deleteDataSet(queryId);
      showSnackbar({
        title: t('success', 'Success'),
        kind: 'success',
        isLowContrast: true,
        subtitle: t('queryIsDeleted', 'the query is deleted'),
      });
      getTableData();
    } catch (error) {
      showSnackbar({
        title: t('error', 'Error'),
        kind: 'error',
        isLowContrast: false,
        subtitle: error?.message,
      });
    }
  };

  useEffect(() => {
    getTableData();
  }, [getTableData]);

  const headers = [
    {
      key: 'name',
      header: t('name', 'Name'),
    },
    {
      key: 'description',
      header: t('description', 'Description'),
    },
  ];

  const handlePagination = ({ page: nextPage, pageSize: nextPageSize }: PaginationData) => {
    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      goTo(1);
    } else {
      goTo(nextPage);
    }
  };

  return (
    <div className={styles.container}>
      <p className={mainStyles.text}>
        {t('savedQueryDescription', 'You can only search for Query Definitions that you have saved using a Name.')}
      </p>
      <DataTable rows={paginatedQueries} headers={headers} useZebraStyles>
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
              {rows.map((row) => {
                const query = queries.find(({ id }) => id === row.id);
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TableRow key={key} {...rowProps}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className={mainStyles.optionCell}>
                      {query && (
                        <SavedQueriesOptions query={query} onViewQuery={onViewQuery} deleteQuery={deleteQuery} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>
      {queries.length > 10 && (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          itemsPerPageText={t('itemsPerPage', 'Items per page:')}
          onChange={handlePagination}
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          size="md"
          totalItems={queries.length}
        />
      )}
      {!queries.length && <EmptyData displayText={t('queries', 'queries')} />}
    </div>
  );
};

export default SavedQueries;
