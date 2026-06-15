import { Button, DataTableSkeleton, Link, OverflowMenu, OverflowMenuItem, Pagination } from '@carbon/react';
import { AddIcon, navigate, showModal, showSnackbar, type Visit } from '@openmrs/esm-framework';
import { EmptyState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEncounterRows, useFormsJson } from '../hooks';
import type { ColumnValue, Encounter, FormattedColumn, FormColumn, Mode, NamedColumn, TableRow } from '../types';
import { deleteEncounter } from '../utils/encounter-list.resource';
import { launchEncounterForm } from '../utils/helpers';

import styles from './encounter-list.scss';
import { EncounterListDataTable } from './table.component';

export interface EncounterListColumn {
  key: string;
  header: string;
  getValue: (encounter: Encounter) => ColumnValue;
  link?: FormattedColumn['link'];
}

export interface EncounterListProps {
  patientUuid: string;
  encounterType: string;
  columns: Array<FormattedColumn>;
  headerTitle: string;
  description: string;
  formList?: Array<{
    name?: string;
    uuid: string;
    excludedIntents?: Array<string>;
    fixedIntent?: string;
    isDefault?: boolean;
  }>;
  launchOptions: {
    hideFormLauncher?: boolean;
    displayText?: string;
    workspaceWindowSize?: 'minimized' | 'maximized';
  };
  filter?: (encounter: Encounter) => boolean;
  afterFormSaveAction?: () => void;
  deathStatus?: boolean;
  currentVisit: Visit;
}

const isNamedColumn = (value: ColumnValue): value is NamedColumn =>
  typeof value === 'object' &&
  value !== null &&
  !React.isValidElement(value) &&
  !Array.isArray(value) &&
  'name' in value;

const isFormColumn = (value: unknown): value is FormColumn =>
  typeof value === 'object' && value !== null && 'label' in value;

const getNamedDisplay = (value: unknown) => {
  if (typeof value === 'object' && value !== null) {
    const namedValue = value as {
      display?: string;
      name?: string | { display?: string; name?: string };
    };
    if (typeof namedValue.display === 'string') {
      return namedValue.display;
    }
    if (typeof namedValue.name === 'string') {
      return namedValue.name;
    }
    if (typeof namedValue.name === 'object' && namedValue.name !== null) {
      return namedValue.name.display ?? namedValue.name.name ?? '--';
    }
  }

  return '--';
};

