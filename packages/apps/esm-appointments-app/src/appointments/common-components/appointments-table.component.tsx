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
  showModal,
  useConfig,
  useLayoutType,
  usePagination,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { appointmentsEditPrivilege, clinicalChartPrivilege } from '../../constants';
import { EmptyState } from '../../empty-state/empty-state.component';
import { canTransition, isAppointmentEditable } from '../../helpers';
import { exportAppointmentsToSpreadsheet } from '../../helpers/excel';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment, AppointmentStatus } from '../../types';
import AppointmentDetails from '../details/appointment-details.component';
import { getPageSizes, useAppointmentSearchResults } from '../utils';

import AppointmentActions from './appointments-actions.component';
import styles from './appointments-table.scss';

dayjs.extend(utc);
dayjs.extend(isToday);

interface AppointmentsTableProps {
  appointmentStatus?: string;
  appointments: Array<Appointment>;
  isLoading: boolean;
  tableHeading: string;
  hasActiveFilters?: boolean;
}

const normalizeIdentifierType = (value?: string) =>
  value
    ?.trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const dniIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';

function isDniIdentifierType(value?: string) {
  const normalizedType = normalizeIdentifierType(value);
  return normalizedType === 'dni' || normalizedType?.includes('documento nacional de identidad');
}

function resolveDniIdentifier(appointment: Appointment) {
  const identifiers = appointment.patient.identifiers ?? [];
  const getIdentifierType = (identifier?: (typeof identifiers)[number]) =>
    identifier?.identifierName ?? identifier?.identifierType?.name ?? identifier?.identifierType?.display;
  const dniIdentifier = identifiers.find((identifier) => {
    return (
      identifier.identifierType?.uuid === dniIdentifierTypeUuid || isDniIdentifierType(getIdentifierType(identifier))
    );
  });

  return dniIdentifier?.identifier?.trim() || undefined;
}

function resolveFhirDniIdentifier(patient?: fhir.Patient | null) {
  const dniIdentifier = patient?.identifier?.find((identifier) => {
    const type = identifier.type;
    return (
      isDniIdentifierType(type?.text) ||
      type?.coding?.some(
        (coding) =>
          coding.code === dniIdentifierTypeUuid ||
          isDniIdentifierType(coding.code) ||
          isDniIdentifierType(coding.display),
      )
    );
  });

  return dniIdentifier?.value?.trim() || undefined;
}

function PatientDniFromPatientResource({ patientUuid }: { patientUuid: string }) {
  const { patient, isLoading } = usePatient(patientUuid);
  const dni = resolveFhirDniIdentifier(patient);

  return <>{dni ?? (isLoading ? '…' : '-')}</>;
}

function PatientDniCell({ appointment }: { appointment: Appointment }) {
  const appointmentDni = resolveDniIdentifier(appointment);

  return appointmentDni ?? <PatientDniFromPatientResource patientUuid={appointment.patient.uuid} />;
}

