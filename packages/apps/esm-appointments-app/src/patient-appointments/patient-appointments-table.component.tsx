import {
  DataTable,
  type DataTableHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { formatDatetime, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AppointmentsActions from '../appointments/common-components/appointments-actions.component';
import { AppointmentStatusTag } from '../appointments/common-components/appointment-status-tag.component';
import { getAppointmentKindLabel, getAppointmentProviderName, getAppointmentStatusLabel } from '../helpers';
import { type Appointment } from '../types';

import { PatientAppointmentsActionMenu } from './patient-appointments-action-menu.component';
import styles from './patient-appointments-table.scss';

dayjs.extend(utc);

const pageSize = 10;

const renderHeaderLabel = (header: React.ReactNode): React.ReactNode =>
  typeof header === 'object' && header !== null && 'content' in header
    ? (header as { content: React.ReactNode }).content
    : header;

interface AppointmentTableProps {
  patientAppointments: Array<Appointment>;
  switchedView: boolean;
  setSwitchedView: (value: boolean) => void;
  patientUuid: string;
  allowCheckIn?: boolean;
}

const PatientAppointmentsTable: React.FC<AppointmentTableProps> = ({
  patientAppointments,
  patientUuid,
  switchedView,
  setSwitchedView,
  allowCheckIn = false,
}) => {
  const { t } = useTranslation();
  const { results: paginatedAppointments, currentPage, goTo } = usePagination(patientAppointments, pageSize);
  const isTablet = useLayoutType() === 'tablet';

  useEffect(() => {
    if (switchedView && currentPage !== 1) {
      goTo(1);
    }
  }, [switchedView, goTo, currentPage]);

  const tableHeaders: DataTableHeader[] = useMemo(
    () => [
      { key: 'date', header: t('date', 'Date') },
      { key: 'location', header: t('location', 'UPSS') },
      { key: 'service', header: t('service', 'Service') },
      { key: 'provider', header: t('provider', 'Provider') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'type', header: t('appointmentType', 'Appointment type') },
      { key: 'notes', header: t('notes', 'Notes') },
    ],
    [t],
  );

  const tableRows = useMemo(
    () =>
      paginatedAppointments?.map((appointment) => {
        return {
          id: appointment.uuid,
          date: formatDatetime(new Date(appointment.startDateTime), { mode: 'wide' }),
          location: appointment?.location?.name ? appointment?.location?.name : '——',
          service: appointment.service.name,
          provider: getAppointmentProviderName(appointment) ?? t('unassignedProvider', 'No provider assigned'),
          status: getAppointmentStatusLabel(appointment.status, t),
          type: appointment.appointmentKind ? getAppointmentKindLabel(appointment.appointmentKind, t) : '——',
          notes: appointment.comments ? appointment.comments : '——',
        };
      }),
    [paginatedAppointments, t],
  );
  const appointmentsByUuid = useMemo(
    () => new Map(paginatedAppointments.map((appointment) => [appointment.uuid, appointment])),
    [paginatedAppointments],
  );
  const columnClassNames: Record<string, string> = {
    date: styles.dateColumn,
    location: styles.locationColumn,
    service: styles.serviceColumn,
    provider: styles.providerColumn,
    status: styles.statusColumn,
    type: styles.typeColumn,
    notes: styles.notesColumn,
  };

  return (
    <div>
      <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table {...getTableProps()} className={styles.table}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, className, ...headerProps } = getHeaderProps({
                      header,
                      isSortable: header.isSortable,
                    });

                    return (
                      <TableHeader
                        key={key}
                        className={classNames(
                          className,
                          styles.productiveHeading01,
                          styles.text02,
                          columnClassNames[header.key],
                        )}
                        {...headerProps}
                      >
                        {renderHeaderLabel(header.header)}
                      </TableHeader>
                    );
                  })}
                  <TableHeader className={styles.actionsColumn}>{t('care', 'Atención')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const appointment = appointmentsByUuid.get(row.id);

                  return appointment ? (
                    <React.Fragment key={row.id}>
                      <TableRow data-appointment-row>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id} className={columnClassNames[cell.info.header]}>
                            {cell.info.header === 'status' ? (
                              <AppointmentStatusTag status={appointment.status} />
                            ) : (
                              (cell.value?.content ?? cell.value)
                            )}
                          </TableCell>
                        ))}
                        <TableCell className={classNames('cds--table-column-menu', styles.actionsColumn)}>
                          <div className={styles.actions}>
                            {allowCheckIn ? (
                              <AppointmentsActions appointment={appointment} checkInOnly />
                            ) : null}
                            <PatientAppointmentsActionMenu appointment={appointment} patientUuid={patientUuid} />
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow className={styles.responsiveDetailsRow}>
                        <TableCell colSpan={headers.length + 1}>
                          <dl className={styles.responsiveDetails}>
                            <div>
                              <dt>{t('location', 'UPSS')}</dt>
                              <dd>{appointment.location?.name ?? '—'}</dd>
                            </div>
                            <div>
                              <dt>{t('provider', 'Provider')}</dt>
                              <dd>
                                {getAppointmentProviderName(appointment) ??
                                  t('unassignedProvider', 'No provider assigned')}
                              </dd>
                            </div>
                            <div>
                              <dt>{t('appointmentType', 'Appointment type')}</dt>
                              <dd>{getAppointmentKindLabel(appointment.appointmentKind, t) || '—'}</dd>
                            </div>
                            <div>
                              <dt>{t('notes', 'Notes')}</dt>
                              <dd>{appointment.comments || '—'}</dd>
                            </div>
                          </dl>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ) : null;
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        currentItems={paginatedAppointments.length}
        totalItems={patientAppointments.length}
        onPageNumberChange={({ page }) => {
          setSwitchedView(false);
          goTo(page);
        }}
        pageNumber={currentPage}
        pageSize={pageSize}
      />
    </div>
  );
};

export default PatientAppointmentsTable;
