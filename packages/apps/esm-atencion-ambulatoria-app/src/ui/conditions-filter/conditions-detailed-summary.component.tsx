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
import { AddIcon, formatDate, launchWorkspace, parseDate, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, getAntecedentTypeLabel } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConditionTableHeader, useConditions, useConditionsSorting } from './conditions.resource';
import { ConditionsActionMenu } from './conditions-action-menu.component';
import styles from './conditions-detailed-summary.scss';

const renderHeaderLabel = (header: React.ReactNode): React.ReactNode =>
  typeof header === 'object' && header !== null && 'content' in header
    ? (header as { content: React.ReactNode }).content
    : header;

function ConditionsDetailedSummary({ patient }) {
  const { t } = useTranslation();
  const displayText = t('antecedents', 'Antecedents');
  const headerTitle = t('antecedents', 'Antecedents');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isDesktop = layout === 'small-desktop' || layout === 'large-desktop';

  const { conditions, error, isLoading, isValidating } = useConditions(patient.id);

  const filteredConditions = useMemo(() => {
    if (filter === 'All') {
      return conditions;
    }

    return conditions?.filter((condition) => condition.clinicalStatus === filter);
  }, [filter, conditions]);

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
          ? formatDate(parseDate(condition.onsetDateTime), { mode: 'wide', time: 'for today' })
          : '--',
        status: condition.clinicalStatus,
      };
    });
  }, [filteredConditions, t]);

  const { sortedRows, sortRow } = useConditionsSorting(headers, tableRows);

  const launchConditionsForm = useCallback(
    () =>
      launchWorkspace('ambulatory-conditions-filter-form-workspace', {
        formContext: 'creating',
      }),
    [],
  );

  const handleConditionStatusChange = ({ selectedItem }) => setFilter(selectedItem);

  if (isLoading) return <DataTableSkeleton role="progressbar" size={isDesktop ? 'sm' : 'lg'} zebra />;
  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;
  if (conditions?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
          <div className={styles.rightMostFlexContainer}>
            <div className={styles.filterContainer}>
              <Dropdown
                id="conditionStatusFilter"
                initialSelectedItem="Active"
                label=""
                titleText={t('show', 'Show') + ':'}
                type="inline"
                items={['All', 'Active', 'Inactive']}
                onChange={handleConditionStatusChange}
                size={isTablet ? 'lg' : 'sm'}
              />
            </div>
            <div className={styles.divider}>|</div>
            <Button
              kind="ghost"
              renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
              iconDescription={t('addAntecedent', 'Add antecedent')}
              onClick={launchConditionsForm}
            >
              {t('add', 'Add')}
            </Button>
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
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          className={classNames(styles.productiveHeading01, styles.text02)}
                          {...getHeaderProps({
                            header,
                            isSortable: header.isSortable,
                          })}
                        >
                          {renderHeaderLabel(header.header)}
                        </TableHeader>
                      ))}
                      <TableHeader />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                        ))}
                        <TableCell className="cds--table-column-menu">
                          <ConditionsActionMenu patientUuid={patient.id} condition={sortedRows[index]} />
                        </TableCell>
                      </TableRow>
                    ))}
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
  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchConditionsForm} />;
}

export default ConditionsDetailedSummary;
