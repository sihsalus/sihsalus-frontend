import { DataTable, Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { showSnackbar, usePagination } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mainStyles from '../../cohort-builder.scss';
import type { PaginationData } from '../../types';
import EmptyData from '../empty-data/empty-data.component';
import { onDeleteCohort, useCohorts } from './saved-cohorts.resources';
import styles from './saved-cohorts.scss';
import SavedCohortsOptions from './saved-cohorts-options/saved-cohorts-options.component';

interface SavedCohortsProps {
  onViewCohort: (queryId: string) => Promise<void>;
}

const SavedCohorts: React.FC<SavedCohortsProps> = ({ onViewCohort }) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const { cohorts } = useCohorts();
  const { results: paginatedCohorts, currentPage: page, totalPages, goTo } = usePagination(cohorts, pageSize);

  useEffect(() => {
    if (page > totalPages) goTo(totalPages);
  }, [page, totalPages, goTo]);

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

  const handleDeleteCohort = async (cohortId: string) => {
    try {
      await onDeleteCohort(cohortId);
      showSnackbar({
        title: t('cohortDeleted', 'Cohort deleted'),
        kind: 'success',
        isLowContrast: true,
        subtitle: t('cohortDeleted', 'Cohort deleted'),
      });
    } catch (error) {
      showSnackbar({
        title: t('error', 'Error'),
        kind: 'error',
        isLowContrast: false,
        subtitle: error?.message,
      });
    }
  };

  return (
    <div className={styles.container}>
      <p className={mainStyles.text}>
        {t('savedCohortDescription', 'You can only search for Cohort Definitions that you have saved using a Name.')}
      </p>
      <DataTable rows={paginatedCohorts} headers={headers} useZebraStyles>
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
                const cohort = cohorts.find(({ id }) => id === row.id);
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TableRow key={key} {...rowProps}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className={mainStyles.optionCell}>
                      {cohort && (
                        <SavedCohortsOptions
                          cohort={cohort}
                          onViewCohort={onViewCohort}
                          onDeleteCohort={handleDeleteCohort}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>
      {cohorts?.length > 10 && (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          itemsPerPageText={t('itemsPerPage', 'Items per page:')}
          onChange={handlePagination}
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          size="md"
          totalItems={cohorts.length}
        />
      )}
      {!cohorts?.length && <EmptyData displayText={t('cohorts', 'cohorts')} />}
    </div>
  );
};

export default SavedCohorts;
