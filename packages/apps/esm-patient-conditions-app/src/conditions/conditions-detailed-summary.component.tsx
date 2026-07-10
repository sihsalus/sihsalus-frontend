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
import { AddIcon, formatDate, parseDate, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  getAntecedentTypeLabel,
  launchPatientWorkspace,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConditionTableHeader, useConditions, useConditionsSorting } from './conditions.resource';
import { ConditionsActionMenu } from './conditions-action-menu.component';
import {
  type ConditionSection,
  defaultAntecedentTypeBySection,
  defaultClinicalStatusBySection,
  filterConditionsBySection,
  workspaceNamesBySection,
} from './conditions-categories';
import styles from './conditions-detailed-summary.scss';

interface ConditionsDetailedSummaryProps {
  patient: fhir.Patient;
  section?: ConditionSection;
}

const getSectionCopy = (section: ConditionSection, t: TFunction) => {
  switch (section) {
    case 'active-problems':
      return {
        addIconDescription: t('addActiveProblem', 'Add active problem'),
        ariaLabel: t('activeProblemsSummary', 'Active problems summary'),
        displayText: t('activeProblems_lower', 'active problems'),
        emptyText: t('noActiveProblemsToDisplay', 'No active problems to display'),
        headerTitle: t('activeProblems', 'Active problems'),
        recordText: t('recordActiveProblem', 'Record active problem'),
      };
    case 'past-diagnoses':
      return {
        addIconDescription: t('addPastDiagnosis', 'Add past diagnosis'),
        ariaLabel: t('pastDiagnosesSummary', 'Past diagnoses summary'),
        displayText: t('pastDiagnoses_lower', 'past diagnoses'),
        emptyText: t('noPastDiagnosesToDisplay', 'No past diagnoses to display'),
        headerTitle: t('pastDiagnoses', 'Past diagnoses'),
        recordText: t('recordPastDiagnosis', 'Record past diagnosis'),
      };
    case 'other-antecedents':
    case 'antecedents':
    default:
      return {
        addIconDescription: t('addAntecedent', 'Add antecedent'),
        ariaLabel: t('antecedentsSummary', 'Antecedents summary'),
        displayText: t('antecedents_lower', 'antecedents'),
        emptyText: t('noAntecedentsToDisplay', 'No antecedents to display'),
        headerTitle: t('antecedents', 'Antecedents'),
        recordText: t('recordAntecedent', 'Record antecedent'),
      };
  }
};

function ConditionsDetailedTable({ patient, section = 'antecedents' }: ConditionsDetailedSummaryProps) {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess('app:hoja.clinica.condiciones.editar', session?.user);
  const sectionCopy = getSectionCopy(section, t);
  const displayText = sectionCopy.displayText;
  const headerTitle = sectionCopy.headerTitle;
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isDesktop = layout === 'small-desktop' || layout === 'large-desktop';

  const { conditions, error, isLoading, isValidating } = useConditions(patient.id);

  const sectionConditions = useMemo(() => filterConditionsBySection(conditions ?? [], section), [conditions, section]);

  const filteredConditions = useMemo(() => {
    if (filter === 'All') {
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
            {canEdit ? (
              <Button
                kind="ghost"
                renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
                iconDescription={sectionCopy.addIconDescription}
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
                <Table {...getTableProps()} aria-label={sectionCopy.ariaLabel} className={styles.table}>
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
                      <p className={styles.content}>{sectionCopy.emptyText}</p>
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
    <EmptyState
      displayText={displayText}
      headerTitle={headerTitle}
      launchForm={canEdit ? launchConditionsForm : undefined}
    />
  );
}

function ConditionsDetailedSummary({ patient }: ConditionsDetailedSummaryProps) {
  return (
    <>
      <ConditionsDetailedTable patient={patient} section="active-problems" />
      <ConditionsDetailedTable patient={patient} section="past-diagnoses" />
      <ConditionsDetailedTable patient={patient} section="other-antecedents" />
    </>
  );
}

export default ConditionsDetailedSummary;
