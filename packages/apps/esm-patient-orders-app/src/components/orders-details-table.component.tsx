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
  openmrsFetch,
  restBaseUrl,
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
import useSWR, { useSWRConfig } from 'swr';

import type { ConfigObject } from '../config-schema';
import PrintComponent from '../print/print.component';
import { buildGeneralOrder, buildLabOrder, buildMedicationOrder } from '../utils';

import GeneralOrderTable from './general-order-table.component';
import MedicationRecord from './medication-record.component';
import styles from './order-details-table.scss';
import TestOrder from './test-order.component';

const getPriorityColor = (urgency: string | undefined): string => {
  if (!urgency) return 'gray';
  const normUrgency = urgency.toUpperCase();
  switch (normUrgency) {
    case 'E724BDB6-2C75-4B6F-A00C-D43F2C372974': // Emergencia
      return 'red';
    case 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA': // Urgente
    case 'STAT':
      return 'orange';
    case '427A595A-A5EE-4BA7-BCB7-2503248EFB31': // Urgencia menor
      return 'yellow';
    case 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85': // Rutina / No urgente
    case 'ROUTINE':
      return 'green';
    case '65CF194E-05A7-4832-BA6D-9B7C9940A7C2': // Programado
    case 'ON_SCHEDULED_DATE':
      return 'blue';
    default:
      return 'gray';
  }
};

const resultsViewerConcepts = [
  '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e', // Hemograma completo
  '7e750f3a-8d5c-45b1-8e94-ebf850208e35', // Examen completo de orina
  'df144cc2-6718-4005-9881-f39eafd73315', // Examen de heces (panel)
  '339febfd-699e-4a26-927f-1f9a7780bb5e', // Panel de Química del Suero
  '241eb982-1fdd-4183-a2b5-763f5ce2d528',
  '1bcb541a-55e8-4c5d-83fb-d121a9d54d9d',
  '654b11a8-a326-45c9-885e-2fae6143404a',
  '968c8a41-ab1b-426c-86ee-761b88c26e40',
  'ef0a9d25-658b-466b-9b7e-4571673b28b0',
  '7969c932-60db-4a38-8723-2f3a5bba8c16',
  'bb3af485-89b6-4c04-848c-8d024a6b4a7a',
];

interface LabsetMember {
  uuid: string;
  display: string;
  setMembers?: Array<LabsetMember>;
}

interface LabsetResponse {
  uuid: string;
  display: string;
  setMembers: Array<LabsetMember>;
}

