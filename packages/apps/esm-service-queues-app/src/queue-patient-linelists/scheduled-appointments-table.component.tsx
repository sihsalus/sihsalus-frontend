import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
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
  Tag,
  Tile,
} from '@carbon/react';
import { Filter, OverflowMenuVertical } from '@carbon/react/icons';
import {
  ConfigurableLink,
  ExtensionSlot,
  formatDate,
  formatDatetime,
  launchWorkspace,
  useConfig,
  usePagination,
} from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';
import { getGender } from '../helpers/functions';
import { updateSelectedAppointmentStatus, useServiceQueuesStore } from '../store/store';
import { useAppointments } from './queue-linelist.resource';
import styles from './queue-linelist-base-table.scss';

/**
 * FIXME Temporarily moved here
 */
interface ScheduledAppointmentsDataTableHeader {
  key: string;
  header: React.ReactNode;
}

type FilterProps = {
  rowIds: Array<string>;
  headers: Array<ScheduledAppointmentsDataTableHeader>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellsById: any;
  inputValue: string;
  getCellId: (row, key) => string;
};

const AppointmentsTable: React.FC = () => {
  const { t } = useTranslation();
  const { appointmentStatuses } = useConfig<ConfigObject>();
  const { selectedAppointmentStatus: currentAppointmentStatus } = useServiceQueuesStore();
  const { appointmentQueueEntries, isLoading } = useAppointments();
  const [filteredRows, setFilteredRows] = useState(appointmentQueueEntries);
  const { results, currentPage, goTo } = usePagination(filteredRows ?? [], 20);
  const searchClassName = typeof styles.search === 'string' ? styles.search : undefined;

  const handleFilter = ({ rowIds, headers, cellsById, inputValue, getCellId }: FilterProps): Array<string> => {
    return rowIds.filter((rowId) =>
      headers.some(({ key }) => {
        const cellId = getCellId(rowId, key);
        const filterableValue = cellsById[cellId].value;
        const filterTerm = inputValue.toLowerCase();

        if (typeof filterableValue === 'boolean') {
          return false;
        }
        if (Object.hasOwn(filterableValue, 'content')) {
          if (Array.isArray(filterableValue.content.props.children)) {
            return ('' + filterableValue.content.props.children[1].props.children).toLowerCase().includes(filterTerm);
          }
          if (typeof filterableValue.content.props.children === 'object') {
            return ('' + filterableValue.content.props.children.props.children.props.children)
              .toLowerCase()
              .includes(filterTerm);
          }
          return ('' + filterableValue.content.props.children).toLowerCase().includes(filterTerm);
        }
        return ('' + filterableValue).toLowerCase().includes(filterTerm);
      }),
    );
  };

  useEffect(() => {
    if (currentAppointmentStatus !== t('all', 'All') && currentAppointmentStatus !== '') {
      setFilteredRows(
        appointmentQueueEntries?.filter((appointment) => appointment.status === currentAppointmentStatus),
      );
    } else {
      setFilteredRows(appointmentQueueEntries);
    }
  }, [t, currentAppointmentStatus, appointmentQueueEntries]);

  const tableHeaders = useMemo(
    () => [
      {
        id: 0,
        header: t('name', 'Name'),
        key: 'name',
      },
      {
        id: 1,
        header: t('returnDate', 'Return Date'),
        key: 'returnDate',
      },
      {
        id: 2,
        header: t('gender', 'Gender'),
        key: 'gender',
      },
      {
        id: 3,
        header: t('age', 'Age'),
        key: 'age',
      },
      {
        id: 4,
        header: t('visitType', 'Care type'),
        key: 'visitType',
      },
      {
        id: 5,
        header: t('status', 'Status'),
        key: 'status',
      },
      {
        id: 6,
        header: t('phoneNumber', 'Phone number'),
        key: 'phoneNumber',
      },
    ],
    [t],
  );

  const tableRows = useMemo(() => {
    return results?.map((appointment) => ({
      id: appointment.uuid,
      name: {
        content: (
          <ConfigurableLink to={`${globalThis.spaBase}/patient/${appointment.patient.uuid}/chart`}>
            {appointment.patient.name}
          </ConfigurableLink>
        ),
      },
      returnDate: formatDate(new Date(appointment.startDateTime), {
        mode: 'wide',
      }),
      gender: getGender(appointment.patient?.gender, t),
      age: appointment.patient.age,
      visitType: appointment.appointmentKind,
      status: appointment.status,
      phoneNumber: appointment.patient?.phoneNumber,
    }));
  }, [results, t]);

  const handleStatusChange = ({ selectedItem }) => {
    updateSelectedAppointmentStatus(selectedItem);
  };

  const pageSizes = useMemo(() => {
    const numberOfPages = Math.ceil((appointmentQueueEntries?.length ?? 0) / 100);
    return [...Array(numberOfPages).keys()].map((x) => {
      return (x + 1) * 100;
    });
  }, [appointmentQueueEntries]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <div className={styles.container}>
      <ExtensionSlot name="breadcrumbs-slot" />

      <div className={styles.headerContainer}>
        <div>
          <p className={styles.title}>{t('scheduledAppointmentsList', 'Scheduled appointments patient list')}</p>
          <p className={styles.subTitle}>
            {appointmentQueueEntries?.length} · {t('lastUpdated', 'Last updated')}:{' '}
            {formatDatetime(new Date(), { mode: 'standard' })}
          </p>
        </div>

        <Button kind="ghost" size="sm" renderIcon={(props) => <OverflowMenuVertical size={16} {...props} />}>
          {t('actions', 'Actions')}
        </Button>
      </div>

      <Layer>
        <Tile className={styles.filterTile}>
          <Tag size="md" type="blue">
            {t('today', 'Today')}
          </Tag>

          <div className={styles.actionsBtn}>
            <Button
              kind="ghost"
              renderIcon={(props) => <Filter size={16} {...props} />}
              iconDescription={t('filter', 'Filter')}
              onClick={() => launchWorkspace('service-queues-linelist-filter')}
              size="sm"
            >
              {t('filter', 'Filter')}
            </Button>
          </div>
        </Tile>
      </Layer>

      <DataTable
        data-floating-menu-container
        filterRows={handleFilter}
        headers={tableHeaders}
        overflowMenuOnHover={false}
        rows={tableRows}
        size="md"
        useZebraStyles
      >
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, onInputChange }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar
              style={{
                position: 'static',
                height: '3rem',
                overflow: 'visible',
                backgroundColor: 'color',
              }}
            >
              <TableToolbarContent className={styles.toolbarContent}>
                <div className={styles.filterContainer}>
                  <Dropdown
                    id="serviceFilter"
                    initialSelectedItem={'All'}
                    label={currentAppointmentStatus}
                    titleText={t('status', 'Status') + ':'}
                    type="inline"
                    items={['All', ...appointmentStatuses]}
                    onChange={handleStatusChange}
                    size="sm"
                  />
                </div>

                <TableToolbarSearch
                  className={searchClassName}
                  expanded
                  onChange={onInputChange}
                  placeholder={t('searchThisList', 'Search this list')}
                  size="sm"
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} className={styles.queueTable}>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, _index) => {
                  return (
                    <React.Fragment key={row.id}>
                      {(() => {
                        const { key, ...rowProps } = getRowProps({ row });
                        return (
                          <TableRow key={key} {...rowProps}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                            ))}
                          </TableRow>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Layer>
                  <Tile className={styles.tile}>
                    <div className={styles.tileContent}>
                      <p className={styles.content}>{t('noPatientsToDisplay', 'No patients to display')}</p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </Layer>
              </div>
            ) : null}
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        backwardText={t('previousPage', 'Previous page')}
        forwardText={t('nextPage', 'Next page')}
        itemRangeText={(min, max, total) => t('itemRange', '{{min}}-{{max}} of {{total}} items', { min, max, total })}
        itemsPerPageText={t('itemsPerPage', 'Items per page:')}
        page={currentPage}
        pageNumberText={t('pageNumber', 'Page Number')}
        pageRangeText={(_current, total) =>
          total === 1
            ? t('pageRangeSingular', 'of {{total}} page', { total })
            : t('pageRangePlural', 'of {{total}} pages', { total })
        }
        pageSize={100}
        pageText={(page) => t('pageText', 'page {{page}}', { page })}
        onChange={({ page }) => goTo(page)}
        pageSizes={pageSizes?.length > 0 ? pageSizes : [100]}
        totalItems={appointmentQueueEntries?.length ?? 0}
      />
    </div>
  );
};

export default AppointmentsTable;
