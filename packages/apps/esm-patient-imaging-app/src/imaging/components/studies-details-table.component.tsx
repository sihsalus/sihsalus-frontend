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
import React, { useMemo, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import ohifview from '../../assets/ohifViewer.png';
import orthancExplorer from '../../assets/orthanc.png';
import stoneview from '../../assets/stoneViewer.png';
import { type DicomStudy, getBrowserUrl } from '../../types';
import { studiesCount, studyDeleteConfirmationDialog } from '../constants';
import { buildURL } from '../utils/help';
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
  const displayText = t('studiesNoFoundMessage', 'No studies found');
  const headerTitle = t('Studies', 'Studies');
  const [studyDateFilter, setStudyDateFilter] = useState<string>('');
  const [studyDescFilter, setStudyDescFilter] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState({});
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const shouldOnClickBeCalled = useRef(true);
  const studyMap = useRef<Map<string, DicomStudy>>(new Map());

  const launchDeleteStudyDialog = (studyId: number) => {
    const dispose = showModal(studyDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      studyId,
      patientUuid,
    });
  };

  const filterStudies = useMemo(() => {
    return studies.filter((study) => {
      const matchStudyDate = studyDateFilter
        ? study.studyDate.toLowerCase().includes(studyDateFilter.toLowerCase())
        : true;

      const matchStudyDesc = studyDescFilter
        ? study.studyDescription.toLowerCase().includes(studyDescFilter.toLowerCase())
        : true;

      return matchStudyDate && matchStudyDesc;
    });
  }, [studies, studyDateFilter, studyDescFilter]);

  const { results, goTo, currentPage } = usePagination(filterStudies, studiesCount);

  studies?.forEach((study) => {
    studyMap.current.set(String(study.id), study);
  });

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
    studyInstanceUID: <div className={styles.wrapText}>{study.studyInstanceUID}</div>,
    patientName: {
      sortKey: study.patientName,
      content: (
        <div className={'patientColumn'}>
          <span>{study.patientName}</span>
        </div>
      ),
    },
    studyDate: (
      <div className={'studyDateColumn'}>
        <span>{study.studyDate}</span>
      </div>
    ),
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
              onClick={() => {
                shouldOnClickBeCalled.current = false;
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
            label={t('stoneviewer', 'Stone viewer of Orthanc')}
            onClick={() =>
              (globalThis.location.href = buildURL(
                getBrowserUrl(study.orthancConfiguration),
                '/stone-webviewer/index.html',
                [{ code: 'study', value: study.studyInstanceUID }],
              ))
            }
          >
            <img alt="" className="stone-img" src={stoneview} style={{ width: 23, height: 14, marginTop: 4 }} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('ohifviewer', 'Ohif viewer')}
            onClick={() =>
              (globalThis.location.href = buildURL(getBrowserUrl(study.orthancConfiguration), '/ohif/viewer', [
                { code: 'StudyInstanceUIDs', value: study.studyInstanceUID },
              ]))
            }
          >
            <img alt="" className="ohif-img" src={ohifview} style={{ width: 26, height: 26, marginTop: 0 }} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('orthancExplorer2', 'Show data in orthanc explorer')}
            onClick={
              () =>
                (globalThis.location.href = buildURL(
                  getBrowserUrl(study.orthancConfiguration),
                  '/ui/app/#/filtered-studies',
                  [
                    { code: 'StudyInstanceUID', value: study.studyInstanceUID },
                    { code: 'expand', value: 'series' },
                  ],
                ))

              // `${getBrowserUrl(study.orthancConfiguration)}/ui/app/#/filtered-studies?StudyInstanceUID=${study.studyInstanceUID}&expand=series`)
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
      ? compare(cellB.sortKey, cellA.sortKey)
      : compare(cellA.sortKey, cellB.sortKey);
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
              onChange={(e) => setStudyDateFilter(e.target.value)}
              className={styles.filterInput}
            />
            <input
              type="text"
              placeholder={t('filterByStudyDescription', 'Filter by study description')}
              value={studyDescFilter}
              onChange={(e) => setStudyDescFilter(e.target.value)}
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
              <Table aria-label="Studies summary" className={styles.table} {...getTableProps()}>
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
                    const studyData = studyMap.current.get(row.id);
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
          totalItems={studies.length}
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
