import { DataTableSkeleton, Layer, Link, OverflowMenu, OverflowMenuItem, Pagination } from '@carbon/react';
import { ErrorState, isDesktop, navigate, useLayoutType, usePagination } from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../empty-state';
import styles from './encounter-list.scss';
import { OTable } from './o-table.component';
import type { Observation, OpenmrsEncounter } from './types';
import { useEncounterRows } from './use-encounter-rows';

function navigateToColumnLink(column: EncounterListColumn, encounter: OpenmrsEncounter): void {
  if (column.link.handleNavigate) {
    column.link.handleNavigate(encounter);
  } else if (column.link?.getUrl) {
    navigate({ to: column.link.getUrl() });
  }
}

function renderCellValue(column: EncounterListColumn, encounter: OpenmrsEncounter): React.ReactNode {
  const val = column.getValue(encounter);
  if (Array.isArray(val)) {
    return null;
  }
  if (!column.link) return val;
  return (
    <Link
      onClick={(e) => {
        e.preventDefault();
        navigateToColumnLink(column, encounter);
      }}
    >
      {val}
    </Link>
  );
}

function renderActions(actions: Array<{ label: string }>): React.ReactNode {
  const handleMenuItemClick = (e: React.MouseEvent): void => {
    e.preventDefault();
  };
  return (
    <OverflowMenu flipped className={styles.flippedOverflowMenu}>
      {actions.map((actionItem, index) => (
        <OverflowMenuItem key={index} itemText={actionItem.label} onClick={handleMenuItemClick} />
      ))}
    </OverflowMenu>
  );
}

export interface O3FormSchema {
  name: string;
  pages: Array<Record<string, unknown>>;
  processor: string;
  uuid: string;
  referencedForms: [];
  encounterType: string;
  encounter?: string | OpenmrsEncounter;
  allowUnspecifiedAll?: boolean;
  defaultPage?: string;
  readonly?: string | boolean;
  inlineRendering?: 'single-line' | 'multiline' | 'automatic';
  markdown?: Record<string, unknown>;
  postSubmissionActions?: Array<{ actionId: string; config?: Record<string, unknown> }>;
  formOptions?: {
    usePreviousValueDisabled: boolean;
  };
  version?: string;
}
export interface EncounterListColumn {
  key: string;
  header: string;
  getValue: (encounter: OpenmrsEncounter) => React.ReactNode | Array<EncounterListAction>;
  link?: {
    handleNavigate?: (encounter: OpenmrsEncounter) => void;
    getUrl?: () => string;
  };
}

interface EncounterListAction {
  label: string;
  [key: string]: unknown;
}

export interface EncounterListProps {
  patientUuid: string;
  encounterType: string;
  columns: Array<EncounterListColumn>;
  headerTitle: string;
  description: string;
  formList?: Array<{
    name: string;
    excludedIntents?: Array<string>;
    fixedIntent?: string;
    isDefault?: boolean;
  }>;
  launchOptions: {
    moduleName: string;
    hideFormLauncher?: boolean;
    displayText?: string;
    workspaceWindowSize?: 'minimized' | 'maximized';
  };
  filter?: (encounter: OpenmrsEncounter) => boolean;
  formConceptMap: Record<string, Record<string, unknown>>;
  isExpandable?: boolean;
}

export const EncounterList: React.FC<EncounterListProps> = ({
  patientUuid,
  encounterType,
  columns,
  headerTitle,
  description: _description,
  formList,
  filter,
  launchOptions,
  formConceptMap,
  isExpandable,
}) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const layout = useLayoutType();
  const pageSizes = [10, 20, 30, 40, 50];
  const defaultFormName = useMemo(() => formList?.[0]?.name, [formList]);
  const { encounters, isLoading, error } = useEncounterRows(patientUuid, encounterType, filter);
  const { hideFormLauncher } = launchOptions;

  const defaultActions = useMemo(
    () => [
      {
        label: t('viewEncounter', 'View'),
        form: {
          name: defaultFormName,
        },
        mode: 'view',
        intent: '*',
      },
      {
        label: t('editEncounter', 'Edit'),
        form: {
          name: defaultFormName,
        },
        mode: 'view',
        intent: '*',
      },
    ],
    [defaultFormName, t],
  );

  const headers = useMemo(() => {
    if (columns) {
      return columns.map((column) => {
        return { key: column.key, header: column.header };
      });
    }
    return [];
  }, [columns]);

  const { goTo, results, currentPage } = usePagination(encounters, pageSize);

  const constructTableRows = useCallback(
    (
      results: OpenmrsEncounter[],
    ): Array<{
      id: string;
      actions: React.ReactNode;
      obs: Array<Observation>;
      [key: string]: React.ReactNode | Array<Observation>;
    }> => {
      const rows = results?.map((encounter) => {
        const tableRow: {
          id: string;
          actions: React.ReactNode;
          obs: Array<Observation>;
          [key: string]: React.ReactNode | Array<Observation>;
        } = {
          id: encounter.uuid,
          actions: null,
          obs: encounter.obs,
        };
        // inject launch actions
        encounter['launchFormActions'] = {
          editEncounter: (): void => {
            console.error('editEncounter:', error);
          },
          viewEncounter: (): void => {
            console.error('viewEncounter:', error);
          },
        };
        columns.forEach((column) => {
          if (column.key === 'actions') {
            return;
          }
          tableRow[column.key] = renderCellValue(column, encounter);
        });
        tableRow['actions'] = renderActions(defaultActions);
        return tableRow;
      });
      return rows;
    },
    [columns, defaultActions, error],
  );

  // Call the function to obtain the rows
  const rows = constructTableRows(results);

  if (isLoading) {
    return <DataTableSkeleton rowCount={5} />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Layer>
          <ErrorState error={error} headerTitle={t('encountersList', 'Encounters list')} />
        </Layer>
      </div>
    );
  }

  if (rows?.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <EmptyState displayText={t('antecedentes', `${headerTitle} antecedentes`)} headerTitle={headerTitle} />
      </div>
    );
  }

  return (
    <>
      {rows?.length > 0 && (
        <div className={styles.widgetContainer}>
          <div className={styles.widgetHeaderContainer}>
            {!hideFormLauncher && <div className={styles.toggleButtons}>{}</div>}
          </div>
          <OTable tableHeaders={headers} tableRows={rows} formConceptMap={formConceptMap} isExpandable={isExpandable} />
          <Pagination
            forwardText="Next page"
            backwardText="Previous page"
            page={currentPage}
            pageSize={pageSize}
            pageSizes={pageSizes}
            totalItems={rows?.length}
            className={styles.pagination}
            size={isDesktop(layout) ? 'sm' : 'lg'}
            onChange={({ pageSize: newPageSize, page: newPage }) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);
              }
              if (newPage !== currentPage) {
                goTo(newPage);
              }
            }}
          />
        </div>
      )}
    </>
  );
};
