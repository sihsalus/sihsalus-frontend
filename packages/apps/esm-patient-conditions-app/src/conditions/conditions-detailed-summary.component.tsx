import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { AddIcon, formatPartialDate, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  CardHeader,
  ErrorState,
  getAntecedentTypeLabel,
  launchPatientWorkspace,
  matchesConditionStatusFilter,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { type ComponentProps, useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConditionTableHeader, useConditions, useConditionsSorting } from './conditions.resource';
import { ConditionsActionMenu } from './conditions-action-menu.component';
import { type ConditionStatusFilter, workspaceNamesBySection } from './conditions-categories';
import styles from './conditions-detailed-summary.scss';

interface ConditionsDetailedSummaryProps {
  patient: fhir.Patient;
}

function ConditionsDetailedTable({ patient }: ConditionsDetailedSummaryProps) {
  const { t } = useTranslation('@sihsalus/esm-patient-conditions-app');
  const statusFilterId = useId();
  const session = useSession();
  const canEdit = userHasAccess('app:hoja.clinica.condiciones.editar', session?.user);
  const headerTitle = t('antecedents', 'Antecedents');
  const [filter, setFilter] = useState<ConditionStatusFilter>('All');
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isDesktop = layout === 'small-desktop' || layout === 'large-desktop';

  const { conditions, error, isLoading, isValidating } = useConditions(patient.id);

  const filteredConditions = useMemo(
    () =>
      (conditions ?? []).filter(
        (condition) => filter === 'All' || matchesConditionStatusFilter(condition.clinicalStatus, filter),
      ),
    [filter, conditions],
  );

  const headers: Array<ConditionTableHeader> = useMemo(
    () => [
      {
        key: 'display',
        header: t('antecedent', 'Antecedent'),
        isSortable: true,
        sortFunc: (valueA, valueB) => valueA.display?.localeCompare(valueB.display),
      },
      {
        key: 'antecedentTypeRender',
        header: t('antecedentType', 'Antecedent type'),
        isSortable: true,
        sortFunc: (valueA, valueB) => valueA.antecedentTypeRender?.localeCompare(valueB.antecedentTypeRender),
      },
      {
        key: 'onsetDateTimeRender',
        header: t('dateOfOnset', 'Date of onset'),
        isSortable: true,
        sortFunc: (valueA, valueB) =>
          valueA.onsetDateTime && valueB.onsetDateTime
            ? new Date(valueA.onsetDateTime).getTime() - new Date(valueB.onsetDateTime).getTime()
            : 0,
      },
      {
        key: 'status',
        header: t('status', 'Status'),
        isSortable: true,
        sortFunc: (valueA, valueB) => valueA.clinicalStatus?.localeCompare(valueB.clinicalStatus),
      },
    ],
    [t],
  );

  const tableRows = useMemo(() => {
    return filteredConditions?.map((condition) => {
      return {
        ...condition,
        id: condition.id,
        condition: condition.display,
        abatementDateTime: condition.abatementDateTime,
        antecedentTypeRender: condition.antecedentType
          ? getAntecedentTypeLabel(condition.antecedentType, t)
          : (condition.categoryText ?? '--'),
        onsetDateTimeRender: condition.onsetDateTime
          ? formatPartialDate(condition.onsetDateTime, { mode: 'wide', time: 'for today' })
          : '--',
        status: t(condition.clinicalStatus.toLowerCase(), condition.clinicalStatus),
      };
    });
  }, [filteredConditions, t]);

  const { sortedRows, sortRow, onHeaderClick } = useConditionsSorting(headers, tableRows);

  const launchConditionsForm = useCallback(() => {
    launchPatientWorkspace(workspaceNamesBySection.antecedents, {
      formContext: 'creating',
      workspaceTitle: t('recordAntecedent', 'Record antecedent'),
    });
  }, [t]);

  const handleConditionStatusChange = ({ selectedItem }) => setFilter(selectedItem.id);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (conditions?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          <div className={styles.rightMostFlexContainer}>
            <div className={styles.filterContainer}>
              <Dropdown
                id={statusFilterId}
                initialSelectedItem={{
                  id: 'All',
                  label: t('all', 'All'),
                }}
                label=""
                titleText={t('show', 'Show') + ':'}
                type="inline"
                items={[
                  { id: 'All', label: t('all', 'All') },
                  { id: 'Active', label: t('active', 'Active') },
                  { id: 'Inactive', label: t('inactive', 'Inactive') },
                ]}
                itemToString={(item) => (item ? item.label : '')}
                onChange={handleConditionStatusChange}
                size={isTablet ? 'lg' : 'sm'}
              />
            </div>
            <div className={styles.divider}>|</div>
            {canEdit ? (
              <Button
                kind="ghost"
                renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
                iconDescription={t('addAntecedent', 'Add antecedent')}
                onClick={launchConditionsForm}
              >
                {t('add', 'Add')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <DataTable
          rows={sortedRows}
          sortRow={sortRow}
          headers={headers}
          isSortable
          size={isTablet ? 'lg' : 'sm'}
          useZebraStyles
          overflowMenuOnHover={isDesktop}
        >
          {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
            <>
              <TableContainer>
                <Table
                  {...getTableProps()}
                  aria-label={t('antecedentsSummary', 'Antecedents summary')}
                  className={styles.table}
                >
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => {
                        const { key, ...headerProps } = getHeaderProps({
                          header,
                          onClick: onHeaderClick,
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
                      <TableHeader />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const matchingCondition = conditions.find((condition) => condition.id === row.id);
                      const { key, ...rowProps } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...rowProps}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {(cell.value?.content ?? cell.info.header === 'status')
                                ? t(cell.value.toLowerCase(), cell.value)
                                : cell.value}
                            </TableCell>
                          ))}
                          <TableCell className="cds--table-column-menu">
                            <ConditionsActionMenu patientUuid={patient.id} condition={matchingCondition} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {rows.length === 0 ? (
                <div className={styles.tileContainer}>
                  <Tile className={styles.tile}>
                    <div className={styles.tileContent}>
                      <p className={styles.content}>{t('noAntecedentsToDisplay', 'No antecedents to display')}</p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </div>
              ) : null}
            </>
          )}
        </DataTable>
      </div>
    );
  }
  return (
    <div className={styles.emptyState}>
      <p>{t('noAntecedentsToDisplay', 'No antecedents to display')}</p>
      {canEdit ? (
        <Button kind="ghost" size="sm" renderIcon={AddIcon} onClick={launchConditionsForm}>
          {t('recordAntecedent', 'Record antecedent')}
        </Button>
      ) : null}
    </div>
  );
}

function ConditionsDetailedSummary({ patient }: ConditionsDetailedSummaryProps) {
  return <ConditionsDetailedTable key={patient.id} patient={patient} />;
}

export default ConditionsDetailedSummary;
