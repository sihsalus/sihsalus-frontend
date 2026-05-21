import {
  Column,
  DataTable,
  DataTableSkeleton,
  Grid,
  Pagination,
  PaginationSkeleton,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ErrorState, formatDatetime, usePagination } from '@openmrs/esm-framework';
import React, { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Import } from '../types';

import ImportOverview from './import-overview/import-overview.component';
import { usePreviousImports } from './previous-imports.resource';
import styles from './previous-imports.scss';

const PreviousImports: React.FC = () => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);

  const { data: prevImports, isLoading, error } = usePreviousImports();
  const { results, currentPage, goTo } = usePagination(prevImports, pageSize);

  if (isLoading) {
    return (
      <Grid className={styles.grid}>
        <Column sm={4} md={8} lg={10}>
          <SkeletonText className={styles.productiveHeading03} />
          <DataTableSkeleton showHeader={false} showToolbar={false} rowCount={10} columnCount={3} />
          <PaginationSkeleton />
        </Column>
      </Grid>
    );
  }

  if (error) {
    return <ErrorState headerTitle={t('previousImports', 'Previous Imports')} error={error} />;
  }

  const headerData = [
    {
      header: t('dateAndTime', 'Date and Time'),
      key: 'localDateStarted',
    },
    {
      header: t('duration', 'Duration'),
      key: 'importTime',
    },
    {
      header: t('status', 'Status'),
      key: 'status',
    },
  ];

  const rowData = results?.map((prevImport) => {
    return {
      id: prevImport.uuid,
      localDateStarted: formatDatetime(new Date(prevImport.localDateStarted)),
      importTime: prevImport.importTime,
      status: prevImport.status,
    };
  });

  return (
    <Grid className={styles.grid}>
      <Column sm={4} md={8} lg={10}>
        <h3 className={styles.productiveHeading03}>{t('previousImports', 'Previous Imports')}</h3>

        <DataTable rows={rowData} headers={headerData} size="sm">
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <Table {...getTableProps()} className={styles.tableBordered}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader />
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });

                  return (
                    <Fragment key={row.id}>
                      <TableExpandRow key={key} {...rowProps} className={styles.tableRow}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableExpandRow>
                      {row.isExpanded && (
                        <TableExpandedRow colSpan={headers.length + 1} className={styles.tableExpandedRow}>
                          <ImportOverview
                            selectedImportObject={prevImports.find((importItem: Import) => importItem.uuid === row.id)}
                          />
                        </TableExpandedRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTable>
        <Pagination
          className={styles.pagination}
          size="sm"
          page={currentPage}
          pageSize={pageSize}
          pageSizes={[10, 20, 50, 100]}
          totalItems={prevImports?.length ?? 0}
          onChange={({ page, pageSize }) => {
            goTo(page);
            setPageSize(pageSize);
          }}
        />
      </Column>
    </Grid>
  );
};

export default PreviousImports;
