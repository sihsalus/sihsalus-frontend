import {
  DataTable,
  type DataTableHeader,
  InlineLoading,
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
import { formatDatetime, parseDate, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import EncounterObservations from '../encounter-observations';
import { type Observation, useEncounters } from '../visit.resource';

import styles from './encounters-table.scss';

interface Encounter {
  datetime?: string;
  display?: string;
  encounterType?: {
    display?: string;
  };
  obs?: Array<Record<string, unknown>>;
  uuid?: string;
  [key: string]: unknown;
}

interface EncountersTableProps {
  encounters: Array<Encounter>;
  showAllEncounters?: boolean;
}

const transformEncounters = (inData?: Array<Encounter>) => {
  if (!inData) return [];
  return inData.map((item) => ({
    ...item,
    id: item.uuid,
    datetime: formatDatetime(parseDate(item?.datetime)),
  }));
};

const EncountersTable: React.FC<EncountersTableProps> = ({ showAllEncounters, encounters }) => {
  const encountersCount = 20;
  const { t } = useTranslation();
  const { results: paginatedEncounters, goTo, currentPage } = usePagination(encounters ?? [], encountersCount);
  const isTablet = useLayoutType() === 'tablet';
  const searchClassName = typeof styles.search === 'string' ? styles.search : undefined;
  const tableHeaderClassName = typeof styles.tableHeader === 'string' ? styles.tableHeader : undefined;

  const tableHeaders: DataTableHeader[] = [
    {
      header: t('dateAndTime', 'Date & time'),
      key: 'encounterDatetime',
    },
    {
      header: t('name', 'Name'),
      key: 'display',
    },
    {
      header: t('encounterType', 'Encounter type'),
      key: 'encounterType.display',
    },
  ];

  if (!encounters?.length) {
    return (
      <p className={classNames(styles.bodyLong01, styles.text02)}>{t('noEncountersFound', 'No encounters found')}</p>
    );
  }

  const tableRows = transformEncounters(encounters);

  return (
    <DataTable
      data-floating-menu-container
      headers={tableHeaders}
      rows={tableRows}
      overflowMenuOnHover={!isTablet}
      size={isTablet ? 'lg' : 'xs'}
      useZebraStyles={true}
    >
      {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getToolbarProps, onInputChange }) => (
        <>
          <TableContainer className={styles.tableContainer}>
            <TableToolbar {...getToolbarProps()}>
              <TableToolbarContent>
                <TableToolbarSearch
                  className={searchClassName}
                  expanded
                  onChange={onInputChange}
                  placeholder={t('searchThisList', 'Search this list')}
                  size={isTablet ? 'lg' : 'sm'}
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader />
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
                {rows.map((row, i) => (
                  <React.Fragment key={row.id}>
                    {(() => {
                      const { key, ...rowProps } = getRowProps({ row });
                      return (
                        <TableExpandRow key={key} {...rowProps}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableExpandRow>
                      );
                    })()}
                    {row.isExpanded ? (
                      <TableExpandedRow
                        className={styles.expandedRow}
                        style={{ paddingLeft: isTablet ? '4rem' : '3rem' }}
                        colSpan={headers.length + 2}
                      >
                        <EncounterObservations
                          observations={(encounters[i].obs ?? []) as unknown as Array<Observation>}
                        />
                      </TableExpandedRow>
                    ) : (
                      <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                    )}
                  </React.Fragment>
                ))}
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
            <PatientChartPagination
              currentItems={paginatedEncounters.length}
              onPageNumberChange={({ page }) => goTo(page)}
              pageNumber={currentPage}
              pageSize={encountersCount}
              totalItems={encounters.length}
            />
          ) : null}
        </>
      )}
    </DataTable>
  );
};

const EncountersTableLifecycle = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { encounters, error, isLoading } = useEncounters(patientUuid);

  if (isLoading) {
    return <InlineLoading description={`${t('loading', 'Loading')} ...`} role="progressbar" />;
  }

  if (error) {
    return <ErrorState headerTitle={t('encounters', 'Encounters')} error={error} />;
  }

  if (!encounters?.length) {
    return (
      <EmptyState headerTitle={t('encounters', 'Encounters')} displayText={t('encounters__lower', 'encounters')} />
    );
  }

  return <EncountersTable encounters={encounters} showAllEncounters />;
};

export default EncountersTable;
export { EncountersTableLifecycle };
