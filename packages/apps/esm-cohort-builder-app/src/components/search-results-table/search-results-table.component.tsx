import { DataTable, Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { usePagination } from '@openmrs/esm-framework';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mainStyle from '../../cohort-builder.scss';
import type { PaginationData, Patient } from '../../types';
import EmptyData from '../empty-data/empty-data.component';
import styles from './search-results-table.scss';

interface SearchResultsTableProps {
  patients: Patient[];
}

const SearchResultsTable: React.FC<SearchResultsTableProps> = ({ patients }) => {
  const [pageSize, setPageSize] = useState(10);
  const { t } = useTranslation();
  const { results: paginatedPatients, currentPage: page, goTo } = usePagination(patients, pageSize);
  const previousPatients = useRef(patients);

  useEffect(() => {
    if (previousPatients.current !== patients) {
      previousPatients.current = patients;
      goTo(1);
    }
  }, [patients, goTo]);

  const headers = [
    {
      key: 'id',
      header: t('openmrsId', 'OpenMRS ID'),
    },
    {
      key: 'name',
      header: t('name', 'Name'),
    },
    {
      key: 'age',
      header: t('age', 'Age'),
    },
    {
      key: 'gender',
      header: t('gender', 'Gender'),
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
      <p className={mainStyle.heading}>{t('searchResults', 'Search Results')}</p>
      <DataTable rows={paginatedPatients} headers={headers} useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TableRow key={key} {...rowProps}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>
      {patients.length > 10 && (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          itemsPerPageText={t('itemsPerPage', 'Items per page:')}
          onChange={handlePagination}
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          size="md"
          totalItems={patients.length}
        />
      )}
      {!patients.length && <EmptyData displayText={t('data', 'data')} />}
    </div>
  );
};

export default SearchResultsTable;
