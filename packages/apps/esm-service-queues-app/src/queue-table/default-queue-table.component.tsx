import { ContentSwitcher, DataTableSkeleton, Dropdown, Layer, Search, Switch } from '@carbon/react';
import { getUserFacingErrorMessage, isDesktop, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOperationalQueueEntries } from '../hooks/useOperationalQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import { updateSelectedQueueStatus, updateSelectedService, useServiceQueuesStore } from '../store/store';
import { useQueueWorkflowMetadata } from '../triage-workflow/triage-workflow.resource';
import { useColumns } from './cells/columns.resource';
import QueueTable from './queue-table.component';
import styles from './queue-table.scss';
import QueueTableExpandedRow from './queue-table-expanded-row.component';

function DefaultQueueTable() {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { selectedQueueStatusDisplay, selectedQueueStatusUuid } = useServiceQueuesStore();
  const tableHeading =
    selectedQueueStatusUuid && selectedQueueStatusDisplay
      ? t('patientsByQueueStatus', 'Patients: {{status}}', { status: selectedQueueStatusDisplay })
      : t('patientsInQueue', 'Patients in queue');

  return (
    <div className={styles.defaultQueueTable}>
      <StatusSwitcher />
      <Layer className={classNames(styles.tableSection, styles.container)} data-testid="queue-table-card">
        <div className={styles.headerContainer}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{tableHeading}</h4>
          </div>
        </div>
        <QueueTableSection />
      </Layer>
    </div>
  );
}

