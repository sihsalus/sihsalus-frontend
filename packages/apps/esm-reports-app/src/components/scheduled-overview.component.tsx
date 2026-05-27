import {
  DataTable,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ExtensionSlot, isDesktop, useLayoutType, usePagination } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Overlay from './overlay.component';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZES } from './pagination-constants';
import { type ScheduledReportModel, useScheduledReports } from './reports.resource';
import styles from './reports.scss';
import ScheduledOverviewCellContent from './scheduled-overview-cell-content.component';

interface ScheduledReportActions {
  reportDefinitionUuid: string;
  reportRequestUuid: string;
}

type ScheduledReportTableColumnValues = [string, boolean, string, string, ScheduledReportActions];

interface ScheduledReportTableRow {
  id: string;
  name: string;
  status: boolean;
  schedule: string;
  nextRun: string;
  actions: ScheduledReportActions;
}

function toScheduledReportRow(report: ScheduledReportModel): ScheduledReportTableRow {
  const schedule = report.schedule ?? '';

  return {
    id: report.reportRequestUuid ? report.reportRequestUuid : report.reportDefinitionUuid,
    name: report.name,
    status: !!report.reportRequestUuid,
    schedule,
    nextRun: schedule,
    actions: {
      reportDefinitionUuid: report.reportDefinitionUuid,
      reportRequestUuid: report.reportRequestUuid ?? '',
    },
  };
}

const ScheduledOverviewComponent: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();

  const { scheduledReports, mutateScheduledReports } = useScheduledReports('name');
  const scheduledReportRows: ScheduledReportTableRow[] = scheduledReports
    ? scheduledReports.map(toScheduledReportRow)
    : [];

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { currentPage, results, goTo } = usePagination(scheduledReportRows, pageSize);

  const tableHeaders = useMemo(
    () => [
      { key: 'name', header: t('reportName', 'Report name') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'schedule', header: t('schedule', 'Schedule') },
      { key: 'nextRun', header: t('nextRun', 'Next run') },
      { key: 'actions', header: t('actions', 'Actions') },
    ],
    [t],
  );

  return (
    <div>
      <ExtensionSlot name="breadcrumbs-slot" className={styles.breadcrumb} />
      <div className={styles.mainPanelDiv}>
        <div className={styles.reportsLabelDiv}>
          <h3>{t('scheduledReports', 'Scheduld Reports')}</h3>
        </div>
        <div className={styles.mainActionButtonsDiv}></div>
        <DataTable<ScheduledReportTableRow, ScheduledReportTableColumnValues>
          rows={results}
          headers={tableHeaders}
          isSortable={false}
        >
          {({ rows, headers }) => (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {headers.map((header, index) => (
                      <TableHeader key={header.key ?? `header-${index}`}>{header.header}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id ?? `row-${index}`} className={styles.tableRow}>
                      {row.cells.map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={classNames({
                            [styles.rowCellEven]: index % 2 === 0,
                            [styles.rowCellOdd]: index % 2 !== 0,
                          })}
                        >
                          <ScheduledOverviewCellContent cell={cell} mutate={mutateScheduledReports} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          page={currentPage}
          pageSize={pageSize}
          pageSizes={DEFAULT_PAGE_SIZES}
          totalItems={scheduledReports?.length}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          onChange={({ pageSize: newPageSize, page: newPage }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }

            if (newPage !== currentPage) {
              goTo(newPage);
            }
          }}
        />
      </div>
      <Overlay />
    </div>
  );
};

export default ScheduledOverviewComponent;
