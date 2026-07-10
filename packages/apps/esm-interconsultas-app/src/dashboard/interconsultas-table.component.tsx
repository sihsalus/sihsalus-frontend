import {
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
} from '@carbon/react';
import {
  ConfigurableLink,
  formatDate,
  parseDate,
  showModal,
  usePagination,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deriveStatus, useInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder, InterconsultaTrayFilter } from '../types';
import { getStatusDisplay, getStatusTagType, getUrgencyDisplay } from '../utils/status';
import styles from './interconsultas-table.scss';

const pageSizes = [10, 20, 30, 40, 50];
const editPrivileges = ['app:hoja.clinica.interconsultas.editar', 'app:home.interconsultas.editar'];

interface FilterOption {
  uuid: string;
  display: string;
}

const ALL_OPTION: FilterOption = { uuid: '', display: '' };

interface InterconsultasTableProps {
  filter: InterconsultaTrayFilter;
}

const InterconsultasTable: React.FC<InterconsultasTableProps> = ({ filter }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = editPrivileges.some((privilege) => userHasAccess(privilege, session?.user));
  const { interconsultas, isLoading, error } = useInterconsultas(filter);
  const [searchString, setSearchString] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [currentPageSize, setPageSize] = useState(10);

  const allOption = useMemo(() => ({ ...ALL_OPTION, display: t('allFilterOption', 'Todos') }), [t]);

  const serviceOptions = useMemo(() => {
    const seen = new Map<string, FilterOption>();
    for (const order of interconsultas) {
      if (order.concept?.uuid && !seen.has(order.concept.uuid)) {
        seen.set(order.concept.uuid, { uuid: order.concept.uuid, display: order.concept.display ?? '' });
      }
    }
    return [allOption, ...[...seen.values()].sort((a, b) => a.display.localeCompare(b.display))];
  }, [interconsultas, allOption]);

  const locationOptions = useMemo(() => {
    const seen = new Map<string, FilterOption>();
    for (const order of interconsultas) {
      const location = order.encounter?.location;
      if (location?.uuid && !seen.has(location.uuid)) {
        seen.set(location.uuid, { uuid: location.uuid, display: location.display ?? '' });
      }
    }
    return [allOption, ...[...seen.values()].sort((a, b) => a.display.localeCompare(b.display))];
  }, [interconsultas, allOption]);

  const filteredInterconsultas = useMemo(() => {
    const lowerSearch = searchString.trim().toLowerCase();
    return interconsultas.filter((order) => {
      if (serviceFilter && order.concept?.uuid !== serviceFilter) {
        return false;
      }
      if (locationFilter && order.encounter?.location?.uuid !== locationFilter) {
        return false;
      }
      if (lowerSearch) {
        return (
          order.patient?.display?.toLowerCase().includes(lowerSearch) ||
          order.orderNumber?.toLowerCase().includes(lowerSearch) ||
          order.orderer?.display?.toLowerCase().includes(lowerSearch)
        );
      }
      return true;
    });
  }, [interconsultas, serviceFilter, locationFilter, searchString]);

  const { goTo, results: paginatedOrders, currentPage } = usePagination(filteredInterconsultas, currentPageSize);

  const openModal = useCallback((modalName: string, order: InterconsultaOrder) => {
    const dispose = showModal(modalName, {
      closeModal: () => dispose(),
      order,
    });
  }, []);

  const headers = useMemo(
    () => [
      { id: 'dateActivated', key: 'dateActivated', header: t('requestDate', 'Fecha solicitud') },
      { id: 'orderNumber', key: 'orderNumber', header: t('orderNumber', 'N° orden') },
      { id: 'patient', key: 'patient', header: t('patient', 'Paciente') },
      { id: 'service', key: 'service', header: t('destinationService', 'Servicio destino') },
      { id: 'urgency', key: 'urgency', header: t('priority', 'Prioridad') },
      { id: 'orderer', key: 'orderer', header: t('requestedBy', 'Solicitante') },
      { id: 'location', key: 'location', header: t('originLocation', 'Location origen') },
      { id: 'status', key: 'status', header: t('status', 'Estado') },
      { id: 'actions', key: 'actions', header: t('actions', 'Acciones') },
    ],
    [t],
  );

  const buildActions = useCallback(
    (order: InterconsultaOrder) => {
      const status = deriveStatus(order);
      return (
        <OverflowMenu
          aria-label={t('actions', 'Acciones')}
          iconDescription={t('actions', 'Acciones')}
          flipped
          size="sm"
        >
          <OverflowMenuItem
            itemText={t('viewDetail', 'Ver detalle')}
            onClick={() => openModal('interconsulta-detail-modal', order)}
          />
          {canEdit && status === 'REQUESTED' && (
            <OverflowMenuItem
              itemText={t('receiveInterconsulta', 'Recibir')}
              onClick={() => openModal('receive-interconsulta-modal', order)}
            />
          )}
          {canEdit &&
            (status === 'REQUESTED' || status === 'RECEIVED' || status === 'ON_HOLD' || status === 'EXCEPTION') && (
              <OverflowMenuItem
                itemText={t('pickupInterconsulta', 'Atender (recoger)')}
                onClick={() => openModal('pickup-interconsulta-modal', order)}
              />
            )}
          {canEdit && status === 'IN_PROGRESS' && (
            <OverflowMenuItem
              itemText={t('respondInterconsulta', 'Responder')}
              onClick={() => openModal('respond-interconsulta-modal', order)}
            />
          )}
          {canEdit && status !== 'COMPLETED' && status !== 'DECLINED' && status !== 'CANCELLED' && (
            <OverflowMenuItem
              hasDivider
              isDelete
              itemText={t('rejectInterconsulta', 'Rechazar')}
              onClick={() => openModal('reject-interconsulta-modal', order)}
            />
          )}
        </OverflowMenu>
      );
    },
    [openModal, t, canEdit],
  );

  const tableRows = useMemo(
    () =>
      paginatedOrders.map((order) => {
        const status = deriveStatus(order);
        return {
          id: order.uuid,
          dateActivated: order.dateActivated ? formatDate(parseDate(order.dateActivated)) : '—',
          orderNumber: order.orderNumber,
          patient: (
            <ConfigurableLink to={`${globalThis.spaBase}/patient/${order.patient?.uuid}/chart`}>
              {order.patient?.display}
            </ConfigurableLink>
          ),
          service: order.concept?.display ?? '—',
          urgency: getUrgencyDisplay(order.urgency, t),
          orderer: order.orderer?.display?.split(' - ').pop() ?? '—',
          location: order.encounter?.location?.display ?? '—',
          status: (
            <Tag type={getStatusTagType(status)} size="sm">
              {getStatusDisplay(status, t)}
            </Tag>
          ),
          actions: buildActions(order),
        };
      }),
    [paginatedOrders, buildActions, t],
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('error', 'Error')}
        subtitle={t('errorLoadingInterconsultas', 'No se pudieron cargar las interconsultas.')}
      />
    );
  }

  return (
    <DataTable rows={tableRows} headers={headers} useZebraStyles>
      {({ getHeaderProps, getRowProps, getTableProps, headers: tableHeaders, rows }) => (
        <TableContainer className={styles.tableContainer}>
          <TableToolbar>
            <TableToolbarContent className={styles.tableToolbar}>
              <Layer className={styles.toolbarItem}>
                <Dropdown
                  id={`service-filter-${filter}`}
                  items={serviceOptions}
                  itemToString={(item: FilterOption) => item?.display ?? ''}
                  label={t('allFilterOption', 'Todos')}
                  onChange={({ selectedItem }: { selectedItem: FilterOption }) =>
                    setServiceFilter(selectedItem?.uuid ?? '')
                  }
                  titleText={t('filterByService', 'Servicio destino') + ':'}
                  type="inline"
                />
                <Dropdown
                  id={`location-filter-${filter}`}
                  items={locationOptions}
                  itemToString={(item: FilterOption) => item?.display ?? ''}
                  label={t('allFilterOption', 'Todos')}
                  onChange={({ selectedItem }: { selectedItem: FilterOption }) =>
                    setLocationFilter(selectedItem?.uuid ?? '')
                  }
                  titleText={t('filterByOriginLocation', 'Location origen') + ':'}
                  type="inline"
                />
              </Layer>
              <Layer className={styles.toolbarItem}>
                <TableToolbarSearch
                  expanded
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value ?? '')}
                  placeholder={t('searchThisList', 'Buscar en esta lista')}
                  size="sm"
                />
              </Layer>
            </TableToolbarContent>
          </TableToolbar>
          <Table {...getTableProps()} className={styles.table}>
            <TableHead>
              <TableRow>
                {tableHeaders.map((header) => {
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
              {rows.map((row) => {
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TableRow key={key} {...rowProps}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 ? (
            <div className={styles.tileContainer}>
              <Tile className={styles.tile}>
                <p className={styles.emptyStateText}>
                  {t('noInterconsultasFound', 'No hay interconsultas en esta bandeja')}
                </p>
                <p className={styles.emptyStateHelperText}>
                  {t('checkFilters', 'Revise los filtros e intente nuevamente')}
                </p>
              </Tile>
            </div>
          ) : (
            <Pagination
              forwardText={t('nextPage', 'Página siguiente')}
              backwardText={t('previousPage', 'Página anterior')}
              page={currentPage}
              pageSize={currentPageSize}
              pageSizes={pageSizes}
              totalItems={filteredInterconsultas.length}
              onChange={({ pageSize, page }: { pageSize: number; page: number }) => {
                if (pageSize !== currentPageSize) {
                  setPageSize(pageSize);
                }
                if (page !== currentPage) {
                  goTo(page);
                }
              }}
            />
          )}
        </TableContainer>
      )}
    </DataTable>
  );
};

export default InterconsultasTable;
