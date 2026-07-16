import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useLayoutType, usePagination } from '@openmrs/esm-framework';
import { PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import styles from './paginated-biometrics.scss';
import type { BiometricsTableHeader, BiometricsTableRow } from './types';

type DataTableCellValue = React.ReactNode | { content?: React.ReactNode };
type SortParams = { key: string; sortDirection: 'ASC' | 'DESC' | 'NONE' };

interface PaginatedBiometricsProps {
  tableRows: Array<BiometricsTableRow>;
  pageSize: number;
  pageUrl: string;
  urlLabel: string;
  tableHeaders: Array<BiometricsTableHeader>;
  /** Whether the server has more observation pages beyond the rows loaded so far */
  hasMoreData?: boolean;
  isLoadingMoreData?: boolean;
  onLoadMoreData?: () => void;
}

const PaginatedBiometrics: React.FC<PaginatedBiometricsProps> = ({
  tableRows,
  pageSize,
  pageUrl,
  urlLabel,
  tableHeaders,
  hasMoreData,
  isLoadingMoreData,
  onLoadMoreData,
}) => {
  const isTablet = useLayoutType() === 'tablet';
  const renderHeader = (header: React.ReactNode | { content?: React.ReactNode }): React.ReactNode => {
    if (typeof header === 'object' && header !== null && 'content' in header) {
      return header.content ?? null;
    }

    return header as React.ReactNode;
  };

  const [sortParams, setSortParams] = useState<SortParams>({
    key: '',
    sortDirection: 'NONE',
  });
  const pendingSortParamsRef = useRef<SortParams | null>(null);

  useEffect(() => {
    const pendingSortParams = pendingSortParamsRef.current;

    if (
      pendingSortParams &&
      (pendingSortParams.key !== sortParams.key || pendingSortParams.sortDirection !== sortParams.sortDirection)
    ) {
      setSortParams(pendingSortParams);
    }

    pendingSortParamsRef.current = null;
  });

  const handleSorting = (
    _cellA: DataTableCellValue,
    _cellB: DataTableCellValue,
    { key, sortDirection }: SortParams,
  ) => {
    pendingSortParamsRef.current = sortDirection === 'NONE' ? { key: '', sortDirection } : { key, sortDirection };
    return 0;
  };

  const sortedData: Array<BiometricsTableRow> = useMemo(() => {
    if (sortParams.sortDirection === 'NONE') {
      return tableRows;
    }

    const header = tableHeaders.find((header) => header.key === sortParams.key);

    if (!header) {
      return tableRows;
    }

    const sortedRows = tableRows.slice().sort((rowA, rowB) => {
      const sortingNum = header.sortFunc(rowA, rowB);
      return sortParams.sortDirection === 'DESC' ? sortingNum : -sortingNum;
    });

    return sortedRows;
  }, [tableRows, tableHeaders, sortParams]);

  const { results: paginatedBiometrics, goTo, currentPage } = usePagination(sortedData, pageSize);

  // The history is truncated to the FHIR pages loaded so far; when the user reaches the
  // last locally-available page, request the next server page so records keep appearing.
  const lastLocalPage = Math.max(1, Math.ceil(sortedData.length / pageSize));
  useEffect(() => {
    if (onLoadMoreData && hasMoreData && !isLoadingMoreData && currentPage >= lastLocalPage) {
      onLoadMoreData();
    }
  }, [currentPage, lastLocalPage, hasMoreData, isLoadingMoreData, onLoadMoreData]);

  return (
    <>
      <DataTable
        rows={paginatedBiometrics}
        headers={tableHeaders}
        size={isTablet ? 'lg' : 'sm'}
        useZebraStyles
        sortRow={handleSorting}
        isSortable
      >
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table aria-label="biometrics" className={styles.table} {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({
                      header,
                      isSortable: header.isSortable,
                    });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {renderHeader(header.header)}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        pageNumber={currentPage}
        totalItems={tableRows.length}
        currentItems={paginatedBiometrics.length}
        pageSize={pageSize}
        onPageNumberChange={({ page }) => goTo(page)}
        dashboardLinkUrl={pageUrl}
        dashboardLinkLabel={urlLabel}
      />
    </>
  );
};

export default PaginatedBiometrics;
