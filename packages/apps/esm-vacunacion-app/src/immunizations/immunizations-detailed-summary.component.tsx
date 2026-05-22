import {
  Button,
  DataTable,
  DataTableSkeleton,
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
} from '@carbon/react';
import {
  AddIcon,
  formatDate,
  launchWorkspace2,
  parseDate,
  useConfig,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  PatientChartPagination,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImmunizationConfigObject } from '../config-schema';
import { useImmunizations } from '../hooks/useImmunizations';
import type { ImmunizationGrouped } from '../types';
import SequenceTable from './components/immunizations-sequence-table.component';
import styles from './immunizations-detailed-summary.scss';
import { immunizationFormSub, latestFirst, linkConfiguredSequences } from './utils';

interface ImmunizationsDetailedSummaryProps {
  patientUuid: string;
  launchStartVisitPrompt: () => void;
}

const ImmunizationsDetailedSummary: React.FC<ImmunizationsDetailedSummaryProps> = ({
  patientUuid,
  launchStartVisitPrompt,
}) => {
  const { t } = useTranslation();
  const config = useConfig<ImmunizationConfigObject>();
  const displayText = t('immunizations__lower', 'immunizations');
  const headerTitle = t('immunizations', 'Immunizations');
  const { currentVisit: visitContext } = useVisitOrOfflineVisit(patientUuid);
  const isTablet = useLayoutType() === 'tablet';
  const sequenceDefinitions = config.sequenceDefinitions;

  const { data: existingImmunizations, isLoading, error, isValidating } = useImmunizations(patientUuid);

  const consolidatedImmunizations = useMemo(() => {
    return linkConfiguredSequences(existingImmunizations, sequenceDefinitions);
  }, [existingImmunizations, sequenceDefinitions]);

  const launchImmunizationsForm = useCallback(() => {
    if (!visitContext) {
      launchStartVisitPrompt();
      return;
    }
    launchWorkspace2('vacunacion-form-workspace');
  }, [visitContext, launchStartVisitPrompt]);

  const sortedImmunizations = useMemo(() => {
    return consolidatedImmunizations.slice().sort((a, b) => {
      const latestTime = (imm: ImmunizationGrouped) => {
        if (!imm.existingDoses?.length) return 0;
        const latest = imm.existingDoses.reduce((prev, cur) =>
          new Date(cur.occurrenceDateTime) > new Date(prev.occurrenceDateTime) ? cur : prev,
        );
        return new Date(latest.occurrenceDateTime).getTime();
      };
      return latestTime(b) - latestTime(a);
    });
  }, [consolidatedImmunizations]);

  const tableHeader = useMemo(
    () => [
      { key: 'vaccine', header: t('vaccine', 'Vaccine') },
      { key: 'recentVaccination', header: t('recentVaccination', 'Recent vaccination') },
      { key: 'add', header: '' },
    ],
    [t],
  );

  const tableRows = useMemo(
    () =>
      sortedImmunizations?.map((immunization) => {
        const sortedDoses = immunization.existingDoses ? [...immunization.existingDoses].sort(latestFirst) : [];
        const latestDose = sortedDoses?.[0];

        const hasDoses = !!latestDose;
        const hasSequences = immunization.sequences?.length > 0;

        const sequenceLabel = hasSequences
          ? immunization.sequences.find((seq) => seq.sequenceNumber === latestDose?.doseNumber)?.sequenceLabel
          : null;

        const occurrenceDate = hasDoses
          ? `${t('lastDoseOnDate', 'Last dose on {{date}}', {
              date: formatDate(parseDate(latestDose.occurrenceDateTime), {
                mode: 'standard',
                noToday: true,
                time: false,
              }),
            })}, ${sequenceLabel ?? t('doseNumber', 'Dose {{number}}', { number: latestDose.doseNumber })}`
          : '';

        return {
          id: immunization.vaccineUuid,
          vaccine: immunization.vaccineName,
          recentVaccination: occurrenceDate,
          add: (
            <Button
              hasIconOnly
              iconDescription={t('add', 'Add')}
              kind="ghost"
              onClick={() => {
                immunizationFormSub.next({
                  vaccineUuid: immunization.vaccineUuid,
                  immunizationId: null,
                  vaccinationDate: null,
                  doseNumber: 0,
                  nextDoseDate: null,
                  note: '',
                  expirationDate: null,
                  lotNumber: null,
                  manufacturer: null,
                });
                launchImmunizationsForm();
              }}
              renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
              size="sm"
            />
          ),
        };
      }),
    [launchImmunizationsForm, sortedImmunizations, t],
  );

  const { results: paginatedImmunizations, currentPage, goTo } = usePagination(tableRows, 10);

  const immunizationsByVaccineUuid = useMemo(
    () => new Map(sortedImmunizations?.map((immunization) => [immunization.vaccineUuid, immunization]) ?? []),
    [sortedImmunizations],
  );

  if (isLoading || !sortedImmunizations) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (sortedImmunizations?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          <Button
            data-testid="add-immunizations-button"
            iconDescription={t('addImmunizations', 'Add immunizations')}
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
            onClick={launchImmunizationsForm}
          >
            {t('add', 'Add')}
          </Button>
        </CardHeader>

        <DataTable rows={paginatedImmunizations} headers={tableHeader} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({
            rows,
            headers,
            getExpandedRowProps,
            getHeaderProps,
            getRowProps,
            getTableProps,
            getExpandHeaderProps,
          }) => (
            <TableContainer>
              <Table aria-label="immunizations summary" size={isTablet ? 'md' : 'sm'} {...getTableProps()}>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const immunization = immunizationsByVaccineUuid.get(row.id);

                    return (
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
                          <TableExpandedRow {...getExpandedRowProps({ row })} colSpan={headers.length + 2}>
                            {immunization && (
                              <SequenceTable
                                immunizationsByVaccine={immunization}
                                launchPatientImmunizationForm={launchImmunizationsForm}
                                patientUuid={patientUuid}
                              />
                            )}
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
          )}
        </DataTable>
        <div className={styles.paginationContainer}>
          <PatientChartPagination
            totalItems={tableRows?.length}
            pageSize={10}
            onPageNumberChange={({ page }) => goTo(page)}
            pageNumber={currentPage}
            currentItems={paginatedImmunizations?.length}
          />
        </div>
      </div>
    );
  }

  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchImmunizationsForm} />;
};

export default ImmunizationsDetailedSummary;
