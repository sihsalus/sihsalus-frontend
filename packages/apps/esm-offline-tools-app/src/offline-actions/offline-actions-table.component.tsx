import {
  Button,
  DataTable,
  type DataTableRenderProps,
  DataTableSkeleton,
  Layer,
  Link,
  Pagination,
  Search,
  SearchSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
} from '@carbon/react';
import {
  beginEditSynchronizationItem,
  canBeginEditSynchronizationItemsOfType,
  createErrorHandler,
  isDesktop,
  navigate,
  type SyncItem,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import React, { type ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './offline-actions-table.styles.scss';

export interface SyncItemWithPatient {
  item: SyncItem;
  patient?: fhir.Patient;
}

type OfflineActionsTableHeaders = 'createdOn' | 'patient' | 'action' | 'error';

export interface OfflineActionsTableProps {
  data?: Array<SyncItemWithPatient>;
  isLoading: boolean;
  hiddenHeaders?: Array<OfflineActionsTableHeaders>;
  disableEditing: boolean;
  disableDelete: boolean;
  onDelete(syncItemIds: Array<number>): void;
}

const OfflineActionsTable: React.FC<OfflineActionsTableProps> = ({
  isLoading,
  data = [],
  hiddenHeaders,
  disableEditing,
  disableDelete,
  onDelete,
}) => {
  const { t } = useTranslation();

  const defaultHeaders: Array<{
    key: OfflineActionsTableHeaders;
    header: string;
  }> = [
    {
      key: 'createdOn',
      header: t('offlineActionsTableCreatedOn', 'Date & Time'),
    },
    {
      key: 'patient',
      header: t('offlineActionsTablePatient', 'Patient'),
    },
    {
      key: 'action',
      header: t('offlineActionsTableAction', 'Action'),
    },
    {
      key: 'error',
      header: t('offlineActionsTableError', 'Error'),
    },
  ];
  const headers = defaultHeaders.filter((header) => !hiddenHeaders?.includes(header.key));

  const rows: OfflineActionRow[] = data.map((syncItem) => {
    const patientName = getPatientName(syncItem);
    const date = syncItem.item.createdOn;
    const validDate = date instanceof Date && Number.isFinite(date.getTime());

    return {
      id: syncItem.item.id.toString(),
      createdOn: {
        value: validDate ? date.toLocaleString() : '-',
        filterableValue: validDate ? date.toLocaleString() : '-',
        sortValue: validDate ? date.getTime() : Number.MIN_SAFE_INTEGER,
      },
      patient: {
        value: <PatientLink patientUuid={syncItem.item.descriptor?.patientUuid} patientName={patientName} />,
        filterableValue: patientName ?? '',
      },
      action: {
        value: <ActionNameLink syncItem={syncItem.item} disabled={disableEditing} />,
        filterableValue: syncItem.item.descriptor?.displayName ?? '-',
      },
      error: syncItem.item.lastError ? t('offlineActionsSynchronizationIncomplete', 'Synchronization incomplete') : '-',
    };
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <DataTable<OfflineActionRow, OfflineActionCell[]>
      rows={rows}
      headers={headers}
      filterRows={filterTableRows}
      isSortable
      sortRow={(left, right, { sortDirection }) => {
        const leftText = typeof left === 'object' && left !== null ? (left.sortValue ?? left.filterableValue) : left;
        const rightText =
          typeof right === 'object' && right !== null ? (right.sortValue ?? right.filterableValue) : right;
        const comparison =
          typeof leftText === 'number' && typeof rightText === 'number'
            ? leftText - rightText
            : String(leftText ?? '').localeCompare(String(rightText ?? ''), undefined, { numeric: true });
        return sortDirection === 'DESC' ? -comparison : comparison;
      }}
    >
      {(tableProps) => (
        <PaginatedActionsTable
          {...tableProps}
          disableEditing={disableEditing}
          disableDelete={disableDelete}
          onDelete={onDelete}
        />
      )}
    </DataTable>
  );
};

type OfflineActionCell = string | { value: React.ReactNode; filterableValue: string; sortValue?: number };
interface OfflineActionRow {
  id: string;
  createdOn: OfflineActionCell;
  patient: OfflineActionCell;
  action: OfflineActionCell;
  error: string;
}

type PaginatedActionsTableProps = DataTableRenderProps<OfflineActionRow, OfflineActionCell[]> &
  Pick<OfflineActionsTableProps, 'disableEditing' | 'disableDelete' | 'onDelete'>;

const PaginatedActionsTable: React.FC<PaginatedActionsTableProps> = ({
  rows,
  headers,
  getTableProps,
  getHeaderProps,
  getRowProps,
  getTableContainerProps,
  getSelectionProps,
  onInputChange,
  selectedRows,
  disableEditing,
  disableDelete,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const { results: visibleRows, currentPage, totalPages, goTo } = usePagination(rows, pageSize);
  const layout = useLayoutType();
  const toolbarItemSize = isDesktop(layout) ? 'sm' : undefined;
  useEffect(() => {
    if (currentPage > totalPages) goTo(totalPages);
  }, [currentPage, totalPages, goTo]);

  return (
    <TableContainer className={styles.tableContainer} {...getTableContainerProps()}>
      <div className={styles.tableHeaderContainer}>
        {selectedRows.length === 0 && (
          <Layer>
            <Search
              className={styles.tableSearch}
              labelText={t('offlinePatientsTableSearchLabel', 'Search this list')}
              placeholder={t('offlinePatientsTableSearchPlaceholder', 'Search this list')}
              size={toolbarItemSize}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onInputChange(e as ChangeEvent<HTMLInputElement>);
                goTo(1);
              }}
            />
          </Layer>
        )}
        {selectedRows.length > 0 && (
          <Button
            className={styles.tablePrimaryAction}
            kind="danger"
            size={toolbarItemSize}
            disabled={disableEditing || disableDelete}
            onClick={() => onDelete(selectedRows.map((row) => +row.id))}
          >
            {t('offlineActionsTableDeleteActions', 'Delete {{count}} actions', { count: selectedRows.length })}
          </Button>
        )}
      </div>
      <Table {...getTableProps()} useZebraStyles>
        <TableHead>
          <TableRow>
            <TableSelectAll {...getSelectionProps()} disabled={disableEditing} />
            {headers.map((header) => {
              const { key, ...props } = getHeaderProps({ header, onClick: () => goTo(1) });
              return (
                <TableHeader key={key} {...props} isSortable>
                  {header.header}
                </TableHeader>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.map((row) => {
            const { key, ...rowProps } = getRowProps({ row });
            return (
              <TableRow key={key} {...rowProps}>
                <TableSelectRow {...getSelectionProps({ row })} disabled={disableEditing} />
                {row.cells.map((cell) => (
                  <TableCell key={cell.id}>{renderCellValue(cell.value)}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination
        pageSizes={[10, 20, 30, 40, 50]}
        page={currentPage}
        pageSize={pageSize}
        totalItems={rows.length}
        onChange={({ page, pageSize: nextPageSize }) => {
          if (nextPageSize !== pageSize) {
            setPageSize(nextPageSize);
            goTo(1);
          } else goTo(page);
        }}
      />
    </TableContainer>
  );
};

const TableSkeleton: React.FC = () => {
  return (
    <TableContainer className={styles.tableContainer}>
      <div className={styles.tableHeaderContainer}>
        <SearchSkeleton className={styles.tableSearch} />
      </div>
      <DataTableSkeleton showToolbar={false} showHeader={false} />
    </TableContainer>
  );
};

function renderCellValue(value: OfflineActionCell): React.ReactNode {
  return typeof value === 'string' ? value : value?.value;
}

function getPatientName({ item, patient }: SyncItemWithPatient) {
  const hasPatient = item.descriptor?.patientUuid;
  if (!hasPatient) {
    return undefined;
  }

  const patientName = patient?.name?.[0];
  return patientName
    ? (patientName.text ?? [patientName.family, ...(patientName.given ?? [])].filter(Boolean).join(' '))
    : item.descriptor.patientUuid;
}

function ActionNameLink({ syncItem, disabled }: { syncItem: SyncItem; disabled: boolean }) {
  const displayName = syncItem.descriptor?.displayName ?? '-';

  if (disabled || !canBeginEditSynchronizationItemsOfType(syncItem.type)) {
    return <>{displayName}</>;
  }

  return (
    <Link onClick={() => beginEditSynchronizationItem(syncItem.id).catch((e) => createErrorHandler()(e))}>
      {displayName}
    </Link>
  );
}

function PatientLink({ patientUuid, patientName }) {
  return patientUuid ? (
    <Link
      onClick={() =>
        navigate({
          to: `${globalThis.getOpenmrsSpaBase()}patient/${patientUuid}/chart`,
        })
      }
    >
      {patientName}
    </Link>
  ) : (
    <>-</>
  );
}

function filterTableRows({ rowIds, headers, cellsById, inputValue, getCellId }) {
  return rowIds.filter((rowId) =>
    headers.some(({ key }) => {
      const cellId = getCellId(rowId, key);
      const value = cellsById[cellId].value;
      const filterableValue = value?.filterableValue?.toString() ?? value?.toString() ?? '';
      return filterableValue.toLowerCase().includes(inputValue.toLowerCase());
    }),
  );
}

export default OfflineActionsTable;
