/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { formatDate, formatTime, parseDate, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { orderBy } from 'lodash-es';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PatientNote } from '../types';
import styles from './notes-overview.scss';

interface PaginatedNotesProps {
  notes: Array<PatientNote>;
  pageSize: number;
  pageUrl: string;
  urlLabel: string;
}

const renderText = (value: unknown) => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && 'display' in value) {
    return renderText((value as { display?: unknown }).display);
  }
  return '';
};

const PaginatedNotes: React.FC<PaginatedNotesProps> = ({ notes, pageSize, pageUrl, urlLabel }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';

  const [sortParams, setSortParams] = useState({ key: '', order: 'none' });

  const tableHeaders = [
    {
      key: 'encounterDate',
      header: t('date', 'Date'),
    },
    {
      key: 'diagnoses',
      header: t('diagnoses', 'Diagnoses'),
    },
  ];

  const sortDate = (myArray, order) =>
    order === 'ASC'
      ? orderBy(myArray, [(obj) => new Date(obj.encounterDate).getTime()], ['desc'])
      : orderBy(myArray, [(obj) => new Date(obj.encounterDate).getTime()], ['asc']);

  const { key, order } = sortParams;

  const sortedData =
    key === 'encounterDate'
      ? sortDate(notes, order)
      : order === 'DESC'
        ? orderBy(notes, [key], ['desc'])
        : orderBy(notes, [key], ['asc']);

  function customSortRow(
    _cellA,
    _cellB,
    {
      sortDirection,
      sortStates,
    }: {
      sortDirection: string;
      sortStates: any;
      locale: string;
    },
  ) {
    const key = Object.keys(sortStates).find((k) => sortStates[k] === sortDirection);
    setSortParams({ key: key ?? '', order: sortDirection });
    return 0;
  }

  const { results: paginatedNotes, goTo, currentPage } = usePagination(sortedData, pageSize);
  const tableRows = React.useMemo(
    () =>
      paginatedNotes?.map((note) => ({
        ...note,
        id: `${note.id}`,
        encounterDate: formatDate(parseDate(note.encounterDate), { mode: 'wide' }),
        diagnoses: renderText(note.diagnoses) || '--',
        encounterNote: renderText(note.encounterNote),
        encounterProvider: renderText(note.encounterProvider),
        encounterProviderRole: renderText(note.encounterProviderRole),
      })),
    [paginatedNotes],
  );

  return (
    <>
      <DataTable
        rows={tableRows}
        sortRow={customSortRow}
        headers={tableHeaders}
        isSortable
        size={isTablet ? 'lg' : 'sm'}
        useZebraStyles
      >
        {({
          getExpandedRowProps,
          getExpandHeaderProps,
          getHeaderProps,
          getRowProps,
          getTableContainerProps,
          getTableProps,
          headers,
          rows,
        }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader
                        key={key}
                        className={classNames(styles.productiveHeading01, styles.text02)}
                        {...headerProps}
                      >
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  const { key, ...rowProps } = getRowProps({ row });

                  return (
                    <React.Fragment key={row.id}>
                      <TableExpandRow key={key} {...rowProps}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{renderText(cell.value)}</TableCell>
                        ))}
                      </TableExpandRow>
                      {row.isExpanded ? (
                        <TableExpandedRow
                          className={styles.expandedRow}
                          colSpan={headers.length + 1}
                          {...getExpandedRowProps({ row })}
                        >
                          <div className={styles.container} key={i}>
                            {tableRows?.[i]?.encounterNote ? (
                              <div className={styles.copy}>
                                <span className={styles.content}>{tableRows?.[i]?.encounterNote}</span>
                                <span className={styles.metadata}>
                                  {formatTime(new Date(tableRows?.[i]?.encounterNoteRecordedAt))} &middot;{' '}
                                  {tableRows?.[i]?.encounterProvider}, {tableRows?.[i]?.encounterProviderRole}
                                </span>
                              </div>
                            ) : (
                              <span className={styles.copy}>
                                {t('noVisitNoteToDisplay', 'No visit note to display')}
                              </span>
                            )}
                          </div>
                        </TableExpandedRow>
                      ) : (
                        <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        pageNumber={currentPage}
        totalItems={notes.length}
        currentItems={paginatedNotes.length}
        pageSize={pageSize}
        onPageNumberChange={({ page }) => goTo(page)}
        dashboardLinkUrl={pageUrl}
        dashboardLinkLabel={urlLabel}
      />
    </>
  );
};

export default PaginatedNotes;