export const EncounterList: React.FC<EncounterListProps> = ({
  patientUuid,
  encounterType,
  columns,
  headerTitle,
  description,
  formList,
  filter,
  launchOptions,
  afterFormSaveAction,
  currentVisit,
  deathStatus,
}) => {
  const { t } = useTranslation();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { formsJson, isLoading: isLoadingFormsJson } = useFormsJson(formList?.[0]?.uuid);
  const { encounters, total, isLoading, onFormSave, mutate } = useEncounterRows(
    patientUuid,
    encounterType,
    filter,
    afterFormSaveAction,
    pageSize,
    currentPage,
  );

  const { displayText, hideFormLauncher } = launchOptions;

  const renderColumnValue = useCallback((value: ColumnValue): React.ReactNode => {
    if (value == null) {
      return null;
    }

    if (React.isValidElement(value)) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          return isFormColumn(item) ? item.label : getNamedDisplay(item);
        })
        .join(', ');
    }

    return isNamedColumn(value) ? getNamedDisplay(value) : null;
  }, []);

  const defaultActions = useMemo(
    () => [
      {
        label: t('viewEncounter', 'View'),
        form: {
          name: formsJson?.name,
        },
        mode: 'view',
        intent: '*',
      },
      {
        label: t('editEncounter', 'Edit'),
        form: {
          name: formsJson?.name,
        },
        mode: 'edit',
        intent: '*',
      },
      {
        label: t('deleteEncounter', 'Delete'),
        form: {
          name: formsJson?.name,
        },
        mode: 'delete',
        intent: '*',
      },
    ],
    [formsJson, t],
  );

  const createLaunchFormAction = useCallback(
    (encounter: Encounter, mode: Mode) => () => {
      launchEncounterForm(formsJson, currentVisit, mode, onFormSave, encounter.uuid, null, patientUuid);
    },
    [formsJson, onFormSave, patientUuid, currentVisit],
  );

  const handleDeleteEncounter = useCallback(
    (encounterUuid: string, encounterTypeName: string) => {
      const close = showModal('delete-encounter-modal', {
        close: () => close(),
        encounterTypeName: encounterTypeName || '',
        onConfirmation: () => {
          const abortController = new AbortController();
          deleteEncounter(encounterUuid, abortController)
            .then(() => {
              onFormSave();
              mutate();
              showSnackbar({
                isLowContrast: true,
                title: t('encounterDeleted', 'Encounter deleted'),
                subtitle: t('encounterSuccessfullyDeleted', 'The encounter has been deleted successfully'),
                kind: 'success',
              });
            })
            .catch(() => {
              showSnackbar({
                isLowContrast: false,
                title: t('error', 'Error'),
                subtitle: t(
                  'encounterWithError',
                  'The encounter could not be deleted successfully. If the error persists, please contact your system administrator.',
                ),
                kind: 'error',
              });
            })
            .finally(() => {
              close();
            });
        },
      });
    },
    [onFormSave, t, mutate],
  );

  const tableRows = useMemo<Array<TableRow & Record<string, ColumnValue>>>(() => {
    return encounters.map((encounter: Encounter) => {
      const tableRow = { id: encounter.uuid, actions: null } as TableRow & Record<string, ColumnValue>;

      encounter['launchFormActions'] = {
        editEncounter: createLaunchFormAction(encounter, 'edit'),
        viewEncounter: createLaunchFormAction(encounter, 'view'),
      };

      columns.forEach((column) => {
        let val = column?.getValue(encounter);
        if (column.link) {
          val = (
            <Link
              onClick={(e) => {
                e.preventDefault();
                if (column.link.handleNavigate) {
                  column.link.handleNavigate(encounter);
                } else {
                  if (column.link?.getUrl) {
                    navigate({ to: column.link.getUrl(encounter) });
                  }
                }
              }}
            >
              {renderColumnValue(val)}
            </Link>
          );
        }
        tableRow[column.key] = val;
      });

      const actions =
        Array.isArray(tableRow.actions) && tableRow.actions.length > 0 ? tableRow.actions : defaultActions;

      tableRow['actions'] = (
        <OverflowMenu flipped className={styles.flippedOverflowMenu} data-testid="actions-id">
          {actions.map((actionItem, index) => {
            const form = formsJson && actionItem?.form?.name ? formsJson.name === actionItem.form.name : null;

            return (
              form && (
                <OverflowMenuItem
                  key={`${actionItem.label}-${actionItem.mode}-${actionItem.intent ?? index}`}
                  index={index}
                  itemText={t(actionItem.label)}
                  onClick={(e) => {
                    e.preventDefault();
                    if (actionItem.mode === 'delete') {
                      handleDeleteEncounter(encounter.uuid, encounter.encounterType?.name ?? '');
                    } else {
                      launchEncounterForm(
                        formsJson,
                        currentVisit,
                        actionItem.mode === 'enter' ? 'add' : actionItem.mode,
                        onFormSave,
                        encounter.uuid,
                        actionItem.intent,
                        patientUuid,
                      );
                    }
                  }}
                />
              )
            );
          })}
        </OverflowMenu>
      );

      return tableRow;
    });
  }, [
    encounters,
    createLaunchFormAction,
    columns,
    defaultActions,
    formsJson,
    t,
    handleDeleteEncounter,
    onFormSave,
    patientUuid,
    currentVisit,
    renderColumnValue,
  ]);

  const headers = useMemo(() => {
    if (columns) {
      return columns.map((column) => {
        return { key: column.key, header: t(column.header) };
      });
    }
    return [];
  }, [columns, t]);

  const formLauncher = useMemo(() => {
    if (formsJson && !formsJson['availableIntents']?.length) {
      return (
        <Button
          kind="ghost"
          renderIcon={AddIcon}
          iconDescription="Add"
          onClick={(e) => {
            e.preventDefault();
            launchEncounterForm(formsJson, currentVisit, 'add', onFormSave, '', '*', patientUuid);
          }}
        >
          {t(displayText)}
        </Button>
      );
    }
    return null;
  }, [formsJson, displayText, onFormSave, patientUuid, t, currentVisit]);

  if (isLoading === true || isLoadingFormsJson === true) {
    return <DataTableSkeleton rowCount={10} />;
  }

  return (
    <>
      {tableRows?.length > 0 || encounters.length > 0 ? (
        <>
          <div className={styles.widgetContainer}>
            <div className={styles.widgetHeaderContainer}>
              <h4 className={`${styles.productiveHeading03} ${styles.text02}`}>{t(headerTitle)}</h4>
              {!(hideFormLauncher ?? deathStatus) && <div className={styles.toggleButtons}>{formLauncher}</div>}
            </div>
            <EncounterListDataTable tableHeaders={headers} tableRows={tableRows} />
            <Pagination
              page={currentPage}
              pageSizes={[10, 20, 30, 40, 50]}
              onChange={({ page, pageSize }) => {
                setCurrentPage(page);
                setPageSize(pageSize);
              }}
              pageSize={pageSize}
              totalItems={total}
            />
          </div>
        </>
      ) : (
        <EmptyState
          displayText={description}
          headerTitle={t(headerTitle)}
          launchForm={
            hideFormLauncher || deathStatus
              ? null
              : () => launchEncounterForm(formsJson, currentVisit, 'add', onFormSave, '', '*', patientUuid)
          }
        />
      )}
    </>
  );
};