function QueueTableSection() {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { selectedServiceUuid, selectedQueueLocationUuid, selectedQueueStatusUuid } = useServiceQueuesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [triageFilter, setTriageFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const triageFilterOptions = useMemo(
    () => [
      { id: 'all' as const, label: t('allTriageStates', 'Todo el triaje') },
      { id: 'pending' as const, label: t('triagePending', 'Pendiente') },
      { id: 'completed' as const, label: t('triageCompleted', 'Realizado') },
    ],
    [t],
  );

  const searchCriteria = useMemo(() => {
    return {
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      isEnded: false,
      status: selectedQueueStatusUuid,
    };
  }, [selectedServiceUuid, selectedQueueLocationUuid, selectedQueueStatusUuid]);

  const { queueEntries, isLoading, error, isValidating } = useOperationalQueueEntries(searchCriteria);
  const {
    entries: operationalQueueEntries,
    error: workflowError,
    isLoading: isLoadingWorkflow,
  } = useQueueWorkflowMetadata(queueEntries ?? []);

  useEffect(() => {
    if (error) {
      showSnackbar({
        title: t('errorLoadingQueueEntries', 'Error loading queue entries'),
        kind: 'error',
        subtitle: getUserFacingErrorMessage(
          error,
          t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
          { logContext: 'Load default queue entries' },
        ),
      });
    }
  }, [error, t]);

  useEffect(() => {
    if (workflowError) {
      showSnackbar({
        title: t('errorLoadingQueueWorkflow', 'No se pudo cargar el estado operativo de la cola'),
        kind: 'error',
        subtitle: getUserFacingErrorMessage(
          workflowError,
          t('queueWorkflowLoadErrorMessage', 'No se pudieron cargar la cita, el triaje o el estado SIS.'),
          { logContext: 'Load queue workflow metadata' },
        ),
      });
    }
  }, [t, workflowError]);

  const configuredColumns = useColumns(null, selectedQueueStatusUuid);
  const columns = useMemo(
    () =>
      selectedQueueStatusUuid
        ? configuredColumns?.filter((column) => column.key !== 'status')
        : configuredColumns,
    [configuredColumns, selectedQueueStatusUuid],
  );
  useEffect(() => {
    if (!columns) {
      showSnackbar({
        kind: 'warning',
        title: t('notableConfig', 'No table configuration'),
        subtitle: t('queueTableConfigurationMissing', 'No table configuration is available for this queue.'),
      });
    }
  }, [columns, t]);

  const filteredQueueEntries = useMemo(() => {
    const searchTermLowercase = searchTerm.toLowerCase();
    return operationalQueueEntries
      .filter(
        (queueEntry) =>
          triageFilter === 'all' || queueEntry.workflow?.triageState === triageFilter,
      )
      .filter((queueEntry) => {
        return columns?.some((column) => {
          const columnSearchTerm = column.getFilterableValue?.(queueEntry)?.toLocaleLowerCase();
          return columnSearchTerm?.includes(searchTermLowercase);
        });
      })
      .sort((left, right) => {
        const leftTime = left.workflow?.appointmentStartDateTime
          ? new Date(left.workflow.appointmentStartDateTime).valueOf()
          : Number.POSITIVE_INFINITY;
        const rightTime = right.workflow?.appointmentStartDateTime
          ? new Date(right.workflow.appointmentStartDateTime).valueOf()
          : Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return new Date(left.startedAt).valueOf() - new Date(right.startedAt).valueOf();
      });
  }, [columns, operationalQueueEntries, searchTerm, triageFilter]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <QueueTable
      ExpandedRow={QueueTableExpandedRow}
      isValidating={isValidating || isLoadingWorkflow}
      queueEntries={filteredQueueEntries ?? []}
      queueUuid={null}
      statusUuid={null}
      queueTableColumnsOverride={columns}
      tableFilters={
        <>
          <Search
            className={styles.searchbar}
            labelText={t('filterTable', 'Filter table')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            placeholder={t('filterTable', 'Filter table')}
            size={isDesktop(layout) ? 'sm' : 'lg'}
            value={searchTerm}
          />
          <div className={styles.triageFilter}>
            <Dropdown
              aria-label={t('filterByTriageStatus', 'Filtrar por estado de triaje')}
              id="triage-status-filter"
              items={triageFilterOptions}
              itemToString={(item) => item?.label ?? ''}
              label={t('allTriageStates', 'Todo el triaje')}
              selectedItem={triageFilterOptions.find((item) => item.id === triageFilter)}
              size={isDesktop(layout) ? 'sm' : 'lg'}
              titleText={t('triageStatus', 'Triaje')}
              hideLabel
              onChange={({ selectedItem }) => {
                if (!selectedItem) {
                  return;
                }

                setTriageFilter(selectedItem.id);
                if (selectedItem.id === 'completed' && selectedServiceUuid) {
                  // Once triage is completed, the patient is transferred from the
                  // triage service to the clinical queue for their appointment.
                  // Keeping the previous service constraint would exclude that
                  // active destination entry before this client-side filter runs.
                  updateSelectedService(null, t('all', 'All'));
                }
              }}
            />
          </div>
        </>
      }
    />
  );
}

export function StatusSwitcher() {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { statuses, isLoadingQueueStatuses, queueStatusesError } = useQueueStatuses();
  const { selectedQueueStatusDisplay, selectedQueueStatusUuid } = useServiceQueuesStore();
  const allStatusesOption = { uuid: 'all', display: t('all', 'All') };
  const hasSelectedStatus = statuses.some((status) => status.uuid === selectedQueueStatusUuid);
  const persistedStatusOption =
    selectedQueueStatusUuid && !hasSelectedStatus && (isLoadingQueueStatuses || queueStatusesError)
      ? {
          uuid: selectedQueueStatusUuid,
          display: selectedQueueStatusDisplay ?? t('queueStatus', 'Queue status'),
        }
      : null;
  const statusItems = [allStatusesOption, ...(persistedStatusOption ? [persistedStatusOption] : []), ...statuses];
  const matchingStatusIndex = selectedQueueStatusUuid
    ? statusItems.findIndex((status) => status.uuid === selectedQueueStatusUuid)
    : 0;
  const selectedIndex = matchingStatusIndex >= 0 ? matchingStatusIndex : 0;

  useEffect(() => {
    if (!isLoadingQueueStatuses && !queueStatusesError && selectedQueueStatusUuid && matchingStatusIndex < 0) {
      updateSelectedQueueStatus(null, t('all', 'All'));
    }
  }, [isLoadingQueueStatuses, matchingStatusIndex, queueStatusesError, selectedQueueStatusUuid, t]);

  return (
    <ContentSwitcher
      aria-label={t('queueStatus', 'Queue status')}
      className={styles.statusSwitcher}
      onChange={({ name }) => {
        const selectedStatus = statusItems.find((status) => status.uuid === name) ?? allStatusesOption;
        updateSelectedQueueStatus(
          selectedStatus.uuid === allStatusesOption.uuid ? null : selectedStatus.uuid,
          selectedStatus.display,
        );
      }}
      selectedIndex={selectedIndex}
      selectionMode="manual"
      size={isDesktop(layout) ? 'sm' : 'md'}
    >
      {statusItems.map((status) => (
        <Switch key={status.uuid} name={status.uuid} text={status.display} />
      ))}
    </ContentSwitcher>
  );
}

export default DefaultQueueTable;
