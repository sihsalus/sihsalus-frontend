import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useLayoutType, usePagination } from '@openmrs/esm-framework';
import { PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import styles from './paginated-vitals.scss';
import type { VitalsTableHeader, VitalsTableRow } from './types';

type DataTableCellValue = React.ReactNode | { content?: React.ReactNode };
type SortParams = { key: string; sortDirection: 'ASC' | 'DESC' | 'NONE' };
type VitalsInterpretationKey = Extract<
  keyof VitalsTableRow,
  | 'bloodPressureRenderInterpretation'
  | 'pulseRenderInterpretation'
  | 'respiratoryRateRenderInterpretation'
  | 'spo2RenderInterpretation'
  | 'temperatureRenderInterpretation'
>;

interface PaginatedVitalsProps {
  isPrinting?: boolean;
  pageSize: number;
  pageUrl: string;
  tableHeaders: Array<VitalsTableHeader>;
  tableRows: Array<VitalsTableRow>;
  urlLabel: string;
  patient?: fhir.Patient;
}

const PaginatedVitals: React.FC<PaginatedVitalsProps> = ({
  isPrinting,
  pageSize,
  pageUrl,
  tableHeaders,
  tableRows,
  urlLabel,
}) => {
  const isTablet = useLayoutType() === 'tablet';
  const interpretationKeyByHeaderKey: Partial<Record<VitalsTableHeader['key'], VitalsInterpretationKey>> = {
    bloodPressureRender: 'bloodPressureRenderInterpretation',
    pulseRender: 'pulseRenderInterpretation',
    respiratoryRateRender: 'respiratoryRateRenderInterpretation',
    spo2Render: 'spo2RenderInterpretation',
    temperatureRender: 'temperatureRenderInterpretation',
  };

  const renderHeader = (header: React.ReactNode | { content?: React.ReactNode }): React.ReactNode => {
    if (typeof header === 'object' && header !== null && 'content' in header) {
      return header.content ?? null;
    }

    return header as React.ReactNode;
  };

  const getCellInterpretation = (row: VitalsTableRow | undefined, headerKey: VitalsTableHeader['key']) => {
    const interpretationKey = interpretationKeyByHeaderKey[headerKey];
    return interpretationKey ? row?.[interpretationKey] : undefined;
  };

  const StyledTableCell = ({ interpretation, children }: { interpretation?: string; children: React.ReactNode }) => {
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

  const sortedData: Array<VitalsTableRow> = useMemo(() => {
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
  }, [tableHeaders, tableRows, sortParams]);

  const { results: paginatedVitals, goTo, currentPage } = usePagination(sortedData, pageSize);

  const displayRows = isPrinting ? sortedData : paginatedVitals;
  const displayRowsById = useMemo(() => new Map(displayRows.map((row) => [row.id, row])), [displayRows]);

  const hasAnyNotes = tableRows.some((row) => Boolean(row.note));

  return (
    <>
      <DataTable
        rows={displayRows}
        headers={tableHeaders}
        size={isTablet ? 'lg' : 'sm'}
        useZebraStyles
        sortRow={handleSorting}
        isSortable
      >
        {({ rows: dataTableRows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table className={styles.table} aria-label="vitals" {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {hasAnyNotes && <TableExpandHeader />}
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header, isSortable: header.isSortable });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {renderHeader(header.header)}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {dataTableRows.map((row) => {
                  const vitalsObj = displayRowsById.get(row.id);
                  const note = vitalsObj?.note;

                  if (hasAnyNotes) {
                    const { key: rowKey, ...rowProps } = getRowProps({ row });
                    return (
                      <React.Fragment key={rowKey}>
                        <TableExpandRow {...rowProps}>
                          {row.cells.map((cell, cellIndex) => {
                            const headerKey = headers[cellIndex]?.key as VitalsTableHeader['key'];
                            const vitalSignInterpretation = getCellInterpretation(vitalsObj, headerKey);

                            return (
                              <StyledTableCell key={`styled-cell-${cell.id}`} interpretation={vitalSignInterpretation}>
                                {cell.value?.content ?? cell.value}
                              </StyledTableCell>
                            );
                          })}
                        </TableExpandRow>
                        <TableExpandedRow colSpan={headers.length + 1}>{note ? <p>{note}</p> : null}</TableExpandedRow>
                      </React.Fragment>
                    );
                  }

                  return (
                    <TableRow key={row.id}>
                      {row.cells.map((cell, cellIndex) => {
                        const headerKey = headers[cellIndex]?.key as VitalsTableHeader['key'];
                        const vitalSignInterpretation = getCellInterpretation(vitalsObj, headerKey);

                        return (
                          <StyledTableCell key={`styled-cell-${cell.id}`} interpretation={vitalSignInterpretation}>
                            {cell.value?.content ?? cell.value}
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
          currentItems={paginatedVitals.length}
          pageSize={pageSize}
          onPageNumberChange={({ page }) => goTo(page)}
          dashboardLinkUrl={pageUrl}
          dashboardLinkLabel={urlLabel}
        />
      ) : null}
    </>
  );
};

export default PaginatedVitals;
