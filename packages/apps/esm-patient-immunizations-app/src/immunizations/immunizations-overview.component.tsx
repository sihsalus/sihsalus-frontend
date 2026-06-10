/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  AddIcon,
  formatDate,
  launchWorkspace2,
  parseDate,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { immunizationEditPrivilege } from '../constants';
import { useImmunizations } from '../hooks/useImmunizations';
import styles from './immunizations-overview.scss';

export interface ImmunizationsOverviewProps {
  basePath: string;
  patient: fhir.Patient;
  patientUuid: string;
}

const ImmunizationsOverview: React.FC<ImmunizationsOverviewProps> = ({ patient: _patient, patientUuid, basePath }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(immunizationEditPrivilege, session?.user);
  const immunizationsCount = 5;
  const displayText = t('immunizations__lower', 'immunizations');
  const headerTitle = t('immunizations', 'Immunizations');
  const urlLabel = t('seeAll', 'See all');
  const pageUrl = globalThis.spaBase + basePath + '/immunizations';

  const { data: immunizations, error, isLoading, isValidating } = useImmunizations(patientUuid);
  const { results: paginatedImmunizations, goTo, currentPage } = usePagination(immunizations ?? [], immunizationsCount);

  const launchImmunizationsForm = React.useCallback(() => launchWorkspace2('vacunacion-form-workspace'), []);

  const tableHeaders = [
    {
      key: 'vaccineName',
      header: t('recentVaccination', 'Recent vaccination'),
    },
    {
      key: 'vaccinationDate',
      header: t('vaccinationDate', 'Vaccination date'),
    },
  ];

  const tableRows = useMemo(() => {
    return paginatedImmunizations?.map((immunization, index) => ({
      ...immunization,
      id: `${index}`,
      vaccineName: immunization.vaccineName,
      vaccinationDate:
        immunization.existingDoses.length > 0
          ? formatDate(parseDate(immunization.existingDoses[0].occurrenceDateTime), {
              day: false,
              time: false,
            })
          : '--',
    }));
  }, [paginatedImmunizations]);

  const content = isLoading ? (
    <DataTableSkeleton role="progressbar" />
  ) : error ? (
    <ErrorState error={error} headerTitle={headerTitle} />
  ) : immunizations?.length ? (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <span>{isValidating ? <InlineLoading /> : null}</span>
        {canEdit ? (
          <Button
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
            iconDescription={t('addImmunizations', 'Add immunizations')}
            onClick={launchImmunizationsForm}
          >
            {t('add', 'Add')}
          </Button>
        ) : null}
      </CardHeader>
      <DataTable headers={tableHeaders} rows={tableRows} isSortable size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table aria-label="immunizations overview" {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({
                      header,
                    });

                    return (
                      <TableHeader
                        key={key}
                        className={classNames(styles.productiveHeading01, styles.text02)}
                        {...headerProps}
                      >
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
                      <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <div className={styles.paginationContainer}>
        <PatientChartPagination
          currentItems={paginatedImmunizations.length}
          onPageNumberChange={({ page }) => goTo(page)}
          pageNumber={currentPage}
          pageSize={immunizationsCount}
          totalItems={immunizations.length}
          dashboardLinkUrl={pageUrl}
          dashboardLinkLabel={urlLabel}
        />
      </div>
    </div>
  ) : (
    <EmptyState
      displayText={displayText}
      headerTitle={headerTitle}
      launchForm={canEdit ? launchImmunizationsForm : undefined}
    />
  );

  return content;
};

export default ImmunizationsOverview;
