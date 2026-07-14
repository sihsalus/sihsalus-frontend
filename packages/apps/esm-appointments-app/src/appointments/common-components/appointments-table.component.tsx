import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
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
import { Download } from '@carbon/react/icons';
import {
  ConfigurableLink,
  formatDate,
  formatDatetime,
  isDesktop,
  launchWorkspace2,
  useConfig,
  useLayoutType,
  usePagination,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { appointmentsEditPrivilege } from '../../constants';
import { EmptyState } from '../../empty-state/empty-state.component';
import { isAppointmentEditable } from '../../helpers';
import { exportAppointmentsToSpreadsheet } from '../../helpers/excel';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment } from '../../types';
import AppointmentDetails from '../details/appointment-details.component';
import { getPageSizes, useAppointmentSearchResults } from '../utils';

import AppointmentActions from './appointments-actions.component';
import styles from './appointments-table.scss';

dayjs.extend(utc);
dayjs.extend(isToday);

interface AppointmentsTableProps {
  appointments: Array<Appointment>;
  isLoading: boolean;
  tableHeading: string;
  hasActiveFilters?: boolean;
}

const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
  appointments,
  isLoading,
  tableHeading,
  hasActiveFilters,
}) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(25);
  const [searchString, setSearchString] = useState('');
  const searchResults = useAppointmentSearchResults(appointments, searchString);
  const { results, goTo, currentPage } = usePagination(searchResults, pageSize);
  const { customPatientChartUrl, patientIdentifierType } = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(appointmentsEditPrivilege, session?.user);
  const { visits } = useTodaysVisits();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const translatedTableHeading = t(tableHeading);
  const isTodayAppointmentsTable =
    tableHeading === 'today' ||
    tableHeading === 'todaysAppointments' ||
    tableHeading === 'todayAppointments' ||
    /today/i.test(tableHeading) ||
    /hoy/i.test(translatedTableHeading);
  const appointmentSectionTitle = isTodayAppointmentsTable
    ? t('todaysAppointments', 'Today appointments')
    : `${translatedTableHeading} ${t('appointments', 'Appointments')}`;
  const emptyDisplayText = isTodayAppointmentsTable
    ? t('appointmentsScheduledForToday', 'appointments scheduled for today')
    : appointmentSectionTitle.toLocaleLowerCase();
  const headerData = [
    {
      header: t('patientName', 'Patient name'),
      key: 'patientName',
    },
    {
      header: t('identifier', 'Identifier'),
      key: 'identifier',
    },
    {
      header: t('dateTime', 'Date & Time'),
      key: 'dateTime',
    },
    {
      header: t('location', 'Location'),
      key: 'location',
    },
    {
      header: t('serviceType', 'Service type'),
      key: 'serviceType',
    },
    {
      header: t('status', 'Status'),
      key: 'status',
    },
  ];

  const rowData = results?.map((appointment) => ({
    id: appointment.uuid,
    patientName: (
      <ConfigurableLink
        className={styles.link}
        to={customPatientChartUrl}
        templateParams={{ patientUuid: appointment.patient.uuid }}
      >
        {appointment.patient.name}
      </ConfigurableLink>
    ),
    nextAppointmentDate: '--',
    identifier: patientIdentifierType
      ? (appointment.patient[patientIdentifierType.replaceAll(' ', '')] ?? appointment.patient.identifier)
      : appointment.patient.identifier,
    dateTime: formatDatetime(new Date(appointment.startDateTime)),
    serviceType: appointment.service.name,
    location: appointment.location?.name,
    provider: appointment.provider,
    status: <AppointmentActions appointment={appointment} />,
  }));

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" rowCount={5} />;
  }

  if (hasActiveFilters && !appointments?.length) {
    return (
      <div className={styles.filterEmptyState}>
        <Layer level={0}>
          <Tile className={styles.filterEmptyStateTile}>
            <p className={styles.filterEmptyStateContent}>
              {t('noMatchingAppointments', 'No matching appointments found')}
            </p>
            <p className={styles.filterEmptyStateHelper}>{t('checkFilters', 'Check the filters above')}</p>
          </Tile>
        </Layer>
      </div>
    );
  }

  if (!appointments?.length) {
    return (
      <EmptyState
        headerTitle={appointmentSectionTitle}
        displayText={emptyDisplayText}
        launchForm={canEdit ? () => launchWorkspace2('appointments-patient-search-workspace') : undefined}
      />
    );
  }

  return (
    <Layer className={styles.container}>
      <Tile className={styles.headerContainer}>
        <div className={isDesktop(layout) ? styles.desktopHeading : styles.tabletHeading}>
          <h4>{appointmentSectionTitle}</h4>
        </div>
      </Tile>
      <div className={styles.toolbar}>
        <Search
          className={styles.searchbar}
          labelText=""
          placeholder={t('filterTable', 'Filter table')}
          onChange={(event) => setSearchString(event.target.value)}
          size={responsiveSize}
        />
        <Button
          size={responsiveSize}
          kind="tertiary"
          renderIcon={Download}
          onClick={() => {
            const date = appointments[0]?.startDateTime
              ? formatDate(new Date(appointments[0].startDateTime), {
                  time: false,
                  noToday: true,
                })
              : null;
            exportAppointmentsToSpreadsheet(appointments, rowData, `${tableHeading}_appointments_${date}`);
          }}
        >
          {t('download', 'Download')}
        </Button>
      </div>
      <DataTable
        aria-label={t('appointmentsTable', 'Appointments table')}
        data-floating-menu-container
        rows={rowData}
        headers={headerData}
        isSortable
        size={responsiveSize}
        useZebraStyles
      >
        {({
          rows,
          headers,
          getExpandHeaderProps,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <>
            <TableContainer {...getTableContainerProps()}>
              <Table {...getTableProps()}>
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
                    <TableHeader />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const matchingAppointment = appointments.find((appointment) => appointment.uuid === row.id);
                    const patientUuid = matchingAppointment.patient?.uuid;
                    const visitDate = dayjs(matchingAppointment.startDateTime);
                    const isFutureAppointment = visitDate.isAfter(dayjs());
                    const isTodayAppointment = visitDate.isToday();
                    const hasActiveVisitToday = visits?.some(
                      (visit) => visit?.patient?.uuid === patientUuid && visit?.startDatetime,
                    );

                    return (
                      <React.Fragment key={row.id}>
                        {(() => {
                          const { key, ...rowProps } = getRowProps({ row });

                          return (
                            <TableExpandRow key={key} {...rowProps}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                              ))}
                              <TableCell className="cds--table-column-menu">
                                {canEdit &&
                                isAppointmentEditable(matchingAppointment.status) &&
                                (isFutureAppointment || (isTodayAppointment && !hasActiveVisitToday)) ? (
                                  <OverflowMenu
                                    align="left"
                                    aria-label={t('actions', 'Actions')}
                                    flipped
                                    size={responsiveSize}
                                  >
                                    <OverflowMenuItem
                                      className={styles.menuItem}
                                      itemText={t('editAppointment', 'Edit appointment')}
                                      onClick={() =>
                                        launchWorkspace2('appointments-form-workspace', {
                                          patientUuid: matchingAppointment.patient.uuid,
                                          appointment: matchingAppointment,
                                          context: 'editing',
                                          workspaceTitle: t('editAppointment', 'Edit appointment'),
                                        })
                                      }
                                    />
                                  </OverflowMenu>
                                ) : null}
                              </TableCell>
                            </TableExpandRow>
                          );
                        })()}
                        {row.isExpanded ? (
                          <TableExpandedRow className={styles.expandedRow} colSpan={headers.length + 2}>
                            <AppointmentDetails appointment={matchingAppointment} />
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
                <Layer>
                  <Tile className={styles.tile}>
                    <div className={styles.tileContent}>
                      <p className={styles.content}>{t('noAppointmentsToDisplay', 'No appointments to display')}</p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </Layer>
              </div>
            ) : null}
          </>
        )}
      </DataTable>
      <Pagination
        backwardText={t('previousPage', 'Previous page')}
        forwardText={t('nextPage', 'Next page')}
        itemsPerPageText={t('itemsPerPage', 'Items per page') + ':'}
        page={currentPage}
        pageNumberText={t('pageNumber', 'Page number')}
        pageSize={pageSize}
        pageSizes={getPageSizes(appointments, pageSize) ?? []}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
        totalItems={appointments.length ?? 0}
      />
    </Layer>
  );
};

export default AppointmentsTable;
