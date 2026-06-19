import {
  Button,
  DataTable,
  type DataTableHeader,
  type DataTableRow,
  DataTableSkeleton,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineLoading,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Search,
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
  TableToolbarContent,
  Tile,
} from '@carbon/react';
import {
  AddIcon,
  age,
  ExtensionSlot,
  formatDate,
  getCoreTranslation,
  getLocale,
  getPatientName,
  PrinterIcon,
  useConfig,
  useLayoutType,
  usePagination,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  getDrugOrderByUuid,
  launchPatientWorkspace,
  type Order,
  type OrderBasketItem,
  type OrderType,
  PatientChartPagination,
  useLaunchWorkspaceRequiringVisit,
  useOrderBasket,
  useOrderTypes,
  usePatientOrders,
} from '@openmrs/esm-patient-common-lib';
import { capitalize, lowerCase } from 'lodash-es';
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';

import type { ConfigObject } from '../config-schema';
import PrintComponent from '../print/print.component';
import { buildGeneralOrder, buildLabOrder, buildMedicationOrder } from '../utils';

import GeneralOrderTable from './general-order-table.component';
import MedicationRecord from './medication-record.component';
import styles from './order-details-table.scss';
import TestOrder from './test-order.component';

interface OrderDetailsProps {
  patientUuid: string;
  showAddButton?: boolean;
  showPrintButton?: boolean;
  title?: string;
}

interface OrderBasketItemActionsProps {
  canEditOrders: boolean;
  canEditResults: boolean;
  openOrderBasket: () => void;
  openOrderForm: () => void;
  orderItem: Order;
  responsiveSize: 'sm' | 'md' | 'lg';
}

interface OrderHeaderProps {
  key: string;
  header: string;
  isSortable: boolean;
  isVisible?: boolean;
}

type MutableOrderBasketItem = OrderBasketItem;

function getCellContent(value: ReactNode) {
  if (value && typeof value === 'object' && 'content' in value) {
    return value.content as ReactNode;
  }

  return value;
}

