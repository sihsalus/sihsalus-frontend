import {
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
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
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { ExtensionSlot, formatDate, parseDate, showModal, useConfig, usePagination } from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../config-schema';
import { useLabOrders } from '../../laboratory.resource';
import { type FlattenedOrder, type FulfillerStatus, type Order } from '../../types';
import { getFulfillerStatusDisplay } from '../../utils/order-display';
import { extractPriorityFromInstructions } from '../../utils/priority-parser';
import ListOrderDetails from './list-order-details.component';
import styles from './orders-data-table.scss';
import { OrdersDateRangePicker } from './orders-date-range-picker.component';

const labTableColumnSpec = {
  name: {
    // t('patient', 'Patient')
    headerLabelKey: 'patient',
    headerLabelDefault: 'Patient',
    key: 'patientName',
  },
  age: {
    // t('age', 'Age')
    headerLabelKey: 'age',
    headerLabelDefault: 'Age',
    key: 'patientAge',
  },
  dob: {
    // t('dateOfBirth', 'Date of Birth')
    headerLabelKey: 'dob',
    headerLabelDefault: 'Date of Birth',
    key: 'patientDob',
  },
  sex: {
    // t('sex', 'Sex')
    headerLabelKey: 'sex',
    headerLabelDefault: 'Sex',
    key: 'patientSex',
  },
  totalOrders: {
    // t('totalOrders', 'Total Orders')
    headerLabelKey: 'totalOrders',
    headerLabelDefault: 'Total Orders',
    key: 'totalOrders',
  },
  action: {
    // t('action', 'Action')
    headerLabelKey: 'action',
    headerLabelDefault: 'Action',
    key: 'action',
  },
  patientId: {
    // t('patientId', 'Patient ID')
    headerLabelKey: 'patientId',
    headerLabelDefault: 'Patient ID',
    key: 'patientId',
  },
};

export interface OrdersDataTableProps {
  /* Whether the data table should include a status filter dropdown */
  useFilter?: boolean;
  excludeColumns?: Array<string>;
  fulfillerStatus?: FulfillerStatus;
  newOrdersOnly?: boolean;
  excludeCanceledAndDiscontinuedOrders?: boolean;
}

const getPriorityRank = (urgency: string | undefined): number => {
  if (!urgency) return 6;
  const norm = urgency.toUpperCase();
  switch (norm) {
    case 'E724BDB6-2C75-4B6F-A00C-D43F2C372974': // Emergencia
      return 1;
    case 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA': // Urgente
    case 'STAT':
      return 2;
    case '427A595A-A5EE-4BA7-BCB7-2503248EFB31': // Urgencia menor
      return 3;
    case 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85': // Rutina / No urgente
    case 'ROUTINE':
      return 4;
    case '65CF194E-05A7-4832-BA6D-9B7C9940A7C2': // Programado
    case 'ON_SCHEDULED_DATE':
      return 5;
    default:
      return 6;
  }
};

const OrdersDataTable: React.FC<OrdersDataTableProps> = (props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FulfillerStatus>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [searchString, setSearchString] = useState('');
  const { labTableColumns, patientIdIdentifierTypeUuid } = useConfig<Config>();

  const { labOrders, isLoading } = useLabOrders({
    status: props.useFilter ? filter : props.fulfillerStatus,
    newOrdersOnly: props.newOrdersOnly,
    excludeCanceled: props.excludeCanceledAndDiscontinuedOrders,
    includePatientId: labTableColumns.includes('patientId'),
  });

  const parsedLabOrders = useMemo(() => {
    return (
      labOrders?.map((order) => {
        const { urgency, cleanInstructions } = extractPriorityFromInstructions(
          order.instructions,
          order.urgency,
        );
        return {
          ...order,
          urgency,
          instructions: cleanInstructions,
        };
      }) ?? []
    );
  }, [labOrders]);

  const flattenedLabOrders: Array<FlattenedOrder> = useMemo(() => {
    return (
      parsedLabOrders.map((order) => {
        return {
          id: order.uuid,
          patientUuid: order.patient.uuid,
          orderNumber: order.orderNumber,
          dateActivated: formatDate(parseDate(order.dateActivated)),
          fulfillerStatus: order.fulfillerStatus,
          urgency: order.urgency,
          orderer: order.orderer?.display,
          instructions: order.instructions,
          fulfillerComment: order.fulfillerComment,
          display: order.display,
        };
      })
    );
  }, [parsedLabOrders]);

  const groupedOrdersByPatient = useMemo(() => {
    if (parsedLabOrders && parsedLabOrders.length > 0) {
      const patientUuids = [...new Set(parsedLabOrders.map((order) => order.patient.uuid))];

      return patientUuids
        .map((patientUuid) => {
          let labOrdersForPatient = parsedLabOrders.filter((order) => order.patient.uuid === patientUuid);
          let flattenedLabOrdersForPatient = flattenedLabOrders.filter((order) => order.patientUuid === patientUuid);

          // Apply priority filter to individual orders if set
          if (priorityFilter) {
            const filterNorm = priorityFilter.toUpperCase();
            labOrdersForPatient = labOrdersForPatient.filter(
              (order) => {
                const normUrgency = order.urgency?.toUpperCase();
                return (
                  normUrgency === filterNorm ||
                  (filterNorm === 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA' && normUrgency === 'STAT') ||
                  (filterNorm === 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85' && normUrgency === 'ROUTINE') ||
                  (filterNorm === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' && normUrgency === 'ON_SCHEDULED_DATE')
                );
              }
            );
            flattenedLabOrdersForPatient = flattenedLabOrdersForPatient.filter(
              (order) => {
                const normUrgency = order.urgency?.toUpperCase();
                return (
                  normUrgency === filterNorm ||
                  (filterNorm === 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA' && normUrgency === 'STAT') ||
                  (filterNorm === 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85' && normUrgency === 'ROUTINE') ||
                  (filterNorm === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' && normUrgency === 'ON_SCHEDULED_DATE')
                );
              }
            );
          }

          // Sort individual orders by priority (highest priority first)
          flattenedLabOrdersForPatient.sort((a, b) => getPriorityRank(a.urgency) - getPriorityRank(b.urgency));
          labOrdersForPatient.sort((a, b) => getPriorityRank(a.urgency) - getPriorityRank(b.urgency));

          const patient = labOrdersForPatient[0]?.patient;
          return {
            patientId: patient?.identifiers?.find(
              (identifier) =>
                identifier.preferred &&
                !identifier.voided &&
                identifier.identifierType.uuid === patientIdIdentifierTypeUuid,
            )?.identifier,
            patientUuid: patientUuid,
            patientName: patient?.person?.display,
            patientAge: patient?.person?.age,
            patientDob: patient?.person?.birthdate ? formatDate(parseDate(patient.person.birthdate)) : undefined,
            patientSex: patient?.person?.gender,
            totalOrders: flattenedLabOrdersForPatient.length,
            orders: flattenedLabOrdersForPatient,
            originalOrders: labOrdersForPatient,
          };
        })
        .filter((group) => group.orders.length > 0)
        // Sort patient groups by the highest priority order they have (lowest rank number first)
        .sort((a, b) => {
          const rankA = Math.min(...a.orders.map((o) => getPriorityRank(o.urgency)));
          const rankB = Math.min(...b.orders.map((o) => getPriorityRank(o.urgency)));
          return rankA - rankB;
        });
    } else {
      return [];
    }
  }, [flattenedLabOrders, parsedLabOrders, patientIdIdentifierTypeUuid, priorityFilter]);

  const searchResults = useMemo(() => {
    if (searchString && searchString.trim() !== '') {
      // Normalize the search string to lowercase
      const lowerSearchString = searchString.toLowerCase();
      return groupedOrdersByPatient.filter(
        (orderGroup) =>
          (labTableColumns.includes('name') && orderGroup.patientName?.toLowerCase().includes(lowerSearchString)) ||
          (labTableColumns.includes('patientId') && orderGroup.patientId?.toLowerCase().includes(lowerSearchString)) ||
          orderGroup.orders.some((order) => order.orderNumber?.toLowerCase().includes(lowerSearchString)),
      );
    }

    return groupedOrdersByPatient;
  }, [searchString, groupedOrdersByPatient, labTableColumns]);

  const orderStatuses = [
    { value: null, display: t('all', 'All') },
    { value: 'RECEIVED', display: getFulfillerStatusDisplay('RECEIVED', t) },
    { value: 'IN_PROGRESS', display: getFulfillerStatusDisplay('IN_PROGRESS', t) },
    { value: 'COMPLETED', display: getFulfillerStatusDisplay('COMPLETED', t) },
    { value: 'EXCEPTION', display: getFulfillerStatusDisplay('EXCEPTION', t) },
    { value: 'ON_HOLD', display: getFulfillerStatusDisplay('ON_HOLD', t) },
    { value: 'DECLINED', display: getFulfillerStatusDisplay('DECLINED', t) },
  ];

  const priorityOptions = [
    { value: null, display: t('all', 'All') },
    { value: 'e724bdb6-2c75-4b6f-a00c-d43f2c372974', display: t('emergency', 'Emergencia') },
    { value: 'b96959db-2106-4ce7-b39b-6fcb2ca88cda', display: t('urgent', 'Urgente') },
    { value: '427a595a-a5ee-4ba7-bcb7-2503248efb31', display: t('minorUrgency', 'Urgencia menor') },
    { value: 'bf3a08c6-cbe6-4f00-8e06-5f5437790b85', display: t('routine', 'Rutina') },
    { value: '65cf194e-05a7-4832-ba6d-9b7c9940a7c2', display: t('scheduled', 'Programado') },
  ];

  const columns = useMemo(() => {
    return labTableColumns
      .map((column) => {
        const spec = labTableColumnSpec[column];
        if (!spec) {
          throw new Error(`Lab table has been configured with an invalid column: ${column}`);
        }
        if (spec.key === 'action') {
          const showActionColumn = flattenedLabOrders.some((order) => order.fulfillerStatus === 'COMPLETED');
          if (!showActionColumn) {
            return null;
          }
        }
        return { header: t(spec.headerLabelKey, spec.headerLabelDefault), key: spec.key };
      })
      .filter(Boolean)
      .map((column) => ({ ...column, id: column.key }));
  }, [t, flattenedLabOrders, labTableColumns]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { goTo, results: paginatedLabOrders, currentPage } = usePagination(searchResults, currentPageSize);

  const handleOrderStatusChange = ({ selectedItem }: { selectedItem: { value: FulfillerStatus; display: string } }) =>
    setFilter(selectedItem.value);

  const handlePrintModal = useCallback((orders: Array<Order>) => {
    const completedOrders = orders.filter((order) => order.fulfillerStatus === 'COMPLETED');
    const dispose = showModal('print-lab-results-modal', {
      closeModal: () => dispose(),
      orders: completedOrders,
    });
  }, []);

  const handleLaunchModal = useCallback((orders: Array<Order>) => {
    const completedOrders = orders.filter((order) => order.fulfillerStatus === 'COMPLETED');
    const dispose = showModal('edit-lab-results-modal', {
      orders: completedOrders,
      closeModal: () => dispose(),
      patient: completedOrders[0]?.patient,
      workspaceName: 'lab-app-test-results-form-workspace',
    });
  }, []);

  const tableRows = useMemo(() => {
    return paginatedLabOrders.map((groupedOrder) => ({
      ...groupedOrder,
      id: groupedOrder.patientUuid,
      action: groupedOrder.orders.some((o) => o.fulfillerStatus === 'COMPLETED') ? (
        <div className={styles.actionCell}>
          <OverflowMenu aria-label="Actions" flipped iconDescription="Actions">
            <ExtensionSlot
              className={styles.transitionOverflowMenuItemSlot}
              name="transition-overflow-menu-item-slot"
              state={{ patientUuid: groupedOrder.patientUuid }}
              // Without tabIndex={0} here, the overflow menu incorrectly sets initial focus to the second item instead of the first.
              tabIndex={0}
            />
            <OverflowMenuItem
              className={styles.menuitem}
              itemText={t('editResults', 'Edit results')}
              onClick={() => handleLaunchModal(groupedOrder.originalOrders)}
            />
            <OverflowMenuItem
              className={styles.menuitem}
              itemText={t('printTestResults', 'Print test results')}
              onClick={() => handlePrintModal(groupedOrder.originalOrders)}
            />
          </OverflowMenu>
        </div>
      ) : null,
    }));
  }, [handleLaunchModal, handlePrintModal, paginatedLabOrders, t]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  return (
    <DataTable rows={tableRows} headers={columns} useZebraStyles>
      {({ getExpandHeaderProps, getHeaderProps, getRowProps, getTableProps, headers, rows }) => (
        <TableContainer className={styles.tableContainer}>
          <TableToolbar>
            <TableToolbarContent className={styles.tableToolBar}>
              <Layer className={styles.toolbarItem}>
                {props.useFilter && (
                  <Dropdown
                    id="orderStatusFilter"
                    initialSelectedItem={
                      filter ? orderStatuses.find((status) => status.value === filter) : orderStatuses[0]
                    }
                    items={orderStatuses}
                    itemToString={(item) => item?.display}
                    label=""
                    onChange={handleOrderStatusChange}
                    titleText={t('filterOrdersByStatus', 'Filter orders by status') + ':'}
                    type="inline"
                  />
                )}
                <Dropdown
                  id="orderPriorityFilter"
                  initialSelectedItem={
                    priorityFilter ? priorityOptions.find((p) => p.value === priorityFilter) : priorityOptions[0]
                  }
                  items={priorityOptions}
                  itemToString={(item) => item?.display}
                  label=""
                  onChange={({ selectedItem }) => setPriorityFilter(selectedItem?.value)}
                  titleText={t('filterOrdersByPriority', 'Filter orders by priority') + ':'}
                  type="inline"
                />
                <OrdersDateRangePicker />
              </Layer>
              <Layer className={styles.toolbarItem}>
                <TableToolbarSearch
                  expanded
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value)}
                  placeholder={t('searchThisList', 'Search this list')}
                  size="sm"
                />
              </Layer>
            </TableToolbarContent>
          </TableToolbar>
          <Table className={styles.tableWrapper} {...getTableProps()}>
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
              {rows.map((row) => (
                <React.Fragment key={row.id}>
                  {(() => {
                    const { key, ...rowProps } = getRowProps({ row });
                    return (
                      <TableExpandRow key={key} {...rowProps}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                        ))}
                      </TableExpandRow>
                    );
                  })()}
                  {row.isExpanded ? (
                    <TableExpandedRow colSpan={headers.length + 2}>
                      <ListOrderDetails
                        groupedOrders={groupedOrdersByPatient.find((item) => item.patientUuid === row.id)}
                      />
                    </TableExpandedRow>
                  ) : (
                    <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 ? (
            <div className={styles.tileContainer}>
              <Tile className={styles.tile}>
                <div className={styles.tileContent}>
                  <p className={styles.content}>{t('noLabRequestsFound', 'No lab requests found')}</p>
                  <p className={styles.emptyStateHelperText}>
                    {t('checkFilters', 'Please check the filters above and try again')}
                  </p>
                </div>
              </Tile>
            </div>
          ) : null}
          {rows.length > 0 && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={currentPageSize}
              pageSizes={pageSizes}
              totalItems={searchResults?.length}
              className={styles.pagination}
              onChange={({ pageSize, page }) => {
                if (pageSize !== currentPageSize) setPageSize(pageSize);
                if (page !== currentPage) goTo(page);
              }}
            />
          )}
        </TableContainer>
      )}
    </DataTable>
  );
};

export default OrdersDataTable;
