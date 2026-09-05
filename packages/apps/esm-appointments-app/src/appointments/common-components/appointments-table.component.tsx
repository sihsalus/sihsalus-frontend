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
  TableSelectAll,
  TableSelectRow,
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import {
  ConfigurableLink,
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
import { formatPersonName } from '@openmrs/esm-utils';
import classNames from 'classnames';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import { type ConfigObject } from '../../config-schema';
import { appointmentsEditPrivileges, clinicalChartPrivilege } from '../../constants';
import { EmptyState } from '../../empty-state/empty-state.component';
import {
  canTransition,
  getAppointmentKindLabel,
  getAppointmentProviderName,
  isAppointmentEditable,
} from '../../helpers';
import { createAppointmentsExportFileName, exportAppointmentsToSpreadsheet } from '../../helpers/excel';
import { formatCivilDocumentIdentifier } from '../../helpers/patient-identifiers';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment, AppointmentStatus } from '../../types';
import AppointmentDetails from '../details/appointment-details.component';
import { getPageSizes, sortAppointmentsByStartDateDescending, useAppointmentSearchResults } from '../utils';

import { AppointmentStatusTag } from './appointment-status-tag.component';
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

function PatientDocumentFromPatientResource({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { patient, isLoading, error } = usePatient(patientUuid);
  const document = formatCivilDocumentIdentifier([], patient?.identifier, {
    PASS: t('passport', 'Passport'),
    DIE: t('foreignIdentityDocument', 'Foreign identity document'),
  });

  if (isLoading) {
    return <span role="status">{t('loadingPatientDocument', 'Loading document...')}</span>;
  }

  if (error) {
    return (
      <Button
        aria-label={t('retryPatientDocument', 'Retry loading patient document')}
        kind="ghost"
        onClick={() => void mutate(['patient', patientUuid])}
        size="sm"
      >
        {t('retry', 'Retry')}
      </Button>
    );
  }

  return <>{document || '-'}</>;
}

function PatientDocumentCell({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const appointmentDocument = formatCivilDocumentIdentifier(appointment.patient.identifiers, [], {
    PASS: t('passport', 'Passport'),
    DIE: t('foreignIdentityDocument', 'Foreign identity document'),
  });

  return appointmentDocument || <PatientDocumentFromPatientResource patientUuid={appointment.patient.uuid} />;
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
  const sortedAppointments = useMemo(() => sortAppointmentsByStartDateDescending(appointments), [appointments]);
  const searchResults = useAppointmentSearchResults(sortedAppointments, searchString);
  const { results, goTo, currentPage } = usePagination(searchResults, pageSize);
  const { customPatientChartUrl } = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(appointmentsEditPrivileges, session?.user);
  const canAccessPatientChart = userHasAccess(clinicalChartPrivilege, session?.user);
  // Batch status changes are only offered on the expected (Scheduled) tab; the batch modal itself
  // restricts the reachable target statuses via canTransition.
  const allowBatchStatusChange = canEdit && appointmentStatus === AppointmentStatus.SCHEDULED;
  const { visits } = useTodaysVisits();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const translatedTableHeading = t(tableHeading, tableHeading);
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
  const resolvedDocumentIdentifiers = new Map(
    results?.map((appointment) => [
      appointment.uuid,
      formatCivilDocumentIdentifier(appointment.patient.identifiers, [], {
        PASS: t('passport', 'Passport'),
        DIE: t('foreignIdentityDocument', 'Foreign identity document'),
      }),
    ]),
  );
  const appointmentsByUuid = new Map(appointments.map((appointment) => [appointment.uuid, appointment]));
  const headerData = [
    {
      header: t('patientName', 'Patient name'),
      key: 'patientName',
    },
    {
      header: t('identityDocument', 'Document'),
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
      header: t('responsibleProvider', 'Responsible provider'),
      key: 'provider',
    },
    {
      header: t('appointmentType', 'Appointment type'),
      key: 'appointmentKind',
    },
    {
      header: t('status', 'Status'),
      key: 'status',
    },
    {
      header: t('care', 'Atención'),
      key: 'care',
    },
  ];
  const columnClassNames: Record<string, string> = {
    patientName: styles.patientColumn,
    identifier: styles.documentColumn,
    dateTime: styles.dateTimeColumn,
    location: classNames(styles.locationColumn, styles.tertiaryColumn),
    serviceType: styles.serviceColumn,
    provider: classNames(styles.providerColumn, styles.secondaryColumn),
    appointmentKind: classNames(styles.appointmentKindColumn, styles.secondaryColumn),
    status: styles.statusColumn,
    care: styles.careColumn,
  };

  const rowData = results?.map((appointment) => ({
    id: appointment.uuid,
    patientName: canAccessPatientChart ? (
      <ConfigurableLink
        className={styles.link}
        to={customPatientChartUrl}
        templateParams={{ patientUuid: appointment.patient.uuid }}
      >
        {formatPersonName(appointment.patient.name)}
      </ConfigurableLink>
    ) : (
      formatPersonName(appointment.patient.name)
    ),
    nextAppointmentDate: '--',
    identifier: resolvedDocumentIdentifiers.get(appointment.uuid) || '-',
    dateTime: formatDatetime(new Date(appointment.startDateTime)),
    serviceType: appointment.service.name,
    location: appointment.location?.name ?? appointment.service.location?.display ?? '—',
    provider: getAppointmentProviderName(appointment) ?? t('unassignedProvider', 'No provider assigned'),
    appointmentKind: getAppointmentKindLabel(appointment.appointmentKind, t),
    status: <AppointmentStatusTag status={appointment.status} />,
    care: <AppointmentActions appointment={appointment} />,
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
      <DataTable
        key={appointmentStatus ?? tableHeading}
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
          getSelectionProps,
          getTableProps,
          getTableContainerProps,
          selectedRows,
        }) => (
          <>
            <div className={styles.toolbar}>
              <Search
                className={styles.searchbar}
                labelText={t('filterTable', 'Filter table')}
                placeholder={t('filterTable', 'Filter table')}
                onChange={(event) => {
                  setSearchString(event.target.value);
                  goTo(1);
                }}
                size={responsiveSize}
                value={searchString}
              />
              {allowBatchStatusChange && selectedRows.length > 0 ? (
                <Button
                  size={responsiveSize}
                  kind="primary"
                  onClick={() => {
                    const selectedIds = new Set(selectedRows.map((selectedRow) => selectedRow.id));
                    const selectedAppointments = appointments.filter((appointment) =>
                      selectedIds.has(appointment.uuid),
                    );
                    const dispose = showModal('batch-change-appointment-statuses-modal', {
                      appointments: selectedAppointments,
                      closeModal: () => dispose(),
                    });
                  }}
                >
                  {t('changeAppointmentsStatus', 'Change appointments status')}
                </Button>
              ) : null}
              <Button
                size={responsiveSize}
                kind="tertiary"
                renderIcon={Download}
                onClick={() => {
                  const date = appointments[0]?.startDateTime
                    ? dayjs(appointments[0].startDateTime).format('YYYY-MM-DD')
                    : dayjs().format('YYYY-MM-DD');
                  const fileName = createAppointmentsExportFileName(
                    t('appointmentsExportFilename', 'Appointments'),
                    appointmentSectionTitle,
                    date,
                  );
                  exportAppointmentsToSpreadsheet(appointments, t, fileName);
                }}
              >
                {t('download', 'Download')}
              </Button>
            </div>
            <TableContainer {...getTableContainerProps()} className={styles.tableContainer}>
              <Table {...getTableProps()} className={styles.table}>
                <TableHead>
                  <TableRow>
                    <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                    {allowBatchStatusChange ? <TableSelectAll {...getSelectionProps()} /> : null}
                    {headers.map((header) => {
                      const { key, className, ...headerProps } = getHeaderProps({ header });

                      return (
                        <TableHeader
                          key={key}
                          {...headerProps}
                          className={classNames(className, columnClassNames[header.key])}
                          data-column={header.key}
                        >
                          {header.header}
                        </TableHeader>
                      );
                    })}
                    <TableHeader className={styles.actionsColumn} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const matchingAppointment = appointmentsByUuid.get(row.id);
                    if (!matchingAppointment) {
                      return null;
                    }
                    const patientUuid = matchingAppointment.patient?.uuid;
                    const visitDate = dayjs(matchingAppointment.startDateTime);
                    const isFutureAppointment = visitDate.isAfter(dayjs());
                    const isTodayAppointment = visitDate.isToday();
                    const hasActiveVisitToday = visits?.some(
                      (visit) => visit?.patient?.uuid === patientUuid && visit?.startDatetime && !visit?.stopDatetime,
                    );
                    const canEditAppointment =
                      canEdit &&
                      isAppointmentEditable(matchingAppointment.status) &&
                      (isFutureAppointment || (isTodayAppointment && !hasActiveVisitToday));
                    const canCancelAppointment =
                      canEdit && canTransition(matchingAppointment.status, AppointmentStatus.CANCELLED);
                    // Missed is a terminal status, so only offer it once the appointment day is over:
                    // a same-day appointment whose time already passed may still be a late arrival.
                    const canMarkMissed =
                      canEdit &&
                      canTransition(matchingAppointment.status, AppointmentStatus.MISSED) &&
                      visitDate.isBefore(dayjs(), 'day');

                    return (
                      <React.Fragment key={row.id}>
                        {(() => {
                          const { key, ...rowProps } = getRowProps({ row });

                          return (
                            <TableExpandRow
                              key={key}
                              {...rowProps}
                              aria-current={editingAppointmentUuid === matchingAppointment.uuid ? 'true' : undefined}
                              className={classNames(rowProps.className, {
                                [styles.editingRow]: editingAppointmentUuid === matchingAppointment.uuid,
                              })}
                            >
                              {allowBatchStatusChange ? <TableSelectRow {...getSelectionProps({ row })} /> : null}
                              {row.cells.map((cell) => (
                                <TableCell
                                  key={cell.id}
                                  className={columnClassNames[cell.info.header]}
                                  data-column={cell.info.header}
                                >
                                  {cell.info.header === 'identifier' ? (
                                    <PatientDocumentCell appointment={matchingAppointment} />
                                  ) : (
                                    (cell.value?.content ?? cell.value)
                                  )}
                                </TableCell>
                              ))}
                              <TableCell
                                className={classNames(
                                  'cds--table-column-menu',
                                  styles.actionsCell,
                                  styles.actionsColumn,
                                )}
                              >
                                {canEditAppointment || canMarkMissed || canCancelAppointment ? (
                                  <OverflowMenu
                                    align="left"
                                    aria-label={t('actionsForPatient', 'Acciones para {{patient}}', {
                                      patient: matchingAppointment.patient.name,
                                    })}
                                    flipped
                                    iconDescription={t('actionsForPatient', 'Acciones para {{patient}}', {
                                      patient: matchingAppointment.patient.name,
                                    })}
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
                                    {canMarkMissed ? (
                                      <OverflowMenuItem
                                        className={styles.menuItem}
                                        hasDivider={canEditAppointment}
                                        id={`markAsMissed-${matchingAppointment.uuid}`}
                                        itemText={t('markAsMissed', 'Mark as missed')}
                                        onClick={() => {
                                          const dispose = showModal('missed-appointment-modal', {
                                            appointmentUuid: matchingAppointment.uuid,
                                            closeModal: () => dispose(),
                                          });
                                        }}
                                      />
                                    ) : null}
                                    {canCancelAppointment ? (
                                      <OverflowMenuItem
                                        className={styles.menuItem}
                                        hasDivider={canEditAppointment || canMarkMissed}
                                        id={`cancelAppointment-${matchingAppointment.uuid}`}
                                        isDelete
                                        itemText={t('cancelAppointment', 'Cancel appointment')}
                                        onClick={() => {
                                          const dispose = showModal('cancel-appointment-modal', {
                                            appointment: matchingAppointment,
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
                          <TableExpandedRow
                            className={styles.expandedRow}
                            colSpan={headers.length + (allowBatchStatusChange ? 3 : 2)}
                          >
                            <AppointmentDetails appointment={matchingAppointment} />
                          </TableExpandedRow>
                        ) : (
                          <TableExpandedRow
                            className={styles.hiddenRow}
                            colSpan={headers.length + (allowBatchStatusChange ? 3 : 2)}
                          />
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
        pageSizes={getPageSizes(searchResults, pageSize) ?? []}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
        totalItems={searchResults.length ?? 0}
      />
    </Layer>
  );
};

export default AppointmentsTable;
