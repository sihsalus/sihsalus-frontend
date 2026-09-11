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
import {
  CardHeader,
  compare,
  type DefaultPatientWorkspaceProps,
  EmptyState,
  PatientChartPagination,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { type RequestProcedure } from '../../types';
import {
  addNewProcedureStepWorkspace,
  addNewRequestWorkspace,
  requestCount,
  requestDeleteConfirmationDialog,
} from '../constants';
import { type AddNewProcedureStepWorkspaceProps } from '../worklist/add-procedureStep-form.workspace';
import { useImagingAccess } from '../utils/use-imaging-access';
import { usePaginationBounds } from '../utils/use-pagination-bounds';
import styles from './details-table.scss';
import ProcedureStepTable from './procedureStep-details-table.component';

export interface RequestProcedureTableProps {
  isValidating?: boolean;
  requests?: Array<RequestProcedure> | null;
  showDeleteButton?: boolean;
  patientUuid: string;
}

const RequestProcedureTable: React.FC<RequestProcedureTableProps> = ({
  isValidating,
  requests = [],
  patientUuid,
  showDeleteButton = true,
}) => {
  const { t } = useTranslation();
  const { canWrite } = useImagingAccess();
  const displayText = t('requestProcedureEmptyState', 'No requests found');
  const headerTitle = t('requestProcedure', 'RequestProcedure');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState({});
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const launchAddNewRequestWorkspace = useCallback(
    () => launchWorkspace<DefaultPatientWorkspaceProps>(addNewRequestWorkspace, { patientUuid }),
    [patientUuid],
  );
  const launchDeleteRequestDialog = (requestId: number) => {
    const dispose = showModal(requestDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      requestId,
      patientUuid,
    });
  };

  const filteredRequests = (requests ?? []).filter((item) => {
    const statusMatch = statusFilter === 'all' || (item.status ?? '').toLowerCase() === statusFilter;
    const priorityMatch = priorityFilter === 'all' || (item.priority ?? '').toLowerCase() === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const { results, goTo, currentPage, totalPages } = usePagination(filteredRequests, requestCount);
  usePaginationBounds({ currentPage, totalPages, goTo });
  const requestsById = new Map(filteredRequests.map((request) => [String(request.id), request]));

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

  const tableRows = results?.map((request, _id) => ({
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
      sortKey: request.requestingPhysician,
      content: (
        <div>
          <span>{request.requestingPhysician}</span>
        </div>
      ),
    },
    studyInstanceUID: {
      sortKey: request.studyInstanceUID,
      content: <div className={styles.wrapText}>{request.studyInstanceUID}</div>,
    },
    requestDescription: request.requestDescription,
    orthancConfiguration: request.orthancConfiguration.orthancBaseUrl,
    action: {
      content: (
        <div className="requestBtn" style={{ display: 'flex' }}>
          {showDeleteButton && (
            <IconButton
              kind="ghost"
              align="left"
              size={isTablet ? 'lg' : 'sm'}
              label={t('removeRequst', 'Remove requst')}
              disabled={!canWrite}
              onClick={() => {
                launchDeleteRequestDialog(request.id);
              }}
            >
              <TrashCanIcon className={styles.removeButton} />
            </IconButton>
          )}
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('addProcedureStep', 'Add procedure step')}
            disabled={!canWrite}
            onClick={() => {
              launchWorkspace<AddNewProcedureStepWorkspaceProps>(addNewProcedureStepWorkspace, {
                patientUuid,
                request,
              });
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
      ? compare(cellB?.sortKey ?? cellB, cellA?.sortKey ?? cellA)
      : compare(cellA?.sortKey ?? cellA, cellB?.sortKey ?? cellB);
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
              disabled={!canWrite}
            >
              <strong>{t('Add', 'Add')}</strong>
            </Button>
          </div>
          <div className={styles.filterContainer}>
            <select
              id="status-filter"
              aria-label={t('statusFilter', 'Status filter')}
              style={{ marginRight: '20px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                goTo(1);
              }}
              className={styles.filterInput}
            >
              <SelectItem value="all" text={t('all', 'All')} />
              <SelectItem value="completed" text={t('completed', 'completed')} />
              <SelectItem value="progress" text={t('progress', 'progress')} />
              <SelectItem value="scheduled" text={t('scheduled', 'scheduled')} />
            </select>
            <select
              id="priority-filter"
              aria-label={t('priorityFilter', 'Priority filter')}
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                goTo(1);
              }}
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
              <Table
                aria-label={t('requestsSummary', 'Requests summary')}
                className={styles.table}
                {...getTableProps()}
              >
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
                    const request = requestsById.get(row.id);
                    const { key, ...rowProps } = getRowProps({ row });
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          key={key}
                          className={styles.row}
                          {...rowProps}
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
                        {isExpanded && request && (
                          <TableRow className={styles.expandedRow}>
                            <TableCell colSpan={headers.length}>
                              <div
                                className={styles.procedureStepTableDiv}
                                role="region"
                                aria-label={t('procedureStepRegion', 'Procedure step')}
                              >
                                <ProcedureStepTable key={row.id} requestProcedure={request} />
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
          totalItems={filteredRequests.length}
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