const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
  appointmentStatus,
  appointments,
  isLoading,
  tableHeading,
  hasActiveFilters,
}) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(25);
  const [searchString, setSearchString] = useState('');
  const [editingAppointmentUuid, setEditingAppointmentUuid] = useState<string | null>(null);
  const searchResults = useAppointmentSearchResults(appointments, searchString);
  const { results, goTo, currentPage } = usePagination(searchResults, pageSize);
  const { customPatientChartUrl } = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(appointmentsEditPrivilege, session?.user);
  const canAccessPatientChart = userHasAccess(clinicalChartPrivilege, session?.user);
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
  const sectionTitlesByStatus: Partial<Record<AppointmentStatus, string>> = {
    [AppointmentStatus.SCHEDULED]: t('expectedAppointments', 'Expected appointments'),
    [AppointmentStatus.CHECKEDIN]: t('appointmentsInProgress', 'Appointments in progress'),
    [AppointmentStatus.COMPLETED]: t('completedAppointments', 'Completed appointments'),
    [AppointmentStatus.CANCELLED]: t('cancelledAppointments', 'Cancelled appointments'),
    [AppointmentStatus.MISSED]: t('missedAppointments', 'Missed appointments'),
  };
  const sectionTitlesByConfigKey: Record<string, string | undefined> = {
    expected: sectionTitlesByStatus[AppointmentStatus.SCHEDULED],
    expectedAppointmentsTab: sectionTitlesByStatus[AppointmentStatus.SCHEDULED],
    checkedIn: sectionTitlesByStatus[AppointmentStatus.CHECKEDIN],
    inProgressAppointmentsTab: sectionTitlesByStatus[AppointmentStatus.CHECKEDIN],
    completed: sectionTitlesByStatus[AppointmentStatus.COMPLETED],
    completedAppointmentsTab: sectionTitlesByStatus[AppointmentStatus.COMPLETED],
    cancelled: sectionTitlesByStatus[AppointmentStatus.CANCELLED],
    cancelledAppointmentsTab: sectionTitlesByStatus[AppointmentStatus.CANCELLED],
    missed: sectionTitlesByStatus[AppointmentStatus.MISSED],
    missedAppointmentsTab: sectionTitlesByStatus[AppointmentStatus.MISSED],
  };
  const statusSectionTitle = appointmentStatus
    ? sectionTitlesByStatus[appointmentStatus as AppointmentStatus]
    : undefined;
  const appointmentSectionTitle = isTodayAppointmentsTable
    ? t('scheduledForToday', 'Appointments scheduled today')
    : (statusSectionTitle ??
      sectionTitlesByConfigKey[tableHeading] ??
      `${translatedTableHeading} ${t('appointments', 'Appointments')}`);
  const emptyDisplayText = appointmentSectionTitle.toLocaleLowerCase();
  const resolvedDniIdentifiers = new Map(
    results?.map((appointment) => [appointment.uuid, resolveDniIdentifier(appointment)]),
  );
  const headerData = [
    {
      header: t('patientName', 'Patient name'),
      key: 'patientName',
    },
    {
      header: 'DNI',
      key: 'identifier',
    },
    {
      header: isTodayAppointmentsTable
        ? t('appointmentTime', 'Appointment time')
        : t('appointmentDateTime', 'Appointment date and time'),
      key: 'dateTime',
    },
    {
      header: t('location', 'UPSS'),
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
    patientName: canAccessPatientChart ? (
      <ConfigurableLink
        className={styles.link}
        to={customPatientChartUrl}
        templateParams={{ patientUuid: appointment.patient.uuid }}
      >
        {appointment.patient.name}
      </ConfigurableLink>
    ) : (
      appointment.patient.name
    ),
    nextAppointmentDate: '--',
    identifier: resolvedDniIdentifiers.get(appointment.uuid) ?? '-',
    dateTime: formatDatetime(new Date(appointment.startDateTime)),
    serviceType: appointment.service.name,
    location: appointment.location?.name ?? appointment.service.location?.display ?? '—',
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
                    const canEditAppointment =
                      canEdit &&
                      isAppointmentEditable(matchingAppointment.status) &&
                      (isFutureAppointment || (isTodayAppointment && !hasActiveVisitToday));
                    const canCancelAppointment =
                      canEdit && canTransition(matchingAppointment.status, AppointmentStatus.CANCELLED);

                    return (
                      <React.Fragment key={row.id}>
                        {(() => {
                          const { key, ...rowProps } = getRowProps({ row });

                          return (
                            <TableExpandRow
                              key={key}
                              {...rowProps}
                              aria-current={
                                editingAppointmentUuid === matchingAppointment.uuid ? 'true' : undefined
                              }
                              className={classNames(rowProps.className, {
                                [styles.editingRow]: editingAppointmentUuid === matchingAppointment.uuid,
                              })}
                            >
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'identifier' ? (
                                    <PatientDniCell appointment={matchingAppointment} />
                                  ) : (
                                    (cell.value?.content ?? cell.value)
                                  )}
                                </TableCell>
                              ))}
                              <TableCell className={classNames('cds--table-column-menu', styles.actionsCell)}>
                                {canEditAppointment || canCancelAppointment ? (
                                  <OverflowMenu
                                    align="left"
                                    aria-label={t('actions', 'Actions')}
                                    flipped
                                    iconDescription={t('actions', 'Actions')}
                                    size={responsiveSize}
                                  >
                                    {canEditAppointment ? (
                                      <OverflowMenuItem
                                        className={styles.menuItem}
                                        itemText={t('editAppointment', 'Edit appointment')}
                                        onClick={async () => {
                                          const appointmentUuid = matchingAppointment.uuid;
                                          const workspaceOpened = await launchWorkspace2(
                                            'appointments-form-workspace',
                                            {
                                              patientUuid: matchingAppointment.patient.uuid,
                                              appointment: matchingAppointment,
                                              context: 'editing',
                                              workspaceTitle: t('editAppointment', 'Edit appointment'),
                                              onWorkspaceClose: () =>
                                                setEditingAppointmentUuid((currentUuid) =>
                                                  currentUuid === appointmentUuid ? null : currentUuid,
                                                ),
                                            },
                                          );

                                          if (workspaceOpened) {
                                            setEditingAppointmentUuid(appointmentUuid);
                                          }
                                        }}
                                      />
                                    ) : null}
                                    {canCancelAppointment ? (
                                      <OverflowMenuItem
                                        className={styles.menuItem}
                                        hasDivider={canEditAppointment}
                                        id={`cancelAppointment-${matchingAppointment.uuid}`}
                                        isDelete
                                        itemText={t('cancelAppointment', 'Cancel appointment')}
                                        onClick={() => {
                                          const dispose = showModal('cancel-appointment-modal', {
                                            appointmentUuid: matchingAppointment.uuid,
                                            closeCancelModal: () => dispose(),
                                          });
                                        }}
                                      />
                                    ) : null}
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
