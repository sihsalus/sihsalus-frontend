import {
  DataTable,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useLayoutType, usePagination } from '@openmrs/esm-framework';
import { compare, EmptyState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import ohifview from '../../assets/ohifViewer.png';
import stoneview from '../../assets/stoneViewer.png';
import { type DicomStudy, type StudiesWithScores } from '../../types';
import { studiesCount } from '../constants';
import { buildOhifViewerUrl, buildOrthancExplorerUrl, openInNewWindow } from '../utils/help';
import { useImagingAccess } from '../utils/use-imaging-access';
import { usePaginationBounds } from '../utils/use-pagination-bounds';
import styles from './details-table.scss';
import SeriesDetailsTable from './series-details-table.component';

export interface AssignStudiesTableProps {
  data?: StudiesWithScores | null;
  patientUuid: string;
  isPending?: boolean;

  assignStudyFunction: (study: DicomStudy, isAssign: boolean) => Promise<boolean>;
}

const AssignStudiesTable: React.FC<AssignStudiesTableProps> = ({
  data,
  patientUuid,
  isPending = false,
  assignStudyFunction,
}) => {
  const { t } = useTranslation();
  const { canWrite, isOnline } = useImagingAccess();
  const displayText = t('studiesNoFoundMessage', 'No studies found');
  const headerTitle = t('Studies', 'Studies');
  const { results, goTo, currentPage, totalPages } = usePagination(data?.studies ?? [], studiesCount);
  usePaginationBounds({ currentPage, totalPages, goTo });
  const [expandedRows, setExpandedRows] = useState({});
  const [assignedStudies, setAssignedStudies] = useState<Record<number, boolean>>({});
  const [pendingStudies, setPendingStudies] = useState<Set<number>>(new Set());
  const pending = useRef(new Set<number>());
  const context = useRef(patientUuid);
  context.current = patientUuid;
  useEffect(() => {
    pending.current = new Set();
    setPendingStudies(new Set());
    setAssignedStudies({});
    return () => {
      pending.current = new Set();
    };
  }, [patientUuid]);
  useEffect(() => setAssignedStudies({}), [data]);
  const studiesById = new Map((data?.studies ?? []).map((study) => [String(study.id), study]));
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';

  const getStudyScore = ({ study, data }: { study: DicomStudy; data: StudiesWithScores }) => {
    if (data.scores instanceof Map) {
      return data.scores.get(study.studyInstanceUID);
    }
    return data.scores?.[study.studyInstanceUID] ?? undefined;
  };

  const studyAssignStatus = ({ study }: { study: DicomStudy }) => {
    return assignedStudies[study.id] ?? (!!study.mrsPatientUuid && study.mrsPatientUuid === patientUuid);
  };

  const handleAssignChange = async (study: DicomStudy, checked: boolean) => {
    if (!canWrite || pending.current.has(study.id) || (study.mrsPatientUuid && study.mrsPatientUuid !== patientUuid))
      return;
    const requests = pending.current;
    requests.add(study.id);
    setPendingStudies(new Set(requests));
    try {
      const succeeded = await assignStudyFunction(study, checked);
      if (succeeded && context.current === patientUuid && pending.current === requests) {
        setAssignedStudies((previous) => ({ ...previous, [study.id]: checked }));
      }
    } catch {
      // The caller reports the error; preserve the last confirmed assignment.
    } finally {
      requests.delete(study.id);
      if (context.current === patientUuid && pending.current === requests) {
        setPendingStudies(new Set(requests));
      }
    }
  };

  const tableHeaders = [
    { key: 'assignCheckbox', header: '', isSortable: false },
    { key: 'score', header: t('Score', 'Score') },
    { key: 'studyInstanceUID', header: t('studyInstanceUID', 'Study instance UID') },
    { key: 'patientName', header: t('patientName', 'Patient name'), isSortable: true },
    { key: 'studyDate', header: t('studyDate', 'Study date'), isSortable: true },
    { key: 'studyDescription', header: t('description', 'description'), isSortable: false },
    { key: 'orthancBaseUrl', header: t('orthancBaseUrl', 'The configured Orthanc Url'), isSortable: true },
    { key: 'action', header: t('action', 'Action') },
  ].filter(Boolean);

  const tableRows = results?.map((study, index) => ({
    id: String(study.id ?? `row-${index}`),
    assignCheckbox: (
      <input
        type="checkbox"
        value={study.id}
        checked={studyAssignStatus({ study })}
        disabled={
          !canWrite ||
          isPending ||
          pendingStudies.has(study.id) ||
          (!!study.mrsPatientUuid && study.mrsPatientUuid !== patientUuid)
        }
        aria-label={t('assignStudy', 'Assign study') + ' ' + study.studyInstanceUID}
        title={
          study.mrsPatientUuid && study.mrsPatientUuid !== patientUuid
            ? t(
                'assignedAnotherPatient',
                'Assigned to another patient. Review and unlink it from the original chart before assigning it here.',
              )
            : undefined
        }
        onChange={(e) => {
          void handleAssignChange(study, e.target.checked);
        }}
      />
    ),
    score: {
      sortKey: getStudyScore({ study, data }),
      content: (
        <div>
          {Number.isFinite(getStudyScore({ study, data }))
            ? `${getStudyScore({ study, data })}%`
            : t('unknownMatchingScore', 'Unavailable')}
        </div>
      ),
    },
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
    orthancConfiguration: study.orthancConfiguration,
    orthancBaseUrl: study.orthancConfiguration.orthancBaseUrl,
    action: {
      content: (
        <div className="flex gap-1">
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
            <img alt="" className="orthanc-img" src={ohifview} style={{ width: 26, height: 26, marginTop: 0 }} />
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

  if (data?.studies?.length) {
    return (
      <div className={styles.widgetCard}>
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
                    const study = studiesById.get(row.id);
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
                        {isExpanded && study && (
                          <TableRow className={styles.expandedRow}>
                            <TableCell colSpan={headers.length}>
                              <div className={styles.seriesTableDiv}>
                                <SeriesDetailsTable
                                  studyId={Number(row.id)}
                                  studyInstanceUID={study.studyInstanceUID}
                                  patientUuid={patientUuid}
                                  orthancConfig={study.orthancConfiguration}
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
          totalItems={data.studies.length}
          currentItems={results.length}
          pageSize={studiesCount}
          onPageNumberChange={({ page }) => goTo(page)}
        />
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};
export default AssignStudiesTable;
