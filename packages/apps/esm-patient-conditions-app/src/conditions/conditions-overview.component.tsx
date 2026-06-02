import {
  Button,
  DataTable,
  type DataTableHeader,
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
import {
  AddIcon,
  formatDate,
  isDesktop as isDesktopLayout,
  parseDate,
  useConfig,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  launchPatientWorkspace,
  PatientChartPagination,
} from '@openmrs/esm-patient-common-lib';
import { getAntecedentTypeLabel } from '@sihsalus/esm-sihsalus-shared';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../config-schema';
import { type Condition, useConditions, useConditionsSorting } from './conditions.resource';
import { ConditionsActionMenu } from './conditions-action-menu.component';
import {
  type ConditionSection,
  defaultAntecedentTypeBySection,
  defaultClinicalStatusBySection,
  filterConditionsBySection,
  workspaceNamesBySection,
} from './conditions-categories';
import styles from './conditions-overview.scss';

interface ConditionTableRow extends Condition {
  id: string;
  condition: string;
  abatementDateTime: string;
  antecedentTypeRender: string;
  onsetDateTimeRender: string;
  status: string;
}

interface ConditionTableHeader {
  key: 'display' | 'antecedentTypeRender' | 'onsetDateTimeRender' | 'status';
  header: string;
  isSortable: true;
  sortFunc: (valueA: ConditionTableRow, valueB: ConditionTableRow) => number;
}

interface ConditionsOverviewProps {
  patientUuid: string;
  section?: ConditionSection;
}

const getSectionCopy = (section: ConditionSection, t: TFunction) => {
  switch (section) {
    case 'active-problems':
      return {
        addIconDescription: t('addActiveProblem', 'Add active problem'),
        ariaLabel: t('activeProblemsOverview', 'Active problems overview'),
        displayText: t('activeProblems_lower', 'active problems'),
        emptyText: t('noActiveProblemsToDisplay', 'No active problems to display'),
        headerTitle: t('activeProblems', 'Active problems'),
        pagePath: 'Antecedentes',
        recordText: t('recordActiveProblem', 'Record active problem'),
      };
    case 'past-diagnoses':
      return {
        addIconDescription: t('addPastDiagnosis', 'Add past diagnosis'),
        ariaLabel: t('pastDiagnosesOverview', 'Past diagnoses overview'),
        displayText: t('pastDiagnoses_lower', 'past diagnoses'),
        emptyText: t('noPastDiagnosesToDisplay', 'No past diagnoses to display'),
        headerTitle: t('pastDiagnoses', 'Past diagnoses'),
        pagePath: 'Antecedentes',
        recordText: t('recordPastDiagnosis', 'Record past diagnosis'),
      };
    case 'procedures':
      return {
        addIconDescription: t('addProcedureSurgery', 'Add procedure or surgery'),
        ariaLabel: t('proceduresAndSurgeriesOverview', 'Procedures and surgeries overview'),
        displayText: t('proceduresAndSurgeries_lower', 'procedures and surgeries'),
        emptyText: t('noProceduresAndSurgeriesToDisplay', 'No procedures or surgeries to display'),
        headerTitle: t('proceduresAndSurgeries', 'Procedures and surgeries'),
        pagePath: 'Procedimientos-y-cirugias',
        recordText: t('recordProcedureSurgery', 'Record procedure or surgery'),
      };
    case 'antecedents':
    default:
      return {
        addIconDescription: t('addAntecedent', 'Add antecedent'),
        ariaLabel: t('antecedentsAndProblemsOverview', 'Antecedents and problems overview'),
        displayText: t('antecedentsAndProblems_lower', 'antecedents and problems'),
        emptyText: t('noAntecedentsToDisplay', 'No antecedents to display'),
        headerTitle: t('antecedentsAndProblems', 'Antecedents and problems'),
        pagePath: 'Antecedentes',
        recordText: t('recordAntecedent', 'Record antecedent'),
      };
  }
};

const ConditionsOverview: React.FC<ConditionsOverviewProps> = ({ patientUuid, section = 'antecedents' }) => {
  const { conditionPageSize } = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const sectionCopy = getSectionCopy(section, t);
  const displayText = sectionCopy.displayText;
  const headerTitle = sectionCopy.headerTitle;
  const urlLabel = t('seeAll', 'See all');
  const pageUrl = `${globalThis.spaBase}/patient/${patientUuid}/chart/${sectionCopy.pagePath}`;
  const layout = useLayoutType();
  const isDesktop = isDesktopLayout(layout);
  const isTablet = !isDesktop;

  const { conditions, error, isLoading, isValidating } = useConditions(patientUuid);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const launchConditionsForm = useCallback(() => {
    const defaultAntecedentType = defaultAntecedentTypeBySection[section];
    const defaultClinicalStatus = defaultClinicalStatusBySection[section];

    launchPatientWorkspace(workspaceNamesBySection[section], {
      ...(defaultAntecedentType ? { defaultAntecedentType, lockedAntecedentType: true } : {}),
      ...(defaultClinicalStatus ? { defaultClinicalStatus } : {}),
      formContext: 'creating',
      workspaceTitle: sectionCopy.recordText,
    });
  }, [section, sectionCopy.recordText]);

  const sectionConditions = useMemo(() => filterConditionsBySection(conditions ?? [], section), [conditions, section]);

  const filteredConditions = useMemo(() => {
    if (!filter || filter === 'All') {
      return sectionConditions;
    }

    return sectionConditions.filter((condition) => condition.clinicalStatus === filter);
  }, [filter, sectionConditions]);

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
        sortFunc: (valueA, valueB) => valueA.status?.localeCompare(valueB.status),
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

  const { results: paginatedConditions, goTo, currentPage } = usePagination(sortedRows, conditionPageSize);

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
                id="conditionStatusFilter"
                initialSelectedItem={{ id: 'Active', label: t('active', 'Active') }}
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
          aria-label={sectionCopy.ariaLabel}
          headers={headers}
          isSortable
          overflowMenuOnHover={isDesktop}
          rows={paginatedConditions}
          size={isTablet ? 'lg' : 'sm'}
          sortRow={sortRow}
          useZebraStyles
        >
          {({ rows, headers, getHeaderProps, getTableProps }) => (
            <>
              <TableContainer className={styles.tableContainer}>
                <Table {...getTableProps()} className={styles.table}>
                  <TableHead>
                    <TableRow>
                      {(headers as Array<DataTableHeader & ConditionTableHeader>).map((header) => {
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
                            {header.header}
                          </TableHeader>
                        );
                      })}
                      <TableHeader aria-label={t('actions', 'Actions')} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const matchingCondition = conditions.find((condition) => condition.id === row.id);
                      return (
                        <TableRow key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {(cell.value?.content ?? cell.info.header === 'status')
                                ? t(cell.value.toLowerCase(), cell.value)
                                : cell.value}
                            </TableCell>
                          ))}
                          <TableCell className="cds--table-column-menu">
                            <ConditionsActionMenu condition={matchingCondition} patientUuid={patientUuid} />
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
                      <p className={styles.content}>{sectionCopy.emptyText}</p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </div>
              ) : null}
            </>
          )}
        </DataTable>
        <PatientChartPagination
          currentItems={paginatedConditions.length}
          onPageNumberChange={({ page }) => goTo(page)}
          pageNumber={currentPage}
          pageSize={conditionPageSize}
          totalItems={filteredConditions.length}
          dashboardLinkUrl={pageUrl}
          dashboardLinkLabel={urlLabel}
        />
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchConditionsForm} />;
};

export default ConditionsOverview;
