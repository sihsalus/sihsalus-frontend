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
import { getAppointmentKindLabel, getAppointmentStatusLabel } from '../helpers';
import { type Appointment } from '../types';

import { PatientAppointmentsActionMenu } from './patient-appointments-action-menu.component';
import styles from './patient-appointments-action-menu.scss';

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
}

const PatientAppointmentsTable: React.FC<AppointmentTableProps> = ({
  patientAppointments,
  patientUuid,
  switchedView,
  setSwitchedView,
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
      { key: 'location', header: t('location', 'Location') },
      { key: 'service', header: t('service', 'Service') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'type', header: t('type', 'Type') },
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
          status: getAppointmentStatusLabel(appointment.status, t),
          type: appointment.appointmentKind ? getAppointmentKindLabel(appointment.appointmentKind, t) : '——',
          notes: appointment.comments ? appointment.comments : '——',
        };
      }),
    [paginatedAppointments, t],
  );

  return (
    <div>
      <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({
                      header,
                      isSortable: header.isSortable,
                    });

                    return (
                      <TableHeader
                        key={key}
                        className={classNames(styles.productiveHeading01, styles.text02)}
                        {...headerProps}
                      >
                        {renderHeaderLabel(header.header)}
                      </TableHeader>
                    );
                  })}
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                    ))}
                    <TableCell className="cds--table-column-menu">
                      <PatientAppointmentsActionMenu appointment={paginatedAppointments[i]} patientUuid={patientUuid} />
                    </TableCell>
                  </TableRow>
                ))}
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
