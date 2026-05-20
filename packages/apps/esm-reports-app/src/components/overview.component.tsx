import {
  Button,
  Checkbox,
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
import { Calendar, Download, Play, Save, TrashCan, View } from '@carbon/react/icons';
import {
  ExtensionSlot,
  isDesktop,
  navigate,
  showModal,
  showSnackbar,
  useConfig,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';
import { PRIVILEGE_SYSTEM_DEVELOPER } from '../constants';
import { closeOverlay, launchOverlay } from '../hooks/useOverlay';

import Overlay from './overlay.component';
import { DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZES } from './pagination-constants';
import ReportOverviewButton from './report-overview-button.component';
import ReportStatus from './report-status.component';
import { COMPLETED, RAN_REPORT_STATUSES, SAVED } from './report-statuses-constants';
import { downloadMultipleReports, downloadReport, preserveReport, useReports } from './reports.resource';
import styles from './reports.scss';
import RunReportForm from './run-report/run-report-form.component';

const OverviewComponent: React.FC = () => {
  const { t } = useTranslation();
  const currentSession = useSession();
  const { webPreviewViewReportUrl } = useConfig<ConfigObject>();

  const [checkedReportUuidsArray, setCheckedReportUuidsArray] = useState([]);
  const [downloadReportButtonVisible, setDownloadReportButtonVisible] = useState(false);

  useEffect(() => {
    setDownloadReportButtonVisible(checkedReportUuidsArray.length > 0);
  }, [checkedReportUuidsArray]);

  const tableHeaders = useMemo(
    () => [
      { key: 'reportName', header: t('reportName', 'Report name') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'requestedBy', header: t('requestedBy', 'Requested by') },
      { key: 'requestedOn', header: t('requestedOn', 'Requested on') },
      { key: 'outputFormat', header: t('outputFormat', 'Output format') },
      { key: 'parameters', header: t('parameters', 'Parameters') },
      { key: 'actions', header: t('actions', 'Actions') },
    ],
    [t],
  );

  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE_NUMBER);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { reports, reportsTotalCount, mutateReports } = useReports(
    RAN_REPORT_STATUSES.join(','),
    currentPage,
    pageSize,
  );

  const layout = useLayoutType();

  function getReportStatus(row) {
    return row?.cells.find((cell) => cell.info?.header === 'status')?.value;
  }

  function getReportOutputFormat(row) {
    return row?.cells.find((cell) => cell.info?.header === 'outputFormat')?.value;
  }

  function shouldShowDownloadButton(row) {
    const outputFormat = getReportOutputFormat(row);
    const status = getReportStatus(row);
    const isWebPreviewWithUrl = outputFormat === 'Web Preview' && webPreviewViewReportUrl;

    // Don't show download button for web preview when we have a view URL
    if (isWebPreviewWithUrl) {
      return false;
    }

    return status === COMPLETED || status === SAVED;
  }

  function shouldShowViewButton(row) {
    const outputFormat = getReportOutputFormat(row);
    const status = getReportStatus(row);

    return outputFormat === 'Web Preview' && webPreviewViewReportUrl && (status === COMPLETED || status === SAVED);
  }

  function isCurrentUserTheSameAsReportRequestedByUser(reportRequestUuid: string) {
    const report = reports.find((tableRow) => tableRow.id === reportRequestUuid);
    const requestedByUserUuid = report?.requestedByUserUuid;
    const currentUserUuid = currentSession?.user.uuid;

    return requestedByUserUuid === currentUserUuid;
  }

  function isSystemDeveloperUser() {
    return userHasAccess(PRIVILEGE_SYSTEM_DEVELOPER, currentSession.user);
  }

  function isEligibleReportUser(reportRequestUuid: string) {
    return isCurrentUserTheSameAsReportRequestedByUser(reportRequestUuid) || isSystemDeveloperUser();
  }

  function renderRowCheckbox(row, index) {
    const statusCell = row?.cells.find((cell) => cell.info?.header === 'status');
    const statusValue = statusCell?.value;
    if (statusValue === COMPLETED || statusValue === SAVED) {
      return (
        <td className={classNames({ [styles.rowCellEven]: index % 2 === 0, [styles.rowCellOdd]: index % 2 !== 0 })}>
          <Checkbox
            id={`checkbox-${row.id}`}
            labelText=""
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleOnCheckboxClick(e)}
            checked={checkedReportUuidsArray.includes(row.id)}
          />
        </td>
      );
    } else {
      return (
        <td
          className={classNames({ [styles.rowCellEven]: index % 2 === 0, [styles.rowCellOdd]: index % 2 !== 0 })}
        ></td>
      );
    }
  }

  function handleOnCheckboxClick(event) {
    const checkboxElement = event?.target;
    const checkboxId = checkboxElement.id;
    const reportUuid = checkboxId.slice(checkboxId.indexOf('-') + 1);
    const isChecked = checkboxElement?.checked;

    setCheckedReportUuidsArray((prevState) => {
      if (isChecked && !prevState.includes(reportUuid)) {
        return [...prevState, reportUuid];
      } else {
        return prevState.filter((checkedReportUuid) => checkedReportUuid !== reportUuid);
      }
    });
  }

  const handlePreserveReport = useCallback(
    async (reportRequestUuid: string) => {
      preserveReport(reportRequestUuid)
        .then(() => {
          mutateReports();
          showSnackbar({
            kind: 'success',
            title: t('preserveReport', 'Preserve report'),
            subtitle: t('reportPreservedSuccessfully', 'Report preserved successfully'),
          });
        })
        .catch(() => {
          showSnackbar({
            kind: 'error',
            title: t('preserveReport', 'Preserve report'),
            subtitle: t('reportPreservingErrorMsg', 'Error during report preserving'),
          });
        });
    },
    [mutateReports, t],
  );

  const launchDeleteReportDialog = (reportRequestUuid: string) => {
    const dispose = showModal('cancel-report-modal', {
      closeModal: () => {
        dispose();
        mutateReports();
      },
      reportRequestUuid,
      modalType: 'delete',
    });
  };

  const handleViewReport = useCallback(
    (reportRequestUuid: string) => {
      if (!webPreviewViewReportUrl) {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('noWebPreviewUrlConfigured', 'No web preview URL configured.'),
          kind: 'error',
        });
        return;
      }

      try {
        // Basic URL validation
        new URL(webPreviewViewReportUrl.replace('{reportRequestUuid}', 'placeholder'));
      } catch {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('invalidWebPreviewUrl', 'Configured web preview URL is invalid.'),
          kind: 'error',
        });
        return;
      }

      if (!webPreviewViewReportUrl.includes('{reportRequestUuid}')) {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('missingPlaceholder', 'Configured web preview URL must include {reportRequestUuid} placeholder.'),
          kind: 'error',
        });
        return;
      }

      const viewUrl = webPreviewViewReportUrl.replace('{reportRequestUuid}', reportRequestUuid);
      globalThis.open(viewUrl, '_blank', 'noopener,noreferrer');
    },
    [webPreviewViewReportUrl, t],
  );

  async function handleDownloadReport(reportRequestUuid: string) {
    try {
      const response = await downloadReport(reportRequestUuid);
      if (isDownloadableFile(response)) {
        processAndDownloadFile(response);
      }
      clearReportCheckboxes();
      showSnackbar({
        kind: 'success',
        title: t('reportDownloaded', 'Report downloaded'),
        subtitle: t('reportDownloadedSuccessfully', 'Report downloaded successfully'),
      });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorDownloadingReport', 'Error downloading report'),
        subtitle: error?.message,
      });
    }
  }

  async function handleDownloadMultipleReports(reportRequestUuids: string[]) {
    try {
      const response = await downloadMultipleReports(reportRequestUuids);
      if (Array.isArray(response)) {
        response.forEach((file) => {
          processAndDownloadFile(file);
        });
      }
      clearReportCheckboxes();
      showSnackbar({
        kind: 'success',
        title: t('reportsDownloaded', 'Reports downloaded'),
        subtitle: t('reportsDownloadedSuccessfully', 'Reports downloaded successfully'),
      });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorDownloadingReports', 'Error downloading reports'),
        subtitle: error?.message,
      });
    }
  }

  function processAndDownloadFile(file: { fileContent: string; fileName: string; mimeType: string }) {
    const decodedData = globalThis.atob(file.fileContent);
    const byteArray = new Uint8Array(decodedData.length);
    for (let i = 0; i < decodedData.length; i++) {
      byteArray[i] = decodedData.charCodeAt(i);
    }
    const url = globalThis.URL.createObjectURL(new Blob([byteArray]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const clearReportCheckboxes = () => {
    setCheckedReportUuidsArray([]);
  };

  return (
    <div>
      <ExtensionSlot name="breadcrumbs-slot" className={styles.breadcrumb} />
      <div className={styles.mainPanelDiv}>
        <div className={styles.reportsLabelDiv}>
          <h3>{t('reports', 'Reports')}</h3>
        </div>
        <div className={styles.mainActionButtonsDiv}>
          <Button
            kind="ghost"
            renderIcon={() => <Download size={16} className={styles.actionButtonIcon} />}
            iconDescription="Download reports"
            onClick={() => handleDownloadMultipleReports(checkedReportUuidsArray)}
            className={classNames(styles.mainActionButton, {
              [styles.downloadReportsVisible]: downloadReportButtonVisible,
              [styles.downloadReportsHidden]: !downloadReportButtonVisible,
            })}
          >
            {t('downloadReports', 'Download reports')}
          </Button>
          <Button
            kind="ghost"
            renderIcon={() => <Play size={16} className={styles.actionButtonIcon} />}
            iconDescription="Run reports"
            onClick={() => {
              launchOverlay(
                t('runReport', 'Run Report'),
                <RunReportForm
                  closePanel={() => {
                    closeOverlay();
                    mutateReports();
                  }}
                />,
              );
            }}
            className={styles.mainActionButton}
          >
            {t('runReports', 'Run reports')}
          </Button>
          <Overlay />
          <Button
            className={styles.mainActionButton}
            iconDescription="Report schedule"
            kind="ghost"
            onClick={() => navigate({ to: `${globalThis.spaBase}/reports/scheduled-overview` })}
            renderIcon={() => <Calendar size={16} className={styles.actionButtonIcon} />}
          >
            {t('reportSchedule', 'Report schedule')}
          </Button>
          <Button
            className={styles.mainActionButton}
            iconDescription="Report schedule"
            kind="ghost"
            onClick={() => navigate({ to: `${globalThis.spaBase}/reports/reports-data-overview` })}
            renderIcon={() => <Calendar size={16} className={styles.actionButtonIcon} />}
          >
            {t('viewReports', 'Reports Webview')}
          </Button>
        </div>
      </div>
      <DataTable rows={reports} headers={tableHeaders} isSortable>
        {({ rows, headers }) => (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <th></th>
                  {headers.map((header) => (
                    <TableHeader key={header.key}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow className={styles.tableRow} key={index}>
                    {renderRowCheckbox(row, index)}
                    {row.cells.map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={classNames({
                          [styles.rowCellEven]: index % 2 === 0,
                          [styles.rowCellOdd]: index % 2 !== 0,
                        })}
                      >
                        {cell.info.header === 'actions' ? (
                          <div className={styles.actionsContainer}>
                            <ReportOverviewButton
                              icon={() => <View size={16} className={styles.actionButtonIcon} />}
                              label={t('view', 'View')}
                              onClick={() => handleViewReport(row.id)}
                              reportRequestUuid={row.id}
                              shouldBeDisplayed={shouldShowViewButton(row)}
                            />
                            <ReportOverviewButton
                              icon={() => <Download size={16} className={styles.actionButtonIcon} />}
                              label={t('download', 'Download')}
                              onClick={() => handleDownloadReport(row.id)}
                              reportRequestUuid={row.id}
                              shouldBeDisplayed={shouldShowDownloadButton(row)}
                            />
                            <ReportOverviewButton
                              icon={() => <Save size={16} className={styles.actionButtonIcon} />}
                              label={t('preserve', 'Preserve')}
                              onClick={() => handlePreserveReport(row.id)}
                              reportRequestUuid={row.id}
                              shouldBeDisplayed={getReportStatus(row) === COMPLETED && isEligibleReportUser(row.id)}
                            />
                            <ReportOverviewButton
                              icon={() => <TrashCan size={16} className={styles.actionButtonIcon} />}
                              label={t('delete', 'Delete')}
                              onClick={() => launchDeleteReportDialog(row.id)}
                              reportRequestUuid={row.id}
                              shouldBeDisplayed={isEligibleReportUser(row.id)}
                            />
                          </div>
                        ) : cell.info.header === 'status' ? (
                          <div>
                            <ReportStatus status={cell.value} />
                          </div>
                        ) : cell.info.header === 'reportName' ? (
                          <div>{cell.value?.content ?? cell.value}</div>
                        ) : (
                          (cell.value?.content ?? cell.value)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {reports.length > 0 ? (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          onChange={({ pageSize: newPageSize, page: newPage }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }

            if (newPage !== currentPage) {
              setCurrentPage(newPage);
            }
          }}
          page={currentPage}
          pageSize={pageSize}
          pageSizes={DEFAULT_PAGE_SIZES}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          totalItems={reportsTotalCount}
        />
      ) : null}
    </div>
  );
};

function isDownloadableFile(value: unknown): value is { fileContent: string; fileName: string; mimeType: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fileContent' in value &&
    typeof value.fileContent === 'string' &&
    'fileName' in value &&
    typeof value.fileName === 'string' &&
    'mimeType' in value &&
    typeof value.mimeType === 'string'
  );
}

export default OverviewComponent;
