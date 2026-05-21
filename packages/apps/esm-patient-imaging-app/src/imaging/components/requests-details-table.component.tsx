import {
  Button,
  DataTable,
  IconButton,
  InlineLoading,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  AddIcon,
  launchWorkspace,
  showModal,
  TrashCanIcon,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import { CardHeader, compare, EmptyState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { type RequestProcedure } from '../../types';
import {
  addNewProcedureStepWorkspace,
  addNewRequestWorkspace,
  requestCount,
  requestDeleteConfirmationDialog,
} from '../constants';
import styles from './details-table.scss';
import ProcedureStepTable from './procedureStep-details-table.component';

export interface RequestProcedureTableProps {
  isValidating?: boolean;
  requests?: Array<RequestProcedure> | null;
  showDeleteButton?: boolean;
  patientUuid: string;
}

const RequestProcedureTable: React.FC<RequestProcedureTableProps> = ({ isValidating, requests, patientUuid }) => {
  const { t } = useTranslation();
  const displayText = t('requestProcedureEmptyState', 'No requests found');
  const headerTitle = t('requestProcedure', 'RequestProcedure');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState({});
  const shouldOnClickBeCalled = useRef(true);
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const launchAddNewRequestWorkspace = useCallback(() => launchWorkspace(addNewRequestWorkspace), []);

  const launchDeleteRequestDialog = (requestId: number) => {
    const dispose = showModal(requestDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      requestId,
      patientUuid,
    });
  };

  const filteredRequests = requests.filter((item) => {
    const statusMatch = statusFilter === 'all' || item.status.toLowerCase() === statusFilter;
    const priorityMatch = priorityFilter === 'all' || item.priority.toLowerCase() === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const { results, goTo, currentPage } = usePagination(filteredRequests, requestCount);

  const tableHeaders = useMemo(
    () => [
      { key: 'id', header: t('requestID', 'RequestID'), isSortable: true },
      { key: 'status', header: t('status', 'Status'), isSortable: true, isVisible: true },
      { key: 'priority', header: t('priority', 'Priority'), isSortable: true, isVisible: true },
      {
        key: 'requestingPhysician',
        header: t('requestingPhysician', 'requestingPhysician'),
        isSortable: true,
        isVisible: true,
      },
      { key: 'studyInstanceUID', header: t('studyInstanceUID', 'StudyInstanceUID'), isSortable: true },
      { key: 'requestDescription', header: t('description', 'description'), isSortable: true },
      { key: 'orthancConfiguration', header: t('orthancBaseUrl', 'OrthancBaseUrl'), isSortable: true },
      { key: 'action', header: t('action', 'Action'), isSortable: false },
    ],
    [t],
  );

  const statusText = useMemo(() => {
    return {
      completed: t('requestStatusCompleted', 'completed'),
      progress: t('requestStatusInProgress', 'in progress'),
      scheduled: t('requestStatusInScheduled', 'scheduled'),
    };
  }, [t]);

  const tableRows = results?.map((request, id) => ({
    id: String(request.id),
    status: {
      sortKey: statusText[request.status],
      content: (
        <div>
          <span>{statusText[request.status]}</span>
        </div>
      ),
    },
    priority: {
      sortKey: request.priority,
      content: (
        <div>
          <span>{request.priority}</span>
        </div>
      ),
    },
    requestingPhysician: {
      sortKey: request.priority,
      content: (
        <div>
          <span>{request.requestingPhysician}</span>
        </div>
      ),
    },
    studyInstanceUID: <div className={styles.wrapText}>{request.studyInstanceUID}</div>,
    requestDescription: request.requestDescription,
    orthancConfiguration: request.orthancConfiguration.orthancBaseUrl,
    action: {
      content: (
        <div className="requestBtn" style={{ display: 'flex' }}>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('removeRequst', 'Remove requst')}
            onClick={() => {
              shouldOnClickBeCalled.current = false;
              launchDeleteRequestDialog(request.id);
            }}
          >
            <TrashCanIcon className={styles.removeButton} />
          </IconButton>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('addProcedureStep', 'Add procedure step')}
            onClick={() => {
              shouldOnClickBeCalled.current = false;
              launchWorkspace(addNewProcedureStepWorkspace, { request: request });
            }}
          >
            <AddIcon className={styles.addButton} />
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

  if (requests?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          <div className={styles.buttons}>
            <Button
              kind="ghost"
              renderIcon={(props) => <AddIcon size={16} {...props} />}
              iconDescription={t('add', 'Add')}
              onClick={launchAddNewRequestWorkspace}
            >
              <strong>{t('Add', 'Add')}</strong>
            </Button>
          </div>
          <div className={styles.filterContainer}>
            <select
              id="status-filter"
              aria-label="status-filter"
              style={{ marginRight: '20px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterInput}
            >
              <SelectItem value="all" text={t('all', 'All')} />
              <SelectItem value="completed" text={t('completed', 'completed')} />
              <SelectItem value="progress" text={t('progress', 'progress')} />
              <SelectItem value="scheduled" text={t('scheduled', 'scheduled')} />
            </select>
            <select
              id="priority-filter"
              aria-label="priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={styles.filterInput}
            >
              <SelectItem value="all" text={t('all', 'All')} />
              <SelectItem value="low" text={t('low', 'low')} />
              <SelectItem value="medium" text={t('medium', 'medium')} />
              <SelectItem value="high" text={t('high', 'high')} />
            </select>
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
              <Table aria-label="Reqeusts summary" className={styles.table} {...getTableProps()}>
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
                  {rows.map((row, rowIndex) => {
                    const isExpanded = expandedRows[rowIndex];
                    return (
                      <React.Fragment key={rowIndex}>
                        <TableRow
                          className={styles.row}
                          {...getRowProps({ row })}
                          onDoubleClick={() =>
                            setExpandedRows((prev) => ({
                              ...prev,
                              [rowIndex]: !prev[rowIndex],
                            }))
                          }
                        >
                          {row.cells.map((cell) => (
                            <TableCell className={styles.tableCell} key={cell.id}>
                              {cell.value?.content ?? cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isExpanded && (
                          <TableRow className={styles.expandedRow}>
                            <TableCell colSpan={headers.length}>
                              <div className={styles.procedureStepTableDiv} role="region" aria-label="procedureStep">
                                <ProcedureStepTable requestProcedure={results[rowIndex]} />
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
          totalItems={requests.length}
          currentItems={results.length}
          pageSize={requestCount}
          onPageNumberChange={({ page }) => goTo(page)}
        />
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};

export default RequestProcedureTable;
