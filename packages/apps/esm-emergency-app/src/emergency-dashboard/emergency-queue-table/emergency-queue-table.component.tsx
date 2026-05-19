import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineLoading,
  Layer,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { Add, Reset } from '@carbon/react/icons';
import {
  ErrorState,
  isDesktop,
  launchWorkspace,
  showModal,
  useConfig,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../config-schema';
import { emergencyWorkflowWorkspace } from '../../emergency-workflow/constants';
import { usePriorityConfig } from '../../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, useEmergencyQueueEntries } from '../../resources/emergency.resource';
import { useEmergencyQueueColumns } from './emergency-queue-columns.resource';
import styles from './emergency-queue-table.scss';

/**
 * Emergency Queue Table Component
 *
 * Displays the queue table for emergency patients following the same pattern
 * as esm-service-queues-app with integrated search and pagination.
 */
interface EmergencyQueueTableProps {
  queueUuid?: string;
}

const EmergencyQueueTable: React.FC<EmergencyQueueTableProps> = ({ queueUuid }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const config = useConfig<Config>();
  const { getPriorityByUuid } = usePriorityConfig();
  const { queueEntries, isLoading, error, isValidating } = useEmergencyQueueEntries(
    undefined,
    undefined,
    undefined,
    queueUuid,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusUuid, setSelectedStatusUuid] = useState<string | null>(null);
  const [selectedPriorityUuid, setSelectedPriorityUuid] = useState<string | null>(null);
  const [selectedProviderUuid, setSelectedProviderUuid] = useState<string | null>(null);
  const [selectedWaitTimeRange, setSelectedWaitTimeRange] = useState<string | null>(null);
  const [currentPageSize, setPageSize] = useState(10);
  const pageSizes = [10, 20, 30, 40, 50];
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  const columns = useEmergencyQueueColumns();

  // Extract unique statuses from queue entries
  const availableStatuses = useMemo(() => {
    const statusMap = new Map<string, string>();
    queueEntries.forEach((entry) => {
      if (entry.status?.uuid && !statusMap.has(entry.status.uuid)) {
        statusMap.set(entry.status.uuid, entry.status.display);
      }
    });
    return Array.from(statusMap, ([uuid, display]) => ({ uuid, display })).sort((a, b) =>
      a.display.localeCompare(b.display),
    );
  }, [queueEntries]);

  // Extract unique priorities from queue entries
  const availablePriorities = useMemo(() => {
    const priorityMap = new Map<string, string>();
    queueEntries.forEach((entry) => {
      if (entry.priority?.uuid && !priorityMap.has(entry.priority.uuid)) {
        priorityMap.set(entry.priority.uuid, entry.priority.display);
      }
    });
    return Array.from(priorityMap, ([uuid, display]) => ({ uuid, display }));
  }, [queueEntries]);

  // Extract unique providers from queue entries
  const availableProviders = useMemo(() => {
    const providerMap = new Map<string, string>();
    queueEntries.forEach((entry) => {
      if (entry.providerWaitingFor?.uuid && !providerMap.has(entry.providerWaitingFor.uuid)) {
        providerMap.set(entry.providerWaitingFor.uuid, entry.providerWaitingFor.display);
      }
    });
    return Array.from(providerMap, ([uuid, display]) => ({ uuid, display })).sort((a, b) =>
      a.display.localeCompare(b.display),
    );
  }, [queueEntries]);

  // Static wait time range options aligned with Norma Técnica thresholds
  const waitTimeRangeOptions = useMemo(
    () => [
      { id: 'under10', label: t('under10Min', 'Menos de 10 min') },
      { id: '10to60', label: t('10to60Min', '10 - 60 min') },
      { id: '60to120', label: t('60to120Min', '60 - 120 min') },
      { id: 'over120', label: t('over120Min', 'Más de 120 min') },
    ],
    [t],
  );

  const hasActiveFilters = selectedStatusUuid || selectedPriorityUuid || selectedProviderUuid || selectedWaitTimeRange;

  const clearAllFilters = useCallback(() => {
    setSelectedStatusUuid(null);
    setSelectedPriorityUuid(null);
    setSelectedProviderUuid(null);
    setSelectedWaitTimeRange(null);
  }, []);

  // Filter queue entries based on all criteria simultaneously (AND logic)
  const filteredQueueEntries = useMemo(() => {
    const now = dayjs();
    let entries = queueEntries;

    if (selectedStatusUuid) {
      entries = entries.filter((entry) => entry.status?.uuid === selectedStatusUuid);
    }

    if (selectedPriorityUuid) {
      entries = entries.filter((entry) => entry.priority?.uuid === selectedPriorityUuid);
    }

    if (selectedProviderUuid) {
      entries = entries.filter((entry) => entry.providerWaitingFor?.uuid === selectedProviderUuid);
    }

    if (selectedWaitTimeRange) {
      entries = entries.filter((entry) => {
        const waitMinutes = now.diff(dayjs(entry.startedAt), 'minute');
        switch (selectedWaitTimeRange) {
          case 'under10':
            return waitMinutes < 10;
          case '10to60':
            return waitMinutes >= 10 && waitMinutes < 60;
          case '60to120':
            return waitMinutes >= 60 && waitMinutes < 120;
          case 'over120':
            return waitMinutes >= 120;
          default:
            return true;
        }
      });
    }

    if (searchTerm.trim()) {
      const searchTermLowercase = searchTerm.toLowerCase();
      entries = entries.filter((queueEntry) => {
        return columns.some((column) => {
          const filterableValue = column.getFilterableValue?.(queueEntry);
          return filterableValue?.toLowerCase().includes(searchTermLowercase);
        });
      });
    }

    return entries;
  }, [
    queueEntries,
    selectedStatusUuid,
    selectedPriorityUuid,
    selectedProviderUuid,
    selectedWaitTimeRange,
    searchTerm,
    columns,
  ]);

  // Derive sortWeight from priority UUID (API sortWeight may be unreliable/undefined)
  const deriveSortWeight = useCallback(
    (entry: EmergencyQueueEntry): number => {
      const priorityUuid = entry.priority?.uuid;
      if (!priorityUuid) return 999;

      // Pre-triage: Emergencia = 1, Urgencia = 2
      if (priorityUuid === config.concepts.emergencyConceptUuid) return 1;
      if (priorityUuid === config.concepts.urgencyConceptUuid) return 2;

      // Post-triage: Priority I-IV from config
      const priorityConfig = getPriorityByUuid(priorityUuid);
      if (priorityConfig) return priorityConfig.sortWeight;

      // Fallback to API sortWeight or 999
      return entry.sortWeight ?? 999;
    },
    [config.concepts.emergencyConceptUuid, config.concepts.urgencyConceptUuid, getPriorityByUuid],
  );

  // Sort entries by priority (lower sortWeight = higher priority) then by arrival time
  const sortedQueueEntries = useMemo(() => {
    return [...filteredQueueEntries].sort((a, b) => {
      const weightA = deriveSortWeight(a);
      const weightB = deriveSortWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    });
  }, [filteredQueueEntries, deriveSortWeight]);

  const {
    goTo,
    results: paginatedQueueEntries,
    currentPage,
    paginated,
  } = usePagination(sortedQueueEntries, currentPageSize);

  useEffect(() => {
    goTo(1);
  }, [goTo]);

  // Build rows using column components
  const rows = useMemo(() => {
    return paginatedQueueEntries.map((queueEntry) => {
      const row: Record<string, JSX.Element | string> & { id: string } = { id: queueEntry.uuid };
      columns.forEach(({ key, CellComponent }) => {
        row[key] = <CellComponent key={key} queueEntry={queueEntry} />;
      });
      return row;
    });
  }, [paginatedQueueEntries, columns]);

  if (isLoading) {
    return (
      <div className={styles.defaultQueueTable}>
        <Layer className={styles.tableSection}>
          <DataTableSkeleton role="progressbar" />
        </Layer>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.defaultQueueTable}>
        <Layer className={styles.tableSection}>
          <ErrorState headerTitle={t('errorLoadingQueue', 'Error loading queue')} error={error} />
        </Layer>
      </div>
    );
  }

  return (
    <div className={styles.defaultQueueTable}>
      <Layer className={styles.tableSection}>
        <div className={styles.headerContainer}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{t('patientsCurrentlyInQueue', 'Patients currently in queue')}</h4>
          </div>
          <div className={styles.headerButtons}>
            <Button
              kind="secondary"
              renderIcon={(props) => <Add size={16} {...props} />}
              size={isDesktop(layout) ? 'sm' : 'lg'}
              onClick={() => {
                launchWorkspace(emergencyWorkflowWorkspace, {
                  workspaceTitle: t('newEmergencyPatient', 'New Emergency Patient'),
                });
              }}
            >
              {t('newEmergencyPatient', 'New Emergency Patient')}
            </Button>
          </div>
        </div>
        <DataTable
          data-floating-menu-container
          overflowMenuOnHover={isDesktop(layout)}
          rows={rows}
          headers={columns}
          size={responsiveSize}
          useZebraStyles={columns.length > 1}
        >
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <>
              <TableContainer className={styles.tableContainer}>
                <div className={styles.toolbarContainer}>
                  {isValidating && (
                    <div className={styles.loaderContainer}>
                      <InlineLoading />
                    </div>
                  )}
                  <TableToolbar {...getToolbarProps()}>
                    <TableToolbarContent className={styles.toolbarContent}>
                      {queueEntries.length > 0 && (
                        <Button
                          className={styles.clearQueueButton}
                          kind="ghost"
                          size={isDesktop(layout) ? 'sm' : 'lg'}
                          onClick={() => {
                            const dispose = showModal('emergency-clear-queue-entries-modal', {
                              closeModal: () => dispose(),
                              queueEntries,
                            });
                          }}
                        >
                          {t('clearQueueEntries', 'Limpiar cola')}
                        </Button>
                      )}
                      <div className={styles.filterContainer}>
                        <Dropdown
                          id="statusFilter"
                          items={[{ uuid: '', display: t('any', 'Any') }, ...availableStatuses]}
                          itemToString={(item) => (item ? item.display : '')}
                          label={
                            selectedStatusUuid
                              ? (availableStatuses.find((s) => s.uuid === selectedStatusUuid)?.display ??
                                t('all', 'All'))
                              : t('all', 'All')
                          }
                          onChange={({ selectedItem }) => {
                            setSelectedStatusUuid(selectedItem?.uuid || null);
                          }}
                          size={isDesktop(layout) ? 'sm' : 'lg'}
                          titleText={t('showPatientsWithStatus', 'Show patients with status:')}
                          type="inline"
                        />
                      </div>
                      <div className={styles.filterContainer}>
                        <Dropdown
                          id="priorityFilter"
                          items={[{ uuid: '', display: t('any', 'Any') }, ...availablePriorities]}
                          itemToString={(item) => (item ? item.display : '')}
                          label={
                            selectedPriorityUuid
                              ? (availablePriorities.find((p) => p.uuid === selectedPriorityUuid)?.display ??
                                t('all', 'All'))
                              : t('all', 'All')
                          }
                          onChange={({ selectedItem }) => setSelectedPriorityUuid(selectedItem?.uuid || null)}
                          size={isDesktop(layout) ? 'sm' : 'lg'}
                          titleText={t('filterByPriority', 'Prioridad:')}
                          type="inline"
                        />
                      </div>
                      {availableProviders.length > 0 && (
                        <div className={styles.filterContainer}>
                          <Dropdown
                            id="providerFilter"
                            items={[{ uuid: '', display: t('any', 'Any') }, ...availableProviders]}
                            itemToString={(item) => (item ? item.display : '')}
                            label={
                              selectedProviderUuid
                                ? (availableProviders.find((p) => p.uuid === selectedProviderUuid)?.display ??
                                  t('all', 'All'))
                                : t('all', 'All')
                            }
                            onChange={({ selectedItem }) => setSelectedProviderUuid(selectedItem?.uuid || null)}
                            size={isDesktop(layout) ? 'sm' : 'lg'}
                            titleText={t('filterByProvider', 'Prestador:')}
                            type="inline"
                          />
                        </div>
                      )}
                      <div className={styles.filterContainer}>
                        <Dropdown
                          id="waitTimeFilter"
                          items={[{ id: '', label: t('any', 'Any') }, ...waitTimeRangeOptions]}
                          itemToString={(item) => (item ? item.label : '')}
                          label={
                            selectedWaitTimeRange
                              ? (waitTimeRangeOptions.find((r) => r.id === selectedWaitTimeRange)?.label ??
                                t('all', 'All'))
                              : t('all', 'All')
                          }
                          onChange={({ selectedItem }) => setSelectedWaitTimeRange(selectedItem?.id || null)}
                          size={isDesktop(layout) ? 'sm' : 'lg'}
                          titleText={t('filterByWaitTime', 'Tiempo de espera:')}
                          type="inline"
                        />
                      </div>
                      {hasActiveFilters && (
                        <Button
                          kind="ghost"
                          size={isDesktop(layout) ? 'sm' : 'lg'}
                          renderIcon={(props) => <Reset size={16} {...props} />}
                          onClick={clearAllFilters}
                        >
                          {t('clearFilters', 'Limpiar filtros')}
                        </Button>
                      )}
                      <TableToolbarSearch
                        className={styles.search}
                        expanded
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        placeholder={t('searchThisList', 'Search this list')}
                        size={isDesktop(layout) ? 'md' : 'lg'}
                        persistent
                      />
                    </TableToolbarContent>
                  </TableToolbar>
                </div>
                <Table {...getTableProps()} className={styles.queueTable}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          {...getHeaderProps({ header })}
                          className={header.key === 'actions' ? 'cds--table-column-menu' : undefined}
                        >
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cell.info?.header === 'actions' ? 'cds--table-column-menu' : undefined}
                          >
                            {cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length === 0 && (
                <div className={styles.tileContainer}>
                  <Tile className={styles.tile}>
                    <div className={styles.tileContent}>
                      <p className={styles.content}>{t('noPatientsToDisplay', 'No patients to display')}</p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </div>
              )}
              {paginated && (
                <Pagination
                  forwardText={t('nextPage', 'Next page')}
                  backwardText={t('previousPage', 'Previous page')}
                  page={currentPage}
                  pageSize={currentPageSize}
                  pageSizes={pageSizes}
                  totalItems={sortedQueueEntries.length}
                  onChange={({ pageSize, page }) => {
                    if (pageSize !== currentPageSize) {
                      setPageSize(pageSize);
                    }
                    if (page !== currentPage) {
                      goTo(page);
                    }
                  }}
                />
              )}
            </>
          )}
        </DataTable>
      </Layer>
    </div>
  );
};

export default EmergencyQueueTable;
