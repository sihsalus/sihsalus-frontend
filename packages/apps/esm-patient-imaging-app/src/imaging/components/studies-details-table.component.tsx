import {
  DataTable,
  IconButton,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { showModal, TrashCanIcon, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { CardHeader, compare, EmptyState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import ohifview from '../../assets/ohifViewer.png';
import orthancExplorer from '../../assets/orthanc.png';
import stoneview from '../../assets/stoneViewer.png';
import { type DicomStudy } from '../../types';
import { studiesCount, studyDeleteConfirmationDialog } from '../constants';
import { buildOhifViewerUrl, buildOrthancExplorerUrl, openInNewWindow } from '../utils/help';
import { useImagingAccess } from '../utils/use-imaging-access';
import { usePaginationBounds } from '../utils/use-pagination-bounds';
import styles from './details-table.scss';
import SeriesDetailsTable from './series-details-table.component';

export interface StudyDetailsTableProps {
  isValidating?: boolean;
  studies?: Array<DicomStudy> | null;
  showDeleteButton?: boolean;
  patientUuid: string;
}

const StudiesDetailTable: React.FC<StudyDetailsTableProps> = ({
  isValidating,
  studies,
  showDeleteButton,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const { canWrite, isOnline } = useImagingAccess();
  const displayText = t('studiesNoFoundMessage', 'No studies found');
  const headerTitle = t('Studies', 'Studies');
  const [studyDateFilter, setStudyDateFilter] = useState<string>('');
  const [studyDescFilter, setStudyDescFilter] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState({});
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const studyMap = new Map((studies ?? []).map((study) => [String(study.id), study]));

  const launchDeleteStudyDialog = (studyId: number) => {
    const dispose = showModal(studyDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      studyId,
      patientUuid,
    });
  };

  const filterStudies = useMemo(() => {
    return (studies ?? []).filter((study) => {
      const matchStudyDate = studyDateFilter
        ? (study.studyDate ?? '').toLowerCase().includes(studyDateFilter.toLowerCase())
        : true;

      const matchStudyDesc = studyDescFilter
        ? (study.studyDescription ?? '').toLowerCase().includes(studyDescFilter.toLowerCase())
        : true;

      return matchStudyDate && matchStudyDesc;
    });
  }, [studies, studyDateFilter, studyDescFilter]);

  const { results, goTo, currentPage, totalPages } = usePagination(filterStudies, studiesCount);
  usePaginationBounds({ currentPage, totalPages, goTo });

  const tableHeaders = useMemo(
    () => [
      { key: 'studyInstanceUID', header: t('studyInstanceUID', 'Study instance UID'), isSortable: true },
      { key: 'patientName', header: t('patientName', 'Patient name'), isSortable: true },
      { key: 'studyDate', header: t('studyDate', 'Study date'), isSortable: true },
      { key: 'studyDescription', header: t('description', 'description'), isSortable: true },
      { key: 'orthancConfiguration', header: t('orthancBaseUrl', 'The configured Orthanc Url'), isSortable: true },
      { key: 'action', header: t('action', 'Action'), isSortable: false },
    ],
    [t],
  );

  const tableRows = results?.map((study) => ({
    id: study.id.toString(),
    studyInstanceUID: {
      sortKey: study.studyInstanceUID,
      content: <div className={styles.wrapText}>{study.studyInstanceUID}</div>,
    },
    patientName: {
      sortKey: study.patientName,
      content: (
        <div className={'patientColumn'}>
          <span>{study.patientName}</span>
        </div>
      ),
    },
    studyDate: {
      sortKey: study.studyDate,
      content: (
        <div className={'studyDateColumn'}>
          <span>{study.studyDate}</span>
        </div>
      ),
    },
    studyDescription: study.studyDescription,
    orthancConfiguration: study.orthancConfiguration.orthancBaseUrl,
    action: {
      content: (
        <div className="studiesActionDiv" style={{ display: 'flex' }}>
          {showDeleteButton && (
            <IconButton
              kind="ghost"
              align="left"
              size={isTablet ? 'lg' : 'sm'}
              label={t('removeStudy', 'Remove study')}
              disabled={!canWrite}
              onClick={() => {
                launchDeleteStudyDialog(study.id);
              }}
            >
              <TrashCanIcon className={styles.removeButton} />
            </IconButton>
          )}
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={
              buildOhifViewerUrl([], study.orthancConfiguration)
                ? t('stoneviewer', 'Show image')
                : t('viewerUnavailable', 'Viewer unavailable for this imaging server')
            }
            disabled={!isOnline || !buildOhifViewerUrl([], study.orthancConfiguration)}
            onClick={() =>
              openInNewWindow(
                buildOhifViewerUrl(
                  [{ code: 'StudyInstanceUIDs', value: study.studyInstanceUID }],
                  study.orthancConfiguration,
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
            label={t('ohifviewer', 'Show image data')}
            disabled={!isOnline}
            onClick={() =>
              openInNewWindow(
                buildOrthancExplorerUrl(study.orthancConfiguration, [
                  { code: 'StudyInstanceUID', value: study.studyInstanceUID },
                  { code: 'expand', value: 'series' },
                ]),
              )
            }
          >
            <img alt="" className="ohif-img" src={ohifview} style={{ width: 26, height: 26, marginTop: 0 }} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('orthancExplorer2', 'Open in Orthanc')}
            disabled={!isOnline}
            onClick={() =>
              openInNewWindow(
                buildOrthancExplorerUrl(study.orthancConfiguration, [
                  { code: 'StudyInstanceUID', value: study.studyInstanceUID },
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

  if (studies && studies?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          <div className={styles.filterContainer}>
            <input
              style={{ marginRight: '20px' }}
              type="text"
              placeholder={t('filterByStudyDate', 'Filter by study date')}
              value={studyDateFilter}
              onChange={(e) => {
                setStudyDateFilter(e.target.value);
                goTo(1);
              }}
              className={styles.filterInput}
            />
            <input
              type="text"
              placeholder={t('filterByStudyDescription', 'Filter by study description')}
              value={studyDescFilter}
              onChange={(e) => {
                setStudyDescFilter(e.target.value);
                goTo(1);
              }}
              className={styles.filterInput}
            />
          </div>
        </CardHeader>
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
              <Table aria-label={t('studiesSummary', 'Studies summary')} className={styles.table} {...getTableProps()}>
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
                    const isExpanded = expandedRows[row.id];
                    const studyData = studyMap.get(row.id);
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
                            <TableCell className={styles.tableCell} key={cell.id}>
                              {cell.value?.content ?? cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isExpanded && studyData && (
                          <TableRow className={styles.expandedRow}>
                            <TableCell colSpan={headers.length}>
                              <div className={styles.seriesTableDiv}>
                                <SeriesDetailsTable
                                  studyId={studyData.id}
                                  studyInstanceUID={studyData.studyInstanceUID}
                                  patientUuid={patientUuid}
                                  orthancConfig={studyData.orthancConfiguration}
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
          data-testid="pagination"
          pageNumber={currentPage}
          totalItems={filterStudies.length}
          currentItems={results.length}
          pageSize={studiesCount}
          onPageNumberChange={({ page }) => goTo(page)}
        />
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};

export default StudiesDetailTable;
