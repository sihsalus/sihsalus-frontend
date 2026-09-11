import {
  DataTable,
  InlineLoading,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { showModal, TrashCanIcon, useLayoutType, usePagination } from '@openmrs/esm-framework';

import { compare, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudySeries } from '../../api';
import orthancExplorer from '../../assets/orthanc.png';
import stoneview from '../../assets/stoneViewer.png';
import { type OrthancConfiguration } from '../../types';
import { seriesCount, seriesDeleteConfirmationDialog } from '../constants';
import { buildOhifViewerUrl, buildOrthancExplorerUrl, openInNewWindow } from '../utils/help';
import { useImagingAccess } from '../utils/use-imaging-access';
import { usePaginationBounds } from '../utils/use-pagination-bounds';
import styles from './details-table.scss';
import InstancesDetailsTable from './instances-details-table.component';

export interface SeriesDetailsTableProps {
  studyId: number;
  studyInstanceUID: string;
  patientUuid: string;
  orthancConfig: OrthancConfiguration;
}

const SeriesDetailsTable: React.FC<SeriesDetailsTableProps> = ({
  studyId,
  studyInstanceUID,
  patientUuid,
  orthancConfig,
}) => {
  const { data: seriesList, error, isLoading } = useStudySeries(studyId);

  const { t } = useTranslation();
  const { canWrite, isOnline } = useImagingAccess();
  const displayText = t('NoSeriesAvailable', 'No series available');
  const headerTitle = t('series', 'Series');
  const { results, goTo, currentPage, totalPages } = usePagination(seriesList ?? [], seriesCount);
  usePaginationBounds({ currentPage, totalPages, goTo });
  const [expandedRows, setExpandedRows] = useState({});
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const seriesMap = new Map((results ?? []).map((series) => [String(series.seriesInstanceUID), series]));

  const launchDeleteSeriesDialog = (orthancSeriesUID: string, studyId: number) => {
    const dispose = showModal(seriesDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      orthancSeriesUID,
      studyId,
      patientUuid,
    });
  };

  const tableHeaders = [
    { key: 'seriesInstanceUID', header: t('seriesUID', 'Series UID'), isSortable: true },
    { key: 'modality', header: t('modality', 'Modality'), isSortable: true },
    { key: 'seriesDate', header: t('seriesDate', 'Series date'), isSortable: true, isVisible: true },
    { key: 'seriesDescription', header: t('description', 'description'), isSortable: true },
    { key: 'action', header: t('action', 'Action'), isSortable: false },
  ];

  const tableRows = results?.map((series) => ({
    id: series.seriesInstanceUID,
    seriesInstanceUID: {
      sortKey: series.seriesInstanceUID,
      content: <div className={styles.subTableWrapText}>{series.seriesInstanceUID}</div>,
    },
    modality: series.modality,
    seriesDate: {
      sortKey: series.seriesDate,
      content: (
        <div className={'seriesDateColumn'}>
          <span>{series.seriesDate}</span>
        </div>
      ),
    },
    seriesDescription: series.seriesDescription,
    action: {
      content: (
        <div className="seriesActionDiv" style={{ display: 'flex' }}>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('removeSeries', 'Remove series')}
            disabled={!canWrite}
            onClick={() => {
              launchDeleteSeriesDialog(series.orthancSeriesUID, studyId);
            }}
          >
            <TrashCanIcon className={styles.removeButton} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={
              buildOhifViewerUrl([], orthancConfig)
                ? t('stoneviewer', 'Show image')
                : t('viewerUnavailable', 'Viewer unavailable for this imaging server')
            }
            disabled={!isOnline || !buildOhifViewerUrl([], orthancConfig)}
            onClick={() =>
              openInNewWindow(
                buildOhifViewerUrl(
                  [
                    { code: 'StudyInstanceUIDs', value: studyInstanceUID },
                    { code: 'SeriesInstanceUIDs', value: series.seriesInstanceUID },
                  ],
                  orthancConfig,
                ),
              )
            }
          >
            <img alt="" className="stone-img" src={stoneview} style={{ width: 23, height: 14, marginTop: 4 }} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('orthancExplorer2', 'Open in Orthanc')}
            disabled={!isOnline}
            onClick={() =>
              openInNewWindow(
                buildOrthancExplorerUrl(orthancConfig, [
                  { code: 'StudyInstanceUID', value: studyInstanceUID },
                  { code: 'expand', value: 'series' },
                ]),
              )
            }
          >
            <img alt="" className="orthanc-img" src={orthancExplorer} style={{ width: 26, height: 26, marginTop: 0 }} />
          </IconButton>
        </div>
      ),
    },
  }));

  const sortRow = (cellA, cellB, { sortDirection, sortStates }) => {
    return sortDirection === sortStates.DESC
      ? compare(cellB?.sortKey ?? cellB, cellA?.sortKey ?? cellA)
      : compare(cellA?.sortKey ?? cellA, cellB?.sortKey ?? cellB);
  };

  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;
  if (isLoading) return <InlineLoading description={t('loadingSeries', 'Loading series...')} />;

  if (seriesList?.length) {
    return (
      <div className={'dataTableDiv'}>
        <DataTable
          rows={tableRows}
          headers={tableHeaders}
          sortRow={sortRow}
          isSortable
          useZebraStyles
          data-floating-menu-container
          size={isTablet ? 'lg' : 'sm'}
        >
          {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
            <TableContainer>
              <Table aria-label={t('seriesSummary', 'Series summary')} className={styles.table} {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });
                      return (
                        <TableHeader key={key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                    <TableHeader />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const seriesData = seriesMap.get(row.id);
                    const isExpanded = expandedRows[row.id];
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className={styles.row}
                          {...getRowProps({ row })}
                          onDoubleClick={() =>
                            setExpandedRows((prev) => ({
                              ...prev,
                              [row.id]: !prev[row.id],
                            }))
                          }
                        >
                          {row.cells.map((cell) => (
                            <TableCell
                              className={styles.tableCell}
                              key={cell.id}
                              style={cell.id === 'action' ? { width: '15%' } : { width: '22%' }}
                            >
                              {cell.value?.content ?? cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isExpanded && seriesData && (
                          <TableRow className={styles.expandedRow}>
                            <TableCell colSpan={headers.length}>
                              <div className={styles.instanceTableDiv}>
                                <InstancesDetailsTable
                                  studyId={studyId}
                                  studyInstanceUID={studyInstanceUID}
                                  seriesInstanceUID={seriesData.seriesInstanceUID}
                                  orthancConfig={orthancConfig}
                                  seriesModality={seriesData.modality}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
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
          totalItems={seriesList.length}
          currentItems={results.length}
          pageSize={seriesCount}
          onPageNumberChange={({ page }) => goTo(page)}
        />
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};

export default SeriesDetailsTable;
