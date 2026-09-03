import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Search,
  Tag,
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
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { fetchVisitInsurance, getSisFinancingState, type SisFinancingState } from '@openmrs/esm-patient-common-lib';
import {
  age,
  ExtensionSlot,
  formatDate,
  type OrderUrgency,
  openmrsFetch,
  parseDate,
  restBaseUrl,
  showModal,
  useConfig,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { type Config } from '../../config-schema';
import { laboratoryEditPrivilege } from '../../constants';
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
  sisCoverage: {
    // t('sisCoverage', 'SIS coverage')
    headerLabelKey: 'sisCoverage',
    headerLabelDefault: 'SIS coverage',
    key: 'sisCoverage',
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

type SisCoverageDisplayState = 'active' | 'inactive' | 'none' | 'review' | 'loading';
type VisitCoverageLookup = Record<string, SisFinancingState | 'error'>;

const getSisCoverageDisplayState = (
  visitUuids: Array<string>,
  visitCoverage: VisitCoverageLookup | undefined,
  isLoading: boolean,
): SisCoverageDisplayState => {
  if (!visitUuids.length) {
    return 'review';
  }

  const states = visitUuids.map((visitUuid) => visitCoverage?.[visitUuid]);
  if (isLoading && states.some((state) => !state)) {
    return 'loading';
  }
  if (states.some((state) => !state || state === 'error')) {
    return 'review';
  }

  const uniqueStates = new Set(states);
  if (uniqueStates.size !== 1) {
    return 'review';
  }

  switch (states[0]) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'notApplicable':
      return 'none';
    default:
      return 'review';
  }
};

export interface OrdersDataTableProps {
  /* Whether the data table should include a status filter dropdown */
  useFilter?: boolean;
  excludeColumns?: Array<string>;
  fulfillerStatus?: FulfillerStatus;
  newOrdersOnly?: boolean;
  excludeCanceledAndDiscontinuedOrders?: boolean;
  showCompletedReportDownload?: boolean;
}

const escapeCsvCell = (value: unknown): string => {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
};

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

interface PrioritizedOrderLike {
  urgency?: string;
  scheduledDate?: string;
}

const OrdersDataTable: React.FC<OrdersDataTableProps> = (props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FulfillerStatus>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedLabsetUuid, setSelectedLabsetUuid] = useState<string | null>(null);
  const [instructionsFilter, setInstructionsFilter] = useState<string | null>(null);
  const [searchString, setSearchString] = useState('');

  const instructionsFilterOptions = useMemo(() => {
    return [
      { value: null, display: t('all', 'All') },
      { value: 'HOSPITALIZED', display: t('hospitalizedPatient', 'Paciente hospitalizado') },
      { value: 'REGIONAL', display: t('onlyRegionalHospital', 'Solo para ser enviado a hospital regional') },
      { value: 'OTHER', display: t('otherInstructions', 'Otro') },
    ];
  }, [t]);
  const session = useSession();
  const canEdit = userHasAccess(laboratoryEditPrivilege, session?.user);
  const { labTableColumns, patientIdIdentifierTypeUuid, resultsViewerConcepts } = useConfig<Config>();

  const fetchLabsets = useCallback((urls: Array<string>) => {
    return Promise.all(urls.map((url) => openmrsFetch<LabsetResponse>(url).then((res) => res.data)));
  }, []);

  const conceptUrls = useMemo(() => {
    return (
      resultsViewerConcepts?.map(
        (c) =>
          `${restBaseUrl}/concept/${c.conceptUuid}?v=custom:(uuid,display,setMembers:(uuid,display,setMembers:(uuid,display,setMembers:(uuid,display))))`,
      ) || []
    );
  }, [resultsViewerConcepts]);

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

  const { labOrders, isLoading } = useLabOrders({
    status: props.useFilter ? filter : props.fulfillerStatus,
    newOrdersOnly: props.newOrdersOnly,
    excludeCanceled: props.excludeCanceledAndDiscontinuedOrders,
    includePatientId: labTableColumns.includes('patientId'),
  });

  const parsedLabOrders = useMemo(() => {
    return (
      labOrders?.map((order) => {
        const { urgency, cleanInstructions } = extractPriorityFromInstructions(order.instructions, order.urgency);
        return {
          ...order,
          urgency,
          instructions: cleanInstructions,
        };
      }) ?? []
    );
  }, [labOrders]);

  const flattenedLabOrders: Array<FlattenedOrder> = useMemo(() => {
    return parsedLabOrders.map((order) => {
      return {
        id: order.uuid,
        patientUuid: order.patient.uuid,
        orderNumber: order.orderNumber,
        dateActivated: formatDate(parseDate(order.dateActivated)),
        fulfillerStatus: order.fulfillerStatus,
        urgency: order.urgency as OrderUrgency,
        orderer: order.orderer?.display,
        instructions: order.instructions,
        fulfillerComment: order.fulfillerComment,
        display: order.display,
        conceptUuid: order.concept?.uuid,
        scheduledDate: order.scheduledDate,
      };
    });
  }, [parsedLabOrders]);

  const isRelatedLabset = useCallback(
    (orderConceptUuid: string | undefined) => {
      if (!orderConceptUuid || !selectedLabsetUuid) return true;
      if (orderConceptUuid === selectedLabsetUuid) return true;

      const targetSet = fetchedLabsets?.find((s) => s.uuid === selectedLabsetUuid);
      const targetMembers = targetSet ? getMemberUuids(targetSet) : [];
      if (targetMembers.includes(orderConceptUuid)) return true;

      const orderSet = fetchedLabsets?.find((s) => s.uuid === orderConceptUuid);
      if (orderSet) {
        const orderMembers = getMemberUuids(orderSet);
        if (orderMembers.includes(selectedLabsetUuid)) return true;
        if (targetMembers.some((mUuid) => orderMembers.includes(mUuid))) return true;
      }

      return false;
    },
    [selectedLabsetUuid, fetchedLabsets],
  );

  const groupedOrdersByPatient = useMemo(() => {
    if (parsedLabOrders && parsedLabOrders.length > 0) {
      const patientUuids = [...new Set(parsedLabOrders.map((order) => order.patient.uuid))];

      return (
        patientUuids
          .map((patientUuid) => {
            let labOrdersForPatient = parsedLabOrders.filter((order) => order.patient.uuid === patientUuid);
            let flattenedLabOrdersForPatient = flattenedLabOrders.filter((order) => order.patientUuid === patientUuid);

            // Apply labset filter to individual orders if set
            if (selectedLabsetUuid && fetchedLabsets) {
              labOrdersForPatient = labOrdersForPatient.filter((order) =>
                isRelatedLabset(order.concept?.uuid),
              );
              flattenedLabOrdersForPatient = flattenedLabOrdersForPatient.filter((order) =>
                isRelatedLabset(order.conceptUuid),
              );
            }

            // Apply priority filter to individual orders if set
            if (priorityFilter) {
              const filterNorm = priorityFilter.toUpperCase();
              labOrdersForPatient = labOrdersForPatient.filter((order) => {
                const normUrgency = order.urgency?.toUpperCase();
                return (
                  normUrgency === filterNorm ||
                  (filterNorm === 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA' && normUrgency === 'STAT') ||
                  (filterNorm === 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85' && normUrgency === 'ROUTINE') ||
                  (filterNorm === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' && normUrgency === 'ON_SCHEDULED_DATE')
                );
              });
              flattenedLabOrdersForPatient = flattenedLabOrdersForPatient.filter((order) => {
                const normUrgency = order.urgency?.toUpperCase();
                return (
                  normUrgency === filterNorm ||
                  (filterNorm === 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA' && normUrgency === 'STAT') ||
                  (filterNorm === 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85' && normUrgency === 'ROUTINE') ||
                  (filterNorm === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' && normUrgency === 'ON_SCHEDULED_DATE')
                );
              });
            }

            // Apply instructions filter to individual orders if set
            if (instructionsFilter) {
              const filterHosp = 'paciente hospitalizado';
              const filterReg = 'solo para ser enviado a hospital regional';

              const matchInstruction = (instructions: string | undefined) => {
                const norm = (instructions || '').toLowerCase();
                if (instructionsFilter === 'HOSPITALIZED') {
                  return norm.includes(filterHosp);
                }
                if (instructionsFilter === 'REGIONAL') {
                  return norm.includes(filterReg);
                }
                if (instructionsFilter === 'OTHER') {
                  return !norm.includes(filterHosp) && !norm.includes(filterReg);
                }
                return true;
              };

              labOrdersForPatient = labOrdersForPatient.filter((order) => matchInstruction(order.instructions));
              flattenedLabOrdersForPatient = flattenedLabOrdersForPatient.filter((order) =>
                matchInstruction(order.instructions),
              );
            }

            // Sort individual orders by priority (highest priority first)
            // For orders with the same priority, if they are "Programado" (rank 5), sort by scheduledDate ascending (closest to furthest).
            const sortOrders = (a: PrioritizedOrderLike, b: PrioritizedOrderLike) => {
              const rankA = getPriorityRank(a.urgency);
              const rankB = getPriorityRank(b.urgency);
              if (rankA === rankB && rankA === 5) {
                const timeA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Number.MAX_VALUE;
                const timeB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Number.MAX_VALUE;
                return timeA - timeB;
              }
              return rankA - rankB;
            };

            flattenedLabOrdersForPatient.sort(sortOrders);
            labOrdersForPatient.sort(sortOrders);

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
              patientAge: patient?.person?.birthdate
                ? age(patient.person.birthdate)
                : patient?.person?.age != null
                  ? String(patient.person.age)
                  : undefined,
              patientDob: patient?.person?.birthdate ? formatDate(parseDate(patient.person.birthdate)) : undefined,
              patientSex: patient?.person?.gender,
              visitUuids: [
                ...new Set(
                  labOrdersForPatient
                    .map((order) => order.encounter?.visit?.uuid)
                    .filter((visitUuid): visitUuid is string => Boolean(visitUuid)),
                ),
              ],
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
          })
      );
    } else {
      return [];
    }
  }, [
    flattenedLabOrders,
    parsedLabOrders,
    patientIdIdentifierTypeUuid,
    priorityFilter,
    selectedLabsetUuid,
    fetchedLabsets,
    instructionsFilter,
  ]);

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

  const handleDownloadCompletedReport = useCallback(() => {
    const header = [
      t('patient', 'Patient'),
      t('orderNumbers', 'Order number'),
      t('testType', 'Test type'),
      t('orderDate', 'Order date'),
      t('orderedBy', 'Ordered by'),
      t('orderStatus', 'Status'),
      t('resultOrComment', 'Result or comment'),
    ];
    const rows = searchResults.flatMap((group) =>
      group.originalOrders.map((order) => [
        group.patientName,
        order.orderNumber,
        order.concept?.display ?? order.display,
        order.dateActivated ? formatDate(parseDate(order.dateActivated)) : '',
        order.orderer?.display,
        getFulfillerStatusDisplay(order.fulfillerStatus, t),
        order.fulfillerComment,
      ]),
    );
    const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe-examenes-realizados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [searchResults, t]);

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

  const visibleVisitUuids = useMemo(
    () => [...new Set(paginatedLabOrders.flatMap((groupedOrder) => groupedOrder.visitUuids))].sort(),
    [paginatedLabOrders],
  );
  const { data: visibleVisitCoverage, isLoading: isVisitCoverageLoading } = useSWR<VisitCoverageLookup>(
    visibleVisitUuids.length ? ['laboratory-sis-coverage', ...visibleVisitUuids] : null,
    async (key: Array<string>) => {
      const visitUuids = key.slice(1);
      const results = await Promise.allSettled(visitUuids.map((visitUuid) => fetchVisitInsurance(visitUuid)));

      return Object.fromEntries(
        results.map((result, index) => [
          visitUuids[index],
          result.status === 'fulfilled' ? getSisFinancingState(result.value) : 'error',
        ]),
      );
    },
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset page to 1 when filters change
  useEffect(() => {
    goTo(1);
  }, [filter, priorityFilter, selectedLabsetUuid, instructionsFilter, searchString]);

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
    return paginatedLabOrders.map((groupedOrder) => {
      const sisCoverageState = getSisCoverageDisplayState(
        groupedOrder.visitUuids,
        visibleVisitCoverage,
        isVisitCoverageLoading,
      );
      const sisCoverage = {
        active: <Tag type="green">{t('activeSis', 'Active SIS')}</Tag>,
        inactive: <Tag type="red">{t('inactiveSis', 'Inactive SIS')}</Tag>,
        none: <Tag type="red">{t('noSis', 'No SIS')}</Tag>,
        review: <Tag type="cool-gray">{t('verifySis', 'Verify SIS')}</Tag>,
        loading: <Tag type="gray">{t('checkingSis', 'Checking SIS')}</Tag>,
      }[sisCoverageState];

      return {
        ...groupedOrder,
        id: groupedOrder.patientUuid,
        sisCoverage,
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
              {canEdit ? (
                <OverflowMenuItem
                  className={styles.menuitem}
                  itemText={t('editResults', 'Edit results')}
                  onClick={() => handleLaunchModal(groupedOrder.originalOrders)}
                />
              ) : null}
              <OverflowMenuItem
                className={styles.menuitem}
                itemText={t('printTestResults', 'Print test results')}
                onClick={() => handlePrintModal(groupedOrder.originalOrders)}
              />
            </OverflowMenu>
          </div>
        ) : null,
      };
    });
  }, [
    canEdit,
    handleLaunchModal,
    handlePrintModal,
    isVisitCoverageLoading,
    paginatedLabOrders,
    t,
    visibleVisitCoverage,
  ]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  return (
    <DataTable rows={tableRows} headers={columns} useZebraStyles>
      {({ getExpandHeaderProps, getHeaderProps, getRowProps, getTableProps, headers, rows }) => (
        <TableContainer className={styles.tableContainer}>
          <TableToolbar>
            <TableToolbarContent className={styles.tableToolBar}>
              <Layer className={`${styles.toolbarItem} ${styles.filterGroup}`}>
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
                    type="default"
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
                  type="default"
                />
                <Dropdown
                  id="orderLabsetFilter"
                  initialSelectedItem={
                    selectedLabsetUuid ? labsetOptions.find((l) => l.value === selectedLabsetUuid) : labsetOptions[0]
                  }
                  items={labsetOptions}
                  itemToString={(item) => item?.display}
                  label=""
                  onChange={({ selectedItem }) => setSelectedLabsetUuid(selectedItem?.value)}
                  titleText={t('filterOrdersByLabset', 'Filter by lab set') + ':'}
                  type="default"
                />
                <Dropdown
                  id="orderInstructionsFilter"
                  initialSelectedItem={
                    instructionsFilter
                      ? instructionsFilterOptions.find((i) => i.value === instructionsFilter)
                      : instructionsFilterOptions[0]
                  }
                  items={instructionsFilterOptions}
                  itemToString={(item) => item?.display}
                  label=""
                  onChange={({ selectedItem }) => setInstructionsFilter(selectedItem?.value)}
                  titleText={t('filterByInstructions', 'Filter by instructions') + ':'}
                  type="default"
                />
                <OrdersDateRangePicker />
              </Layer>
              <Layer className={`${styles.toolbarItem} ${styles.searchGroup}`}>
                <Search
                  id="laboratory-orders-search"
                  labelText={t('searchThisList', 'Search this list')}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value)}
                  placeholder={t('searchThisList', 'Search this list')}
                  size="sm"
                />
                {props.showCompletedReportDownload ? (
                  <Button
                    disabled={searchResults.length === 0}
                    kind="tertiary"
                    onClick={handleDownloadCompletedReport}
                    renderIcon={Download}
                    size="sm"
                  >
                    {t('downloadCompletedExamsReport', 'Download completed exams report')}
                  </Button>
                ) : null}
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