const OrderDetailsTable: React.FC<OrderDetailsProps> = ({ patientUuid, showAddButton, showPrintButton, title }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEditOrders = userHasAccess('app:clinical.chart.orders.edit', session?.user);
  const canEditResults = userHasAccess('app:clinical.chart.results.edit', session?.user);
  const locale = getLocale() ?? 'en';
  const defaultPageSize = 10;
  const headerTitle = t('orders', 'Orders');
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'md';
  const launchOrderBasket = useLaunchWorkspaceRequiringVisit('order-basket');
  const launchAddDrugOrder = useLaunchWorkspaceRequiringVisit('add-drug-order');
  const launchModifyLabOrder = useLaunchWorkspaceRequiringVisit('add-lab-order');
  const launchModifyGeneralOrder = useLaunchWorkspaceRequiringVisit('orderable-concept-workspace');
  const contentToPrintRef = useRef<HTMLDivElement>(null);
  const patient = usePatient(patientUuid);
  const { careSettingUuid, priorityConfigs, excludePatientIdentifierCodeTypes } = useConfig<
    ConfigObject & { excludePatientIdentifierCodeTypes?: { uuids: Array<string> } }
  >();
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: orderTypes } = useOrderTypes();
  const [selectedOrderTypeUuid, setSelectedOrderTypeUuid] = useState<string | null>(null);
  const [selectedFromDate, setSelectedFromDate] = useState<string | null>(null);
  const [selectedToDate, setSelectedToDate] = useState<string | null>(null);
  const selectedOrderName = orderTypes?.find((x) => x.uuid === selectedOrderTypeUuid)?.name;
  const {
    data: allOrders,
    error: error,
    isLoading,
    isValidating,
  } = usePatientOrders(patientUuid, 'ACTIVE', selectedOrderTypeUuid, selectedFromDate, selectedToDate, careSettingUuid);

  // launch respective order basket based on order type
  const openOrderForm = useCallback(
    (orderItem: Order) => {
      switch (orderItem.type) {
        case 'drugorder':
          launchAddDrugOrder({ order: buildMedicationOrder(orderItem, 'REVISE') });
          break;
        case 'testorder':
          launchModifyLabOrder({
            order: buildLabOrder(orderItem, 'REVISE'),
            orderTypeUuid: orderItem.orderType.uuid,
          });
          break;
        case 'order':
          launchModifyGeneralOrder({
            order: buildGeneralOrder(orderItem, 'REVISE'),
            orderTypeUuid: orderItem.orderType.uuid,
          });
          break;
        default:
          launchOrderBasket();
      }
    },
    [launchAddDrugOrder, launchModifyGeneralOrder, launchModifyLabOrder, launchOrderBasket],
  );

  const tableHeaders: Array<OrderHeaderProps> = [
    {
      key: 'orderNumber',
      header: t('orderNumber', 'Order number'),
      isSortable: true,
    },
    {
      key: 'dateOfOrder',
      header: t('dateOfOrder', 'Date of order'),
      isSortable: true,
    },
    {
      key: 'orderType',
      header: t('orderType', 'Order type'),
      isSortable: true,
    },
    {
      key: 'order',
      header: t('order', 'Order'),
      isSortable: true,
    },
    {
      key: 'priority',
      header: t('priority', 'Priority'),
      isSortable: true,
    },
    {
      key: 'orderedBy',
      header: t('orderedBy', 'Ordered by'),
      isSortable: false,
    },
    {
      key: 'status',
      header: t('status', 'Status'),
      isSortable: true,
    },
  ];

  if (isPrinting) {
    tableHeaders.push({
      key: 'dosage',
      header: t('dosage', 'Dosage'),
      isSortable: true,
    });
  }

  const tableRows = useMemo(
    () =>
      allOrders?.map((order) => ({
        id: order.uuid,
        dateActivated: order.dateActivated,
        orderNumber: order.orderNumber,
        dateOfOrder: <div className={styles.singleLineText}>{formatDate(new Date(order.dateActivated))}</div>,
        orderType: capitalize(order.orderType?.display ?? '-'),
        dosage:
          order.type === 'drugorder' ? (
            <div className={styles.singleLineText}>{`${t('indication', 'Indication').toUpperCase()}
            ${order.orderReasonNonCoded} ${'-'} ${t('quantity', 'Quantity').toUpperCase()} ${order.quantity} ${
              order?.quantityUnits?.display
            } `}</div>
          ) : (
            '--'
          ),
        order: order.display,
        priority: (
          <div className={styles.priorityPill} data-priority={lowerCase(order.urgency)}>
            {priorityConfigs?.find((p) => p.conceptUuid === order.urgency)?.label ??
              t(order.urgency, capitalize(order.urgency.replace('_', ' ')))}
          </div>
        ),
        orderedBy: order.orderer?.display,
        status: order.fulfillerStatus ? (
          <div className={styles.statusPill} data-status={lowerCase(order.fulfillerStatus.replace('_', ' '))}>
            {
              // t('RECEIVED', 'Received')
              // t('IN_PROGRESS', 'In progress')
              // t('EXCEPTION', 'Exception')
              // t('ON_HOLD', 'On hold')
              // t('DECLINED', 'Declined')
              // t('COMPLETED', 'Completed')
              // t('DISCONTINUED', 'Discontinued')
            }
            {t(order.fulfillerStatus, capitalize(order.fulfillerStatus.replace('_', ' ')))}
          </div>
        ) : (
          '--'
        ),
      })) ?? [],
    [allOrders, t, priorityConfigs],
  );

  const { results: paginatedOrders, goTo, currentPage } = usePagination(tableRows, defaultPageSize);

  const patientDetails = useMemo(() => {
    const getGender = (gender: string): string => {
      switch (gender) {
        case 'male':
          return getCoreTranslation('male');
        case 'female':
          return getCoreTranslation('female');
        case 'other':
          return getCoreTranslation('other');
        case 'unknown':
          return getCoreTranslation('unknown');
        default:
          return gender;
      }
    };

    const identifiers =
      patient?.patient?.identifier?.filter(
        (identifier) => !excludePatientIdentifierCodeTypes?.uuids.includes(identifier.type.coding[0].code),
      ) ?? [];

    return {
      name: patient?.patient ? getPatientName(patient?.patient) : '',
      age: age(patient?.patient?.birthDate),
      gender: getGender(patient?.patient?.gender),
      location: patient?.patient?.address?.[0].city,
      identifiers: identifiers?.length ? identifiers.map(({ value }) => value) : [],
    };
  }, [patient, excludePatientIdentifierCodeTypes?.uuids]);

  const onBeforeGetContentResolve = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isPrinting && onBeforeGetContentResolve.current) {
      onBeforeGetContentResolve.current();
    }
  }, [isPrinting]);

  const handlePrint = useReactToPrint({
    contentRef: contentToPrintRef,
    documentTitle: `OpenMRS - ${patientDetails.name} - ${title}`,
    onBeforePrint: () =>
      new Promise<void>((resolve) => {
        if (patient && title) {
          onBeforeGetContentResolve.current = resolve;
          setIsPrinting(true);
        }
      }),
    onAfterPrint: () => {
      onBeforeGetContentResolve.current = null;
      setIsPrinting(false);
    },
  });

  const orderTypesToDisplay = useMemo(
    () => [
      {
        display: t('allOrders', 'All orders'),
        uuid: null,
      },
      ...(orderTypes?.map((orderType) => ({
        display: orderType.display,
        uuid: orderType.uuid,
      })) ?? []),
    ],
    [orderTypes, t],
  );

  const handleDateFilterChange = ([startDate, endDate]: Array<Date | undefined>) => {
    if (startDate) {
      const isoStartDate = startDate.toISOString();
      setSelectedFromDate(isoStartDate);
      if (selectedToDate && new Date(selectedToDate) < startDate) {
        setSelectedToDate(isoStartDate);
      }
    }
    if (endDate) {
      const isoEndDate = endDate.toISOString();
      setSelectedToDate(isoEndDate);
      if (selectedFromDate && new Date(selectedFromDate) > endDate) {
        setSelectedFromDate(isoEndDate);
      }
    }
  };

  const isOmrsOrder = useCallback(
    (orderItem: Order) => ['order', 'testorder', 'drugorder'].includes(orderItem.type),
    [],
  );

  return (
    <>
      <div className={styles.filterContainer}>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id="orderTypeDropdown"
            items={orderTypesToDisplay}
            itemToString={(orderType: OrderType | null) => (orderType ? capitalize(orderType.display) : '')}
            label={t('allOrders', 'All orders')}
            onChange={({ selectedItem }: { selectedItem: OrderType | null }) => {
              if (!selectedItem || selectedItem.display === 'All') {
                setSelectedOrderTypeUuid(null);
                return;
              }
              setSelectedOrderTypeUuid(selectedItem.uuid);
            }}
            selectedItem={orderTypesToDisplay.find((x) => x.uuid === selectedOrderTypeUuid) ?? orderTypesToDisplay[0]}
            titleText={t('selectOrderType', 'Select order type') + ':'}
            type="inline"
          />
        </div>
        <span className={styles.rangeLabel}>{t('dateRange', 'Date range')}:</span>
        <DatePicker
          datePickerType="range"
          dateFormat={'d/m/Y'}
          locale={locale}
          value={''}
          onChange={(dates) => {
            handleDateFilterChange(dates);
          }}
        >
          <DatePickerInput
            id="startDatePickerInput"
            data-testid="startDatePickerInput"
            labelText=""
            placeholder="dd/mm/yyyy"
          />
          <DatePickerInput
            id="endDatePickerInput"
            data-testid="endDatePickerInput"
            labelText=""
            placeholder="dd/mm/yyyy"
          />
        </DatePicker>
      </div>

      {(() => {
        if (isLoading) {
          return <DataTableSkeleton role="progressbar" zebra />;
        }

        if (error) {
          return <ErrorState error={error} headerTitle={title} />;
        }

        if (orderTypes && orderTypes?.length > 0) {
          return (
            <>
              {!tableRows?.length ? (
                <EmptyState
                  headerTitle={headerTitle}
                  displayText={
                    selectedOrderTypeUuid === null
                      ? t('orders', 'Orders')
                      : // t('Drug Order_few', 'Drug Orders')
                        // t('Test Order_few', 'Test Orders')
                        t(selectedOrderName?.toLowerCase() ?? 'orders', {
                          count: 3,
                          default: selectedOrderName,
                        })
                  }
                  launchForm={canEditOrders ? launchOrderBasket : undefined}
                />
              ) : (
                <div className={styles.widgetCard}>
                  <CardHeader title={title}>
                    {isValidating ? (
                      <span>
                        <InlineLoading />
                      </span>
                    ) : null}
                    <div className={styles.buttons}>
                      {showPrintButton && (
                        <Button
                          className={styles.printButton}
                          iconDescription={t('printOrder', 'Print order')}
                          kind="ghost"
                          onClick={handlePrint}
                          renderIcon={PrinterIcon}
                        >
                          {t('print', 'Print')}
                        </Button>
                      )}
                      {showAddButton && canEditOrders && (
                        <Button
                          className={styles.addButton}
                          kind="ghost"
                          renderIcon={AddIcon}
                          iconDescription={t('launchOrderBasket', 'Launch order basket')}
                          onClick={launchOrderBasket}
                        >
                          {t('add', 'Add')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <div ref={contentToPrintRef}>
                    <PrintComponent subheader={title} patientDetails={patientDetails} />
                    <DataTable
                      aria-label={t('orderDetails', 'Order details')}
                      data-floating-menu-container
                      headers={tableHeaders}
                      isSortable
                      overflowMenuOnHover={!isTablet}
                      rows={paginatedOrders}
                      size={responsiveSize}
                      useZebraStyles
                    >
                      {({
                        getExpandedRowProps,
                        getExpandHeaderProps,
                        getHeaderProps,
                        getRowProps,
                        getTableContainerProps,
                        getTableProps,
                        headers,
                        onInputChange,
                        rows,
                      }) => (
                        <>
                          <TableContainer {...getTableContainerProps()}>
                            {!isPrinting && (
                              <div className={styles.toolBarContent}>
                                <TableToolbarContent>
                                  <Layer>
                                    <Search
                                      isExpanded
                                      labelText=""
                                      onChange={onInputChange}
                                      placeholder={t('searchTable', 'Search table')}
                                      size="lg"
                                    />
                                  </Layer>
                                </TableToolbarContent>
                              </div>
                            )}
                            <Table className={styles.table} {...getTableProps()}>
                              <TableHead>
                                <TableRow>
                                  <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                                  {headers.map((header: DataTableHeader) => {
                                    const { key, ...headerProps } = getHeaderProps({ header });

                                    return (
                                      <TableHeader key={key} {...headerProps}>
                                        {header.header}
                                      </TableHeader>
                                    );
                                  })}
                                  <TableExpandHeader />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rows.map((row: DataTableRow<string[]>) => {
                                  const matchingOrder = allOrders?.find((order) => order.uuid === row.id);

                                  const { key, ...rowProps } = getRowProps({ row });
                                  const { key: _expandedRowKey, ...expandedRowProps } = getExpandedRowProps({ row });

                                  return (
                                    <React.Fragment key={row.id}>
                                      <TableExpandRow key={key} className={styles.row} {...rowProps}>
                                        {row.cells.map((cell) => (
                                          <TableCell className={styles.tableCell} key={cell.id}>
                                            {getCellContent(cell.value)}
                                          </TableCell>
                                        ))}
                                        {!isPrinting && (
                                          <TableCell className="cds--table-column-menu">
                                            {matchingOrder && isOmrsOrder(matchingOrder) ? (
                                              <OrderBasketItemActions
                                                canEditOrders={canEditOrders}
                                                canEditResults={canEditResults}
                                                openOrderBasket={launchOrderBasket}
                                                openOrderForm={() => openOrderForm(matchingOrder)}
                                                orderItem={matchingOrder}
                                                responsiveSize={responsiveSize}
                                              />
                                            ) : matchingOrder ? (
                                              <ExtensionSlot
                                                name={`${matchingOrder.type}-action-menu-items-slot`}
                                                state={{
                                                  className: styles.menuItem,
                                                  orderItem: matchingOrder,
                                                  responsiveSize,
                                                }}
                                              />
                                            ) : null}
                                          </TableCell>
                                        )}
                                      </TableExpandRow>
                                      {row.isExpanded ? (
                                        <TableExpandedRow
                                          key={`${row.id}-expanded`}
                                          colSpan={headers.length + 2}
                                          {...expandedRowProps}
                                        >
                                          <>
                                            {matchingOrder?.type === 'drugorder' ? (
                                              <MedicationRecord medication={matchingOrder} />
                                            ) : matchingOrder?.type === 'testorder' ? (
                                              <TestOrder testOrder={matchingOrder} />
                                            ) : matchingOrder?.type === 'order' ? (
                                              <GeneralOrderTable order={matchingOrder} />
                                            ) : matchingOrder ? (
                                              <ExtensionSlot
                                                name={`${matchingOrder.type}-detail-slot`}
                                                state={{
                                                  orderItem: matchingOrder,
                                                }}
                                              />
                                            ) : null}
                                          </>
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
                          {rows.length === 0 ? (
                            <div className={styles.tileContainer}>
                              <Tile className={styles.emptyStateTile}>
                                <div className={styles.tileContent}>
                                  <p className={styles.content}>
                                    {t('noMatchingOrdersToDisplay', 'No matching orders to display')}
                                  </p>
                                  <p className={styles.helperText}>{t('checkFilters', 'Check the filters above')}</p>
                                </div>
                              </Tile>
                            </div>
                          ) : null}
                        </>
                      )}
                    </DataTable>
                    {!isPrinting && (
                      <div className={styles.paginationContainer}>
                        <PatientChartPagination
                          pageNumber={currentPage}
                          totalItems={tableRows.length}
                          currentItems={paginatedOrders.length}
                          pageSize={defaultPageSize}
                          onPageNumberChange={({ page }) => goTo(page)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        }
      })()}
    </>
  );
};

function OrderBasketItemActions({
  canEditOrders,
  canEditResults,
  orderItem,
  openOrderBasket,
  openOrderForm,
  responsiveSize,
}: OrderBasketItemActionsProps) {
  const { t } = useTranslation();
  const { orders, setOrders } = useOrderBasket<MutableOrderBasketItem>(orderItem.orderType.uuid);
  const alreadyInBasket = orders.some((x) => x.uuid === orderItem.uuid);
  const handleModifyClick = useCallback(() => {
    if (orderItem.type === 'drugorder') {
      void getDrugOrderByUuid(orderItem.uuid)
        .then((res) => {
          const medicationOrder = res.data;
          const medicationItem = buildMedicationOrder(medicationOrder, 'REVISE');
          setOrders([...orders, medicationItem]);
          openOrderForm();
        })
        .catch((e) => {
          console.error('Error modifying drug order: ', e);
        });
    } else if (orderItem.type === 'testorder') {
      const labItem = buildLabOrder(orderItem, 'REVISE');
      setOrders([...orders, labItem]);
      openOrderForm();
    } else if (orderItem.type === 'order') {
      const order = buildGeneralOrder(orderItem, 'REVISE');
      setOrders([...orders, order]);
      openOrderForm();
    }
  }, [orderItem, openOrderForm, orders, setOrders]);

  const handleAddResultsClick = useCallback(() => {
    launchPatientWorkspace('test-results-form-workspace', { order: orderItem });
  }, [orderItem]);

  const handleCancelClick = useCallback(() => {
    if (orderItem.type === 'drugorder') {
      void getDrugOrderByUuid(orderItem.uuid)
        .then((res) => {
          const medicationOrder = res.data;
          setOrders([...orders, buildMedicationOrder(medicationOrder, 'DISCONTINUE')]);
          openOrderBasket();
        })
        .catch((error) => {
          console.error('Error discontinuing drug order: ', error);
        });
    } else if (orderItem.type === 'testorder') {
      const labItem = buildLabOrder(orderItem, 'DISCONTINUE');
      setOrders([...orders, labItem]);
      openOrderBasket();
    } else {
      const order = buildGeneralOrder(orderItem, 'DISCONTINUE');
      setOrders([...orders, order]);
      openOrderBasket();
    }
  }, [orderItem, setOrders, orders, openOrderBasket]);

  if (!canEditOrders && !(orderItem?.type === 'testorder' && canEditResults)) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        align="left"
        aria-label={t('actionsMenu', 'Actions menu')}
        flipped
        selectorPrimaryFocus={'#modify'}
        size={responsiveSize === 'md' ? 'sm' : responsiveSize}
      >
        {canEditOrders && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket}
            id="modify"
            itemText={t('modifyOrder', 'Modify order')}
            onClick={handleModifyClick}
          />
        )}
        {orderItem?.type === 'testorder' && canEditResults && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket}
            id="reorder"
            itemText={
              orderItem.fulfillerStatus === 'COMPLETED'
                ? t('editResults', 'Edit results')
                : t('addResults', 'Add results')
            }
            onClick={handleAddResultsClick}
          />
        )}
        {canEditOrders && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket || orderItem?.action === 'DISCONTINUE'}
            hasDivider
            id="discontinue"
            isDelete
            itemText={t('cancelOrder', 'Cancel order')}
            onClick={handleCancelClick}
          />
        )}
      </OverflowMenu>
    </Layer>
  );
}

export default OrderDetailsTable;
