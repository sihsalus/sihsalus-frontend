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
import React, { useMemo, useState } from 'react';

import styles from './paginated-clinical-data.scss';

const StyledTableCell: React.FC<{ interpretation: unknown; children: React.ReactNode }> = ({
  interpretation,
  children,
}) => {
  switch (interpretation) {
    case 'critically_high':
      return <TableCell className={styles.criticallyHigh}>{children}</TableCell>;
    case 'critically_low':
      return <TableCell className={styles.criticallyLow}>{children}</TableCell>;
    case 'high':
      return <TableCell className={styles.high}>{children}</TableCell>;
    case 'low':
      return <TableCell className={styles.low}>{children}</TableCell>;
    default:
      return <TableCell>{children}</TableCell>;
  }
};

interface PaginatedTableRow {
  id: string;
  [key: string]: string | number | React.ReactNode;
}

interface PaginatedTableHeader {
  key: string;
  header: string;
  isSortable?: boolean;
  sortFunc?: (a: PaginatedTableRow, b: PaginatedTableRow) => number;
}

interface PaginatedClinicalDataProps {
  isPrinting?: boolean;
  pageSize: number;
  tableHeaders: Array<PaginatedTableHeader>;
  tableRows: Array<PaginatedTableRow>;
}

const PaginatedClinicalData: React.FC<PaginatedClinicalDataProps> = ({
  isPrinting,
  pageSize,
  tableHeaders,
  tableRows,
}) => {
  const isTablet = useLayoutType() === 'tablet';

  const [sortParams, setSortParams] = useState<{ key: string; sortDirection: 'ASC' | 'DESC' | 'NONE' }>({
    key: '',
    sortDirection: 'NONE',
  });

  const handleSorting = (
    _cellA,
    _cellB,
    { key, sortDirection }: { key: string; sortDirection: 'ASC' | 'DESC' | 'NONE' },
  ): number => {
    if (sortDirection === 'NONE') {
      setSortParams({ key: '', sortDirection });
    } else {
      setSortParams({ key, sortDirection });
    }

    return 0;
  };

  function getTableHeaderContent(header: React.ReactNode): React.ReactNode {
    if (typeof header === 'object' && header !== null && 'content' in header) {
      return (header as { content?: React.ReactNode }).content ?? '';
    }

    return header;
  }

  function getTableCellContent(cellValue: React.ReactNode): React.ReactNode {
    if (cellValue && typeof cellValue === 'object' && 'content' in cellValue) {
      return (cellValue as { content?: React.ReactNode }).content ?? '';
    }

    return cellValue ?? '';
  }

  const sortedData = useMemo(() => {
    if (sortParams.sortDirection === 'NONE') {
      return tableRows;
    }

    const header = tableHeaders.find((header) => header.key === sortParams.key);

    if (!header || !header.sortFunc) {
      return tableRows;
    }

    const sortedRows = tableRows.slice().sort((rowA, rowB) => {
      const sortingNum = header.sortFunc(rowA, rowB);
      return sortParams.sortDirection === 'DESC' ? sortingNum : -sortingNum;
    });

    return sortedRows;
  }, [tableHeaders, tableRows, sortParams]);

  const { results: paginatedData, goTo, currentPage } = usePagination(sortedData, pageSize);

  const rows = isPrinting ? sortedData : paginatedData;

  return (
    <>
      <DataTable
        rows={rows}
        headers={tableHeaders}
        size={isTablet ? 'lg' : 'sm'}
        useZebraStyles
        sortRow={handleSorting}
        isSortable
      >
        {({ rows, headers, getTableProps, getHeaderProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table className={styles.table} aria-label="clinical-data" {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header, isSortable: header.isSortable })} key={header.key}>
                      {getTableHeaderContent(header.header)}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const dataObj = paginatedData.find((obj) => obj.id === row.id);
                  return (
                    <TableRow key={row.id}>
                      {row.cells.map((cell) => {
                        const interpretationKey = `${cell.id.substring(2)}Interpretation`;
                        const vitalSignInterpretation = dataObj && dataObj[interpretationKey];
                        return (
                          <StyledTableCell key={`styled-cell-${cell.id}`} interpretation={vitalSignInterpretation}>
                            {getTableCellContent(cell.value)}
                          </StyledTableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {!isPrinting ? (
        <PatientChartPagination
          pageNumber={currentPage}
          totalItems={tableRows.length}
          currentItems={paginatedData.length}
          pageSize={pageSize}
          onPageNumberChange={({ page }) => goTo(page)}
        />
      ) : null}
    </>
  );
};

export default PaginatedClinicalData;
