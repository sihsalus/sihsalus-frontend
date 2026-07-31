import {
  Button,
  DataTable,
  DataTableSkeleton,
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
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, usePagination } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { EmptyState } from '../../empty-state/empty-state.component';
import { createAppointmentsExportFileName, exportUnscheduledAppointmentsToSpreadsheet } from '../../helpers/excel';
import { getGender } from '../../helpers/functions';
import { useUnscheduledAppointments } from '../../hooks/useUnscheduledAppointments';
import { getPageSizes, useSearchResults } from '../utils';

const UnscheduledAppointments: React.FC = () => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(25);

  const [searchString, setSearchString] = useState('');
  const { data: unscheduledAppointments, isLoading } = useUnscheduledAppointments();
  const searchResults = useSearchResults(unscheduledAppointments, searchString);
  const { customPatientChartUrl } = useConfig<ConfigObject>();

  const headerData = [
    {
      header: t('patientName', 'Patient name'),
      key: 'name',
    },
    {
      header: t('patientIdentifiers', 'Patient identifiers'),
      key: 'identifier',
    },
    {
      header: t('gender', 'Gender'),
      key: 'gender',
    },
    {
      header: t('phoneNumber', 'Phone number'),
      key: 'phoneNumber',
    },
  ];

  const { results, currentPage, goTo } = usePagination(searchResults, pageSize);
  const rowData = results?.map((visit) => ({
    id: `${visit.uuid}`,
    name: (
      <ConfigurableLink
        style={{ textDecoration: 'none' }}
        to={customPatientChartUrl}
        templateParams={{ patientUuid: visit.uuid }}
      >
        {visit.name}
      </ConfigurableLink>
    ),
    gender: getGender(visit.gender, t),
    phoneNumber: visit.phoneNumber === '' ? '--' : visit.phoneNumber,
    identifier: visit?.identifier,
  }));

  if (isLoading) {
    return <DataTableSkeleton />;
  }

  if (!unscheduledAppointments?.length) {
    return (
      <EmptyState
        displayText={t('unscheduledAppointments_lower', 'unscheduled appointments')}
        headerTitle={t('unscheduledAppointments', 'Unscheduled appointments')}
      />
    );
  }

  return (
    <div>
      <DataTable rows={rowData} headers={headerData} isSortable>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer
            title={`${t('unscheduledAppointments', 'Unscheduled appointments')} ${unscheduledAppointments.length}`}
            description={`${t(`Total ${unscheduledAppointments.length ?? 0}`)}`}
          >
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  style={{ backgroundColor: '#f4f4f4' }}
                  tabIndex={0}
                  onChange={(value) => setSearchString(typeof value === 'string' ? value : '')}
                />
                <Button
                  size="lg"
                  kind="tertiary"
                  renderIcon={Download}
                  onClick={() =>
                    exportUnscheduledAppointmentsToSpreadsheet(
                      unscheduledAppointments,
                      t,
                      createAppointmentsExportFileName(
                        t('appointmentsExportFilename', 'Appointments'),
                        t('unscheduledAppointments', 'Unscheduled appointments'),
                        dayjs().format('YYYY-MM-DD'),
                      ),
                    )
                  }
                >
                  {t('download', 'Download')}
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
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
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        backwardText={t('previousPage', 'Previous page')}
        forwardText={t('nextPage', 'Next page')}
        page={currentPage}
        pageNumberText={t('pageNumber', 'Page number')}
        pageSize={pageSize}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
        pageSizes={getPageSizes(unscheduledAppointments, pageSize) ?? []}
        totalItems={unscheduledAppointments.length ?? 0}
      />
    </div>
  );
};

export default UnscheduledAppointments;
