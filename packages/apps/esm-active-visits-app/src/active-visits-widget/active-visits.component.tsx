import {
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Layer,
  Pagination,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import {
  ConfigurableLink,
  ErrorState,
  ExtensionSlot,
  isDesktop,
  useConfig,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActiveVisitsConfigSchema } from '../config-schema';
import { type ActiveVisit } from '../types';

import { useActiveVisits, useActiveVisitsSorting, useObsConcepts, useTableHeaders } from './active-visits.resource';
import styles from './active-visits.scss';
import { EmptyDataIllustration } from './empty-data-illustration.component';

type DisplayVisit = ActiveVisit & Record<string, string>;

const ActiveVisitsTable = () => {
  const { t } = useTranslation();
  const config = useConfig<ActiveVisitsConfigSchema>();
  const layout = useLayoutType();
  const pageSizes = config?.activeVisits?.pageSizes ?? [10, 20, 30, 40, 50];
  const [pageSize, setPageSize] = useState(config?.activeVisits?.pageSize ?? 10);
  const { obsConcepts, isLoadingObsConcepts } = useObsConcepts(config.activeVisits.obs);
  const { activeVisits, isLoading, isValidating, error } = useActiveVisits();
  const [searchString, setSearchString] = useState('');
  const headerData = useTableHeaders(obsConcepts);

  const transformVisitForDisplay = useCallback(
    (visit: ActiveVisit) => {
      const displayData = { ...visit } as DisplayVisit;

      // Add observation values to the display data
      obsConcepts?.forEach((concept) => {
        const obsValues = visit?.observations?.[concept.uuid] ?? [];
        const latestObs = obsValues[0];

        if (latestObs) {
          // Handle both string and object values
          displayData[`obs-${concept.uuid}`] =
            typeof latestObs.value === 'object' && latestObs.value && 'display' in latestObs.value
              ? String(latestObs.value.display ?? '--')
              : String(latestObs.value ?? '--');
        } else {
          displayData[`obs-${concept.uuid}`] = '--';
        }
      });

      return displayData;
    },
    [obsConcepts],
  );

  const searchResults = useMemo(() => {
    const displayRows = activeVisits.map((visit) => transformVisitForDisplay(visit));
    if (!displayRows.length) return displayRows;

    const trimmed = searchString?.trim();
    if (!trimmed) return displayRows;

    const search = trimmed.toLowerCase();
    return displayRows.filter((activeVisitRow) =>
      Object.entries(activeVisitRow).some(
        ([header, value]) => header !== 'patientUuid' && `${value}`.toLowerCase().includes(search),
      ),
    );
  }, [searchString, activeVisits, transformVisitForDisplay]);

  const { sortedRows, sortRow } = useActiveVisitsSorting(searchResults);
  const { paginated, goTo, results, currentPage } = usePagination(sortedRows, pageSize as number);

  const handleSearch = useCallback(
    (e) => {
      goTo(1);
      setSearchString(e.target.value);
    },
    [goTo],
  );

  if (isLoading || isLoadingObsConcepts) {
    return (
      <div className={styles.activeVisitsContainer}>
        <div className={styles.activeVisitsDetailHeaderContainer}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{t('activeVisits', 'Active Visits')}</h4>
          </div>
          <div className={styles.backgroundDataFetchingIndicator}>
            <span>{isValidating ? <InlineLoading /> : null}</span>
          </div>
        </div>
        <Search
          labelText=""
          placeholder={t('filterTable', 'Filter table')}
          onChange={handleSearch}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          disabled
        />
        <DataTableSkeleton
          rowCount={pageSize}
          showHeader={false}
          showToolbar={false}
          zebra
          columnCount={headerData?.length}
          size={isDesktop(layout) ? 'sm' : 'lg'}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.activeVisitsContainer}>
        <Layer>
          <ErrorState error={error} headerTitle={t('activeVisits', 'Active Visits')} />
        </Layer>
      </div>
    );
  }

  if (!activeVisits.length) {
    return (
      <div className={styles.activeVisitsContainer}>
        <Layer>
          <Tile className={styles.tile}>
            <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
              <h4>{t('activeVisits', 'Active Visits')}</h4>
            </div>
            <EmptyDataIllustration />
            <p className={styles.content}>
              {t('noActiveVisitsForLocation', 'There are no active visits to display for this facility.')}
            </p>
          </Tile>
        </Layer>
      </div>
    );
  }

  return (
    <div className={styles.activeVisitsContainer}>
      <div className={styles.activeVisitsDetailHeaderContainer}>
        <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{t('activeVisits', 'Active Visits')}</h4>
        </div>
        <div className={styles.backgroundDataFetchingIndicator}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
        </div>
      </div>
      <Search
        labelText=""
        placeholder={t('filterTable', 'Filter table')}
        onChange={handleSearch}
        size={isDesktop(layout) ? 'sm' : 'lg'}
      />
      <DataTable
        isSortable
        useStaticWidth
        rows={results}
        headers={headerData}
        sortRow={sortRow}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        useZebraStyles={activeVisits?.length > 1}
      >
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, getExpandHeaderProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table className={styles.activeVisitsTable} {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => {
                  const currentVisit = activeVisits.find((visit) => visit.id === row.id);

                  if (!currentVisit) {
                    return null;
                  }

                  return (
                    <React.Fragment key={`active-visit-row-${index}`}>
                      {(() => {
                        const { key, ...rowProps } = getRowProps({ row });

                        return (
                          <TableExpandRow
                            key={key}
                            {...rowProps}
                            data-testid={`activeVisitRow${currentVisit.patientUuid || 'unknown'}`}
                          >
                            {row.cells.map((cell) => (
                              <TableCell key={`active-visit-row-${index}-cell-${cell.id}`} data-testid={cell.id}>
                                {cell.info.header === 'name' && currentVisit.patientUuid ? (
                                  <ConfigurableLink
                                    to={`${globalThis.spaBase}/patient/${currentVisit.patientUuid}/chart`}
                                  >
                                    {cell.value}
                                  </ConfigurableLink>
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
                            ))}
                          </TableExpandRow>
                        );
                      })()}
                      {row.isExpanded ? (
                        <TableRow className={styles.expandedActiveVisitRow}>
                          <th colSpan={headers.length + 2}>
                            <ExtensionSlot
                              className={styles.visitSummaryContainer}
                              name="visit-summary-slot"
                              state={{
                                patientUuid: currentVisit.patientUuid,
                                visitUuid: currentVisit.visitUuid,
                              }}
                            />
                          </th>
                        </TableRow>
                      ) : (
                        <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {searchResults?.length === 0 && (
        <div className={styles.filterEmptyState}>
          <Layer level={0}>
            <Tile className={styles.filterEmptyStateTile}>
              <p className={styles.filterEmptyStateContent}>{t('noVisitsToDisplay', 'No visits to display')}</p>
              <p className={styles.filterEmptyStateHelper}>{t('checkFilters', 'Check the filters above')}</p>
            </Tile>
          </Layer>
        </div>
      )}
      {paginated && (
        <Pagination
          forwardText="Next page"
          backwardText="Previous page"
          page={currentPage}
          pageSize={pageSize}
          pageSizes={pageSizes}
          totalItems={searchResults?.length}
          className={styles.pagination}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          onChange={({ pageSize: newPageSize, page: newPage }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }
            if (newPage !== currentPage) {
              goTo(newPage);
            }
          }}
        />
      )}
    </div>
  );
};

export default ActiveVisitsTable;
