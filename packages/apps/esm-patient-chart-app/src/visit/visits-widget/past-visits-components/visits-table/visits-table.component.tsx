import {
  Button,
  DataTable,
  type DataTableCell,
  type DataTableHeader,
  type DataTableRenderProps,
  Dropdown,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
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
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import {
  EditIcon,
  formatDatetime,
  getConfig,
  isDesktop,
  parseDate,
  showModal,
  showSnackbar,
  TrashCanIcon,
  useLayoutType,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import {
  EmptyState,
  type HtmlFormEntryForm,
  launchFormEntryOrHtmlForms,
  PatientChartPagination,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EncounterObservations from '../../encounter-observations';
import { type MappedEncounter } from '../../visit.resource';

import { deleteEncounter } from './visits-table.resource';
import styles from './visits-table.scss';

interface VisitTableProps {
  visits: Array<MappedEncounter>;
  showAllEncounters?: boolean;
  patientUuid: string;
  mutateVisits?: () => void;
}

type FilterProps = {
  rowIds: Array<string>;
  headers: Array<DataTableHeader>;
  cellsById: Record<string, DataTableCell<string[]>>;
  inputValue: string;
  getCellId: (row: string, key: string) => string;
};

interface VisitTableRow extends MappedEncounter {
  formName: string;
}

const VisitTable: React.FC<VisitTableProps> = ({ showAllEncounters, visits, patientUuid, mutateVisits }) => {
  const visitCount = 20;
  const { t } = useTranslation();
  const desktopLayout = isDesktop(useLayoutType());
  const session = useSession();
  const searchClassName = typeof styles.search === 'string' ? styles.search : undefined;
  const tableHeaderClassName = typeof styles.tableHeader === 'string' ? styles.tableHeader : undefined;

  const [htmlFormEntryFormsConfig, setHtmlFormEntryFormsConfig] = useState<Array<HtmlFormEntryForm> | undefined>();

  useEffect(() => {
    getConfig('@sihsalus/esm-patient-forms-app').then((config) => {
      setHtmlFormEntryFormsConfig(config.htmlFormEntryForms as HtmlFormEntryForm[]);
    });
  }, []);

  const encounterTypes = [...new Set(visits.map((encounter) => encounter.encounterType))].sort((a, b) =>
    a.localeCompare(b),
  );

  const [filter, setFilter] = useState('');

  const filteredRows = useMemo(() => {
    if (!filter || filter === 'All') {
      return visits;
    }

    return visits?.filter((encounter) => encounter.encounterType === filter);
  }, [filter, visits]);

  const { results: paginatedVisits, goTo, currentPage } = usePagination(filteredRows ?? [], visitCount);

  const tableHeaders: DataTableHeader[] = [
    {
      header: t('dateAndTime', 'Date & time'),
      key: 'datetime',
    },
  ];

  if (showAllEncounters) {
    tableHeaders.push({
      header: t('visitType', 'Visit type'),
      key: 'visitType',
    });
  }

  tableHeaders.push(
    {
      header: t('encounterType', 'Encounter type'),
      key: 'encounterType',
    },
    {
      header: t('form', 'Form name'),
      key: 'formName',
    },
    {
      header: t('provider', 'Provider'),
      key: 'provider',
    },
  );

  const tableRows = useMemo<VisitTableRow[]>(() => {
    return paginatedVisits?.map((encounter) => ({
      ...encounter,
      formName: encounter.form?.display ?? '--',
      datetime: formatDatetime(parseDate(encounter.datetime)),
    }));
  }, [paginatedVisits]);

  const handleEncounterTypeChange = useCallback(({ selectedItem }) => setFilter(selectedItem), []);

  const handleDeleteEncounter = useCallback(
    (encounterUuid: string, encounterTypeName?: string) => {
      const close = showModal('delete-encounter-modal', {
        close: () => close(),
        encounterTypeName: encounterTypeName || '',
        onConfirmation: () => {
          const abortController = new AbortController();
          deleteEncounter(encounterUuid, abortController)
            .then(() => {
              mutateVisits?.();
              showSnackbar({
                isLowContrast: true,
                title: t('encounterDeleted', 'Encounter deleted'),
                subtitle: t('encounterSuccessfullyDeleted', 'The encounter has been deleted successfully'),
                kind: 'success',
              });
            })
            .catch(() => {
              showSnackbar({
                isLowContrast: false,
                title: t('error', 'Error'),
                subtitle: t(
                  'encounterWithError',
                  'The encounter could not be deleted successfully. If the error persists, please contact your system administrator.',
                ),
                kind: 'error',
              });
            });
          close();
        },
      });
    },
    [t, mutateVisits],
  );

  const handleFilter = useCallback(
    ({ rowIds, headers, cellsById, inputValue, getCellId }: FilterProps): Array<string> => {
      return rowIds.filter((rowId) =>
        headers.some(({ key }) => {
          const cellId = getCellId(rowId, key);
          const filterableValue = cellsById[cellId]?.value;
          const filterTerm = inputValue.toLowerCase();

          return String(filterableValue ?? '')
            .toLowerCase()
            .includes(filterTerm);
        }),
      );
    },
    [],
  );

  if (!visits?.length) {
    return (
      <div className={styles.container}>
        <EmptyState headerTitle={t('encounters', 'Encounters')} displayText={t('encounters__lower', 'encounters')} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DataTable
        filterRows={handleFilter}
        headers={tableHeaders}
        rows={tableRows}
        overflowMenuOnHover={desktopLayout}
        size={desktopLayout ? 'sm' : 'lg'}
        useZebraStyles={visits?.length > 1}
      >
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getExpandHeaderProps,
          getTableProps,
          getToolbarProps,
          onInputChange,
        }: DataTableRenderProps<VisitTableRow, string[]>) => (
          <>
            <TableContainer className={styles.tableContainer}>
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <div className={styles.filterContainer}>
                    <Dropdown
                      id="serviceFilter"
                      initialSelectedItem={t('all', 'All')}
                      label=""
                      titleText={t('filterByEncounterType', 'Filter by encounter type') + ':'}
                      type="inline"
                      items={[t('all', 'All'), ...encounterTypes]}
                      onChange={handleEncounterTypeChange}
                      size={desktopLayout ? 'sm' : 'lg'}
                    />
                  </div>
                  <TableToolbarSearch
                    className={searchClassName}
                    expanded
                    onChange={onInputChange}
                    placeholder={t('searchThisList', 'Search this list')}
                  />
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                    {headers.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });
                      return (
                        <TableHeader className={tableHeaderClassName} key={key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                    {showAllEncounters ? <TableExpandHeader /> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const selectedVisit = visits.find((visit) => visit.id === row.id);

                    return (
                      <React.Fragment key={row.id}>
                        {(() => {
                          const { key, ...rowProps } = getRowProps({ row });
                          return (
                            <TableExpandRow key={key} {...rowProps}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>{cell.value}</TableCell>
                              ))}
                              {showAllEncounters ? (
                                <TableCell className="cds--table-column-menu">
                                  <Layer className={styles.layer}>
                                    <OverflowMenu
                                      data-floating-menu-container
                                      aria-label="Encounter table actions menu"
                                      size={desktopLayout ? 'sm' : 'lg'}
                                      flipped
                                      align="left"
                                    >
                                      <OverflowMenuItem
                                        className={styles.menuItem}
                                        itemText={t('goToThisEncounter', 'Go to this encounter')}
                                      />
                                      {userHasAccess(selectedVisit?.editPrivilege, session?.user) &&
                                        selectedVisit?.form?.uuid && (
                                          <OverflowMenuItem
                                            className={styles.menuItem}
                                            itemText={t('editThisEncounter', 'Edit this encounter')}
                                            onClick={() => {
                                              launchFormEntryOrHtmlForms(
                                                htmlFormEntryFormsConfig,
                                                patientUuid,
                                                selectedVisit?.form?.uuid,
                                                selectedVisit?.visitUuid,
                                                selectedVisit?.id,
                                                selectedVisit?.form?.display,
                                                selectedVisit?.visitTypeUuid,
                                                selectedVisit?.visitStartDatetime,
                                                selectedVisit?.visitStopDatetime,
                                              );
                                            }}
                                          />
                                        )}
                                      {userHasAccess(selectedVisit?.editPrivilege, session?.user) && (
                                        <OverflowMenuItem
                                          className={styles.menuItem}
                                          itemText={t('deleteThisEncounter', 'Delete this encounter')}
                                          onClick={() =>
                                            handleDeleteEncounter(selectedVisit.id, selectedVisit.form?.display)
                                          }
                                          hasDivider
                                          isDelete
                                        />
                                      )}
                                    </OverflowMenu>
                                  </Layer>
                                </TableCell>
                              ) : null}
                            </TableExpandRow>
                          );
                        })()}
                        {row.isExpanded ? (
                          <TableExpandedRow className={styles.expandedRow} colSpan={headers.length + 2}>
                            <>
                              <EncounterObservations observations={selectedVisit?.obs} />
                              {userHasAccess(selectedVisit?.editPrivilege, session?.user) && (
                                <>
                                  {selectedVisit?.form?.uuid && (
                                    <Button
                                      kind="ghost"
                                      onClick={() => {
                                        launchFormEntryOrHtmlForms(
                                          htmlFormEntryFormsConfig,
                                          patientUuid,
                                          selectedVisit?.form?.uuid,
                                          selectedVisit?.visitUuid,
                                          selectedVisit?.id,
                                          selectedVisit?.form?.display,
                                          selectedVisit?.visitTypeUuid,
                                          selectedVisit?.visitStartDatetime,
                                          selectedVisit?.visitStopDatetime,
                                        );
                                      }}
                                      renderIcon={(props: ComponentProps<typeof EditIcon>) => (
                                        <EditIcon size={16} {...props} />
                                      )}
                                    >
                                      {t('editThisEncounter', 'Edit this encounter')}
                                    </Button>
                                  )}
                                  <Button
                                    kind="danger--ghost"
                                    onClick={() =>
                                      handleDeleteEncounter(selectedVisit?.id, selectedVisit?.form?.display)
                                    }
                                    renderIcon={(props: ComponentProps<typeof TrashCanIcon>) => (
                                      <TrashCanIcon size={16} {...props} />
                                    )}
                                  >
                                    {t('deleteThisEncounter', 'Delete this encounter')}
                                  </Button>
                                </>
                              )}
                            </>
                          </TableExpandedRow>
                        ) : (
                          <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noEncountersToDisplay', 'No encounters to display')}</p>
                    <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                  </div>
                </Tile>
              </div>
            ) : null}

            {showAllEncounters ? (
              <div className={styles.paginationContainer}>
                <PatientChartPagination
                  currentItems={paginatedVisits.length}
                  onPageNumberChange={({ page }) => goTo(page)}
                  pageNumber={currentPage}
                  pageSize={visitCount}
                  totalItems={filteredRows.length}
                />
              </div>
            ) : null}
          </>
        )}
      </DataTable>
    </div>
  );
};

export default VisitTable;
