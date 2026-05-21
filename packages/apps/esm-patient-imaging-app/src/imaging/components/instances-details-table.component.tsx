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
import { showModal, useLayoutType, usePagination } from '@openmrs/esm-framework';

import { compare, EmptyState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudyInstances } from '../../api';
import orthancExplorer from '../../assets/orthanc.png';
import preview from '../../assets/preview.png';
import { getBrowserUrl, type OrthancConfiguration } from '../../types';
import { instancePreviewDialog, instancesCount } from '../constants';
import { buildURL } from '../utils/help';
import styles from './details-table.scss';

export interface InstancesDetailsTableProps {
  studyId: number;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  orthancConfig: OrthancConfiguration;
  seriesModality: string;
}

const InstancesDetailsTable: React.FC<InstancesDetailsTableProps> = ({
  studyId,
  studyInstanceUID,
  seriesInstanceUID,
  orthancConfig,
  seriesModality,
}) => {
  const {
    data: instances,
    error: seriesError,
    isLoading: isLoadingSeries,
    isValidating: isValidatingSeries,
  } = useStudyInstances(studyId, seriesInstanceUID);

  const launchInstancePreviewDialog = (orthancInstanceUID: string, studyId: number, instancePosition: string) => {
    const dispose = showModal(instancePreviewDialog, {
      closeInstancePreviewModal: () => dispose(),
      orthancInstanceUID,
      studyId,
      instancePosition,
    });
  };

  const { t } = useTranslation();
  const displayText = t('instances', 'Instances');
  const headerTitle = t('instances', 'Instances');
  const { results, goTo, currentPage } = usePagination(instances, instancesCount);
  const layout = useLayoutType();
  const shouldOnClickBeCalled = useRef(true);
  const isTablet = layout === 'tablet';

  const tableHeaders = [
    { key: 'sopInstanceUID', header: t('sopInstanceUID', 'SOP Instance UID'), isSortable: true },
    { key: 'instanceNumber', header: t('instanceNumber', 'Instance number'), isSortable: true },
    {
      key: 'imagePositionPatient',
      header: t('imagePositionPatient', 'Image position of Patient'),
      isSortable: true,
      isVisible: true,
    },
    { key: 'numberOfFrames', header: t('numberOfFrames', 'Number of frames'), isSortable: true },
    { key: 'action', header: t('action', 'Action') },
  ];

  const tableRows = results?.map((instance) => ({
    id: instance.sopInstanceUID,
    sopInstanceUID: <div className={styles.wrapText}>{instance.sopInstanceUID}</div>,
    instanceNumber: instance.instanceNumber,
    imagePositionPatient: instance.imagePositionPatient,
    numberOfFrames: instance.numberOfFrames,
    action: {
      content: (
        <div className="instanceActionsDiv" style={{ display: 'flex' }}>
          {seriesModality !== 'RTSTRUCT' && seriesModality !== 'RTDOSE' && (
            <>
              <IconButton
                kind="ghost"
                align="left"
                size={isTablet ? 'lg' : 'sm'}
                label={t('instanceViewLocal', 'Instance preview local')}
                onClick={() => {
                  shouldOnClickBeCalled.current = false;
                  launchInstancePreviewDialog(instance.orthancInstanceUID, studyId, instance.imagePositionPatient);
                }}
              >
                <img alt="" className="stone-img" src={preview} style={{ width: 23, height: 23 }} />
              </IconButton>
              <IconButton
                kind="ghost"
                align="left"
                size={isTablet ? 'lg' : 'sm'}
                label={t('instanceViewInOrthanc', 'Instance view in Orthanc')}
                onClick={
                  () =>
                    (globalThis.location.href = buildURL(
                      getBrowserUrl(orthancConfig),
                      `instances/${instance.orthancInstanceUID}/preview`,
                      [],
                    ))
                  // `${orthancBaseUrl}instances/${instance.orthancInstanceUID}/preview`)
                }
              >
                <img alt="" className="orthanc-img" src={preview} style={{ width: 23, height: 23 }} />
              </IconButton>
            </>
          )}
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('orthancExplorer2', 'Show data in orthanc explorere')}
            onClick={() =>
              (globalThis.location.href = `${getBrowserUrl(orthancConfig)}/ui/app/#/filtered-studies?StudyInstanceUID=${encodeURIComponent(studyInstanceUID)}&expand=series`)
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

  if (isLoadingSeries || isValidatingSeries) {
    return <div>Loading ...</div>;
  }

  if (!instances?.length) {
    return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
  }

  return (
    <div className={'studiesTableDiv'}>
      <DataTable
        rows={tableRows}
        headers={tableHeaders}
        sortRow={sortRow}
        isSortable
        useZebraStyles
        data-floating-menu-container
        size={isTablet ? 'lg' : 'sm'}
      >
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table aria-label="Instances summary" className={styles.table} {...getTableProps()} />
            <TableHead>
              <TableRow>
                {headers.map((header, index) => {
                  const { key, ...headerProps } = getHeaderProps({ header });
                  return (
                    <TableHeader key={key} {...headerProps} style={index === 4 ? { width: '180px' } : {}}>
                      {header.header}
                    </TableHeader>
                  );
                })}
                <TableHeader />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                return (
                  <React.Fragment key={row.id}>
                    <TableRow className={styles.row}>
                      {row.cells.map((cell) => (
                        <TableCell className={styles.tableCell} key={cell.id}>
                          {cell.value?.content ?? cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        pageNumber={currentPage}
        totalItems={instances.length}
        currentItems={results.length}
        pageSize={instancesCount}
        onPageNumberChange={({ page }) => goTo(page)}
      />
    </div>
  );
};

export default InstancesDetailsTable;
