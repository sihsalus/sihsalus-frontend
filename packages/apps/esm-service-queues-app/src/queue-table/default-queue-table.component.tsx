import { ContentSwitcher, DataTableSkeleton, Layer, Switch, TableToolbarSearch } from '@carbon/react';
import { getUserFacingErrorMessage, isDesktop, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueueEntries } from '../hooks/useQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import { updateSelectedQueueStatus, useServiceQueuesStore } from '../store/store';
import { useColumns } from './cells/columns.resource';
import QueueTable from './queue-table.component';
import styles from './queue-table.scss';
import QueueTableExpandedRow from './queue-table-expanded-row.component';

function DefaultQueueTable() {
  const { t } = useTranslation();
  const layout = useLayoutType();

  return (
    <div className={styles.defaultQueueTable}>
      <StatusSwitcher />
      <Layer className={classNames(styles.tableSection, styles.container)} data-testid="queue-table-card">
        <div className={styles.headerContainer}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{t('patientsCurrentlyInQueue', 'Patients currently in queue')}</h4>
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
  const searchClassName = typeof styles.search === 'string' ? styles.search : undefined;

  const searchCriteria = useMemo(() => {
    return {
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      isEnded: false,
      status: selectedQueueStatusUuid,
    };
  }, [selectedServiceUuid, selectedQueueLocationUuid, selectedQueueStatusUuid]);

  const { queueEntries, isLoading, error, isValidating } = useQueueEntries(searchCriteria);

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

  const columns = useColumns(null, null);
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
    return queueEntries?.filter((queueEntry) => {
      return columns?.some((column) => {
        const columnSearchTerm = column.getFilterableValue?.(queueEntry)?.toLocaleLowerCase();
        return columnSearchTerm?.includes(searchTermLowercase);
      });
    });
  }, [columns, queueEntries, searchTerm]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <QueueTable
      ExpandedRow={QueueTableExpandedRow}
      isValidating={isValidating}
      queueEntries={filteredQueueEntries ?? []}
      queueUuid={null}
      statusUuid={null}
      tableFilters={
        <TableToolbarSearch
          className={searchClassName}
          onChange={(e) => {
            if (typeof e === 'string') {
              setSearchTerm(e);
            } else if (e && 'target' in e) {
              const target = e.target as HTMLInputElement;
              setSearchTerm(target.value);
            }
          }}
          placeholder={t('searchThisList', 'Search this list')}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          persistent
        />
      }
    />
  );
}

function StatusSwitcher() {
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
