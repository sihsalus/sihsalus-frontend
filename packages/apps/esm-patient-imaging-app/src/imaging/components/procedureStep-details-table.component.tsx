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
import { showModal, TrashCanIcon, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { compare, EmptyState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { useProcedureStep } from '../../api';
import { type RequestProcedure } from '../../types';
import { procedureStepCount, procedureSteptDeleteConfirmationDialog } from '../constants';
import styles from './details-table.scss';

export interface ProcedureStepTableProps {
  requestProcedure: RequestProcedure;
}

const ProcedureStepTable: React.FC<ProcedureStepTableProps> = ({ requestProcedure }) => {
  const {
    data: stepList,
    error: stepError,
    isLoading: isLoadingStep,
    isValidating: isValidatingStep,
  } = useProcedureStep(requestProcedure.id);

  const { t } = useTranslation();
  const displayText = t('procedureStep', 'Procedure step');
  const headerTitle = t('procedureStep', 'Procedure step');
  const { results, goTo, currentPage } = usePagination(stepList, procedureStepCount);
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const shouldOnClickBeCalled = useRef(true);

  const launchDeleteProcedureStepDialog = (requestId: number, stepId: number) => {
    const dispose = showModal(procedureSteptDeleteConfirmationDialog, {
      closeDeleteModal: () => dispose(),
      requestId,
      stepId,
    });
  };

  const tableHeaders = useMemo(
    () => [
      { key: 'id', header: t('stepID', 'StepID'), isSortable: true },
      { key: 'performedProcedureStepStatus', header: t('status', 'Status'), isSortable: true },
      { key: 'modality', header: t('modality', 'Modality'), isSortable: true, isVisible: true },
      { key: 'aetTitle', header: t('aetTitle', 'Aet Title'), isSortable: true },
      {
        key: 'scheduledReferringPhysician',
        header: t('scheduledReferringPhysician', 'Scheduled referring physician'),
        isSortable: true,
        isVisible: true,
      },
      { key: 'requestedProcedureDescription', header: t('description', 'Description'), isSortable: true },
      { key: 'stepStartDate', header: t('stepStartDate', 'Start date of the step'), isSortable: true, isVisible: true },
      { key: 'stepStartTime', header: t('time', 'Time') },
      { key: 'stationName', header: t('stationName', 'Sation name'), isSortable: true },
      { key: 'procedureStepLocation', header: t('procedureStepLocation', 'Procedure step location'), isSortable: true },
      { key: 'action', header: t('action', 'Action') },
    ],
    [t],
  );

  const statusText = useMemo(() => {
    return {
      completed: t('procedureStepStatusCompleted', 'completed'),
      scheduled: t('procedureStepStatusScheduled', 'scheduled'),
    };
  }, [t]);

  const tableRows = results?.map((step) => ({
    id: String(step.id),
    performedProcedureStepStatus: statusText[step.performedProcedureStepStatus],
    modality: {
      sortKey: step.modality,
      content: (
        <div>
          <span>{step.modality}</span>
        </div>
      ),
    },
    aetTitle: step.aetTitle,
    scheduledReferringPhysician: {
      sortKey: step.scheduledReferringPhysician,
      content: (
        <div>
          <span>{step.scheduledReferringPhysician}</span>
        </div>
      ),
    },
    requestedProcedureDescription: step.requestedProcedureDescription,
    stepStartDate: step.stepStartDate,
    stepStartTime: step.stepStartTime,
    stationName: step.stationName,
    procedureStepLocation: step.procedureStepLocation,
    action: {
      content: (
        <div>
          <IconButton
            kind="ghost"
            align="left"
            size={isTablet ? 'lg' : 'sm'}
            label={t('removeStep', 'Remove step')}
            onClick={() => {
              shouldOnClickBeCalled.current = false;
              launchDeleteProcedureStepDialog(requestProcedure.id, step.id);
            }}
          >
            <TrashCanIcon className={styles.removeButton} />
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

  if (isLoadingStep) {
    return <div>Loading ...</div>;
  }

  if (!stepList?.length) {
    return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      {stepList?.length ? (
        <>
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
                <Table aria-label="Procedure step summary" className={styles.table} {...getTableProps()} />
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
                    return (
                      <React.Fragment key={rowIndex}>
                        <TableRow>
                          {row.cells.map((cell, cellIndex) => (
                            <TableCell className={styles.tableCell} key={cellIndex}>
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
            totalItems={stepList.length}
            currentItems={results.length}
            pageSize={procedureStepCount}
            onPageNumberChange={({ page }) => goTo(page)}
          />
        </>
      ) : (
        <EmptyState displayText={displayText} headerTitle={headerTitle} />
      )}
    </div>
  );
};

export default ProcedureStepTable;