const getMemberUuids = (labset: LabsetResponse | LabsetMember): Array<string> => {
  const uuids: Array<string> = [];
  const recurse = (member: LabsetResponse | LabsetMember) => {
    if (member.uuid) {
      uuids.push(member.uuid);
    }
    if (member.setMembers) {
      member.setMembers.forEach(recurse);
    }
  };
  if (labset.setMembers) {
    labset.setMembers.forEach(recurse);
  }
  return uuids;
};

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
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedLabsetUuid, setSelectedLabsetUuid] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const statusFilterOptions = useMemo(() => {
    return [
      { value: null, label: t('all', 'All') },
      { value: 'PENDING', label: t('PENDING', 'Pending') },
      { value: 'COMPLETED', label: t('COMPLETED', 'Completado') },
      { value: 'DECLINED', label: t('DECLINED', 'Rechazado') },
      { value: 'IN_PROGRESS', label: t('IN_PROGRESS', 'En progreso') },
    ];
  }, [t]);

  const fetchLabsets = useCallback((urls: Array<string>) => {
    return Promise.all(urls.map((url) => openmrsFetch<LabsetResponse>(url).then((res) => res.data)));
  }, []);

  const conceptUrls = useMemo(() => {
    return (
      resultsViewerConcepts?.map(
        (c) =>
          `${restBaseUrl}/concept/${c}?v=custom:(uuid,display,setMembers:(uuid,display,setMembers:(uuid,display,setMembers:(uuid,display))))`,
      ) || []
    );
  }, []);

  const { data: fetchedLabsets } = useSWR<Array<LabsetResponse>, Error>(
    conceptUrls.length ? conceptUrls : null,
    fetchLabsets,
  );

  const labsetOptions = useMemo(() => {
    const options = [{ value: null, display: t('all', 'All') }];
    if (fetchedLabsets) {
      fetchedLabsets.forEach((set) => {
        options.push({ value: set.uuid, display: set.display });
      });
    }
    return options;
  }, [fetchedLabsets, t]);

  const priorityFilterOptions = useMemo(() => {
    return [
      { uuid: null, label: t('all', 'All') },
      ...(priorityConfigs?.map((p) => ({
        uuid: p.conceptUuid,
        label: p.label,
      })) ?? []),
    ];
  }, [priorityConfigs, t]);

  const selectedOrderName = orderTypes?.find((x) => x.uuid === selectedOrderTypeUuid)?.name;
  const {
    data: allOrders,
    error: error,
    isLoading,
    isValidating,
  } = usePatientOrders(patientUuid, 'any', selectedOrderTypeUuid, selectedFromDate, selectedToDate, careSettingUuid);

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

  const filteredOrders = useMemo(() => {
    let result = allOrders ?? [];

    // Filtrado por fecha (cliente-side) para evitar desfases de zona horaria
    if (selectedFromDate) {
      const fromTime = new Date(selectedFromDate).getTime();
      result = result.filter((order) => new Date(order.dateActivated).getTime() >= fromTime);
    }
    if (selectedToDate) {
      const toTime = new Date(selectedToDate).getTime();
      result = result.filter((order) => new Date(order.dateActivated).getTime() <= toTime);
    }

    // Filtrado por prioridad
    if (priorityFilter) {
      const filterNorm = priorityFilter.toUpperCase();
      result = result.filter((order) => {
        const priorityMatch = order.instructions?.match(/\|\|priorityUuid:([a-fA-F0-9-]+)\|\|/);
        const normUrgency = (priorityMatch ? priorityMatch[1] : order.urgency)?.toUpperCase();
        return (
          normUrgency === filterNorm ||
          (filterNorm === 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA' && normUrgency === 'STAT') ||
          (filterNorm === 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85' && normUrgency === 'ROUTINE') ||
          (filterNorm === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' && normUrgency === 'ON_SCHEDULED_DATE')
        );
      });
    }

    // Filtrado por grupo de pruebas
    if (selectedLabsetUuid && fetchedLabsets) {
      const currentLabset = fetchedLabsets.find((set) => set.uuid === selectedLabsetUuid);
      const memberUuids = currentLabset ? getMemberUuids(currentLabset) : [];

      result = result.filter(
        (order) => order.concept?.uuid === selectedLabsetUuid || memberUuids.includes(order.concept?.uuid),
      );
    }

    // Filtrado por estado
    if (statusFilter) {
      result = result.filter((order) => {
        const orderStatus = order.fulfillerStatus ? order.fulfillerStatus.toUpperCase() : 'PENDING';
        return orderStatus === statusFilter;
      });
    }

    return result;
  }, [allOrders, priorityFilter, selectedLabsetUuid, fetchedLabsets, selectedFromDate, selectedToDate, statusFilter]);

  const tableRows = useMemo(
    () =>
      filteredOrders.map((order) => {
        const priorityMatch = order.instructions?.match(/\|\|priorityUuid:([a-fA-F0-9-]+)\|\|/);
        const parsedUrgency = priorityMatch ? priorityMatch[1] : order.urgency;
        const selectedPriority = priorityConfigs?.find((p) => p.conceptUuid === parsedUrgency);
        const priorityLabel = selectedPriority?.label ?? t(order.urgency, capitalize(order.urgency.replace('_', ' ')));

        return {
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
            <div className={styles.priorityPill} data-urgency-color={getPriorityColor(parsedUrgency)}>
              {priorityLabel}
              {(parsedUrgency?.toUpperCase() === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' ||
                parsedUrgency?.toUpperCase() === 'ON_SCHEDULED_DATE') &&
                order.scheduledDate &&
                ` (${formatDate(new Date(order.scheduledDate))})`}
            </div>
          ),
          orderedBy: order.orderer?.display,
          status: (
            <div
              className={styles.statusPill}
              data-status={order.fulfillerStatus ? lowerCase(order.fulfillerStatus.replace('_', ' ')) : 'pending'}
            >
              {order.fulfillerStatus ? (
                t(order.fulfillerStatus.toUpperCase(), capitalize(order.fulfillerStatus.replace('_', ' ')))
              ) : (
                t('PENDING', 'Pending')
              )}
            </div>
          ),
        };
      }) ?? [],
    [filteredOrders, t, priorityConfigs],
  );

  const { results: paginatedOrders, goTo, currentPage } = usePagination(tableRows, defaultPageSize);

  useEffect(() => {
    goTo(1);
  }, [
    selectedOrderTypeUuid,
    selectedFromDate,
    selectedToDate,
    priorityFilter,
    selectedLabsetUuid,
    statusFilter,
  ]);

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

  const handleDateFilterChange = (dates: Array<Date | undefined>) => {
    const startDate = dates[0];
    const endDate = dates[1];

    if (startDate) {
      const localStart = new Date(startDate);
      localStart.setHours(0, 0, 0, 0);
      setSelectedFromDate(localStart.toISOString());
    } else {
      setSelectedFromDate(null);
    }

    if (endDate) {
      const localEnd = new Date(endDate);
      localEnd.setHours(23, 59, 59, 999);
      setSelectedToDate(localEnd.toISOString());
    } else {
      setSelectedToDate(null);
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
        <div className={styles.dropdownContainer}>
          <Dropdown
            id="priorityDropdown"
            items={priorityFilterOptions}
            itemToString={(option: { uuid: string | null; label: string }) => option?.label}
            label={t('all', 'All')}
            onChange={({ selectedItem }) => {
              setPriorityFilter(selectedItem?.uuid || null);
            }}
            selectedItem={priorityFilterOptions.find((x) => x.uuid === priorityFilter) ?? priorityFilterOptions[0]}
            titleText={t('filterOrdersByPriority', 'Filtrar órdenes por prioridad:')}
            type="inline"
          />
        </div>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id="labsetDropdown"
            items={labsetOptions}
            itemToString={(option: { value: string | null; display: string }) => option?.display}
            label={t('all', 'All')}
            onChange={({ selectedItem }) => {
              setSelectedLabsetUuid(selectedItem?.value || null);
            }}
            selectedItem={labsetOptions.find((x) => x.value === selectedLabsetUuid) ?? labsetOptions[0]}
            titleText={t('filterByTestGroup', 'Filtrar por grupo de pruebas:')}
            type="inline"
          />
        </div>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id="statusDropdown"
            items={statusFilterOptions}
            itemToString={(option: { value: string | null; label: string }) => option?.label}
            label={t('all', 'All')}
            onChange={({ selectedItem }) => {
              setStatusFilter(selectedItem?.value || null);
            }}
            selectedItem={statusFilterOptions.find((x) => x.value === statusFilter) ?? statusFilterOptions[0]}
            titleText={t('filterOrdersByStatus', 'Filtrar órdenes por estado:')}
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
  const { mutate } = useSWRConfig();
  const launchCancelOrder = useLaunchWorkspaceRequiringVisit('patient-orders-form-workspace');
  const { orders, setOrders } = useOrderBasket<MutableOrderBasketItem>(orderItem.orderType.uuid);

  const mutateOrders = useCallback(() => {
    const patientUuid = orderItem.patient?.uuid;
    if (patientUuid) {
      mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?patient=${patientUuid}`));
    }
  }, [mutate, orderItem.patient?.uuid]);

  const handleModifyClick = useCallback(() => {
    void openmrsFetch(`${restBaseUrl}/order/${orderItem.uuid}/fulfillerdetails/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        fulfillerStatus: 'DECLINED',
        fulfillerComment: 'Modificado por el médico',
      },
    }).then(() => mutateOrders());

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
  }, [orderItem, openOrderForm, orders, setOrders, mutateOrders]);

  const handleAddResultsClick = useCallback(() => {
    launchPatientWorkspace('test-results-form-workspace', { order: orderItem });
  }, [orderItem]);

  const handleCancelClick = useCallback(() => {
    launchCancelOrder({ order: orderItem });
  }, [orderItem, launchCancelOrder]);

  const isPending = !orderItem.fulfillerStatus || orderItem.fulfillerStatus.toUpperCase() === 'PENDING';
  if (!isPending) {
    return null;
  }

  const alreadyInBasket = orders.some((x) => x.uuid === orderItem.uuid);

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
