import {
  ActionableNotification,
  Button,
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
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { interconsultasHomeEditPrivilege } from '../constants';
import { deriveStatus, useInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder, InterconsultaTrayFilter } from '../types';
import { getInterconsultaDestinationDisplay, getInterconsultaReason } from '../utils/interconsulta-details';
import { getStatusDisplay, getStatusTagType, getUrgencyDisplay } from '../utils/status';
import InterconsultasEmptyState from './interconsultas-empty-state.component';
import styles from './interconsultas-table.scss';

const pageSizes = [10, 20, 30, 40, 50];
interface FilterOption {
  uuid: string;
  display: string;
}

const ALL_OPTION: FilterOption = { uuid: '', display: '' };

const normalizeSearchText = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

interface InterconsultasTableProps {
  filter: InterconsultaTrayFilter;
}

const InterconsultasTable: React.FC<InterconsultasTableProps> = ({ filter }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(interconsultasHomeEditPrivilege, session?.user);
  const { interconsultas, isLoading, error, mutate } = useInterconsultas(filter);
  const [searchString, setSearchString] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [currentPageSize, setPageSize] = useState(10);
  const hasActiveFilters = Boolean(searchString.trim() || serviceFilter || locationFilter);

  const allOption = useMemo(() => ({ ...ALL_OPTION, display: t('allFilterOption', 'Todos') }), [t]);

  const serviceOptions = useMemo(() => {
    const seen = new Map<string, FilterOption>();
    for (const order of interconsultas) {
      if (order.concept?.uuid && !seen.has(order.concept.uuid)) {
        seen.set(order.concept.uuid, {
          uuid: order.concept.uuid,
          display: getInterconsultaDestinationDisplay(order),
        });
      }
    }
    return [allOption, ...[...seen.values()].sort((a, b) => a.display.localeCompare(b.display))];
  }, [interconsultas, allOption]);

  const locationOptions = useMemo(() => {
    const seen = new Map<string, FilterOption>();
    for (const order of interconsultas) {
      const location = order.encounter?.location;
      if (location?.uuid && !seen.has(location.uuid)) {
        seen.set(location.uuid, {
          uuid: location.uuid,
          display: location.display ?? '',
        });
      }
    }
    return [allOption, ...[...seen.values()].sort((a, b) => a.display.localeCompare(b.display))];
  }, [interconsultas, allOption]);

  const filteredInterconsultas = useMemo(() => {
    const lowerSearch = normalizeSearchText(searchString.trim());
    return interconsultas
      .filter((order) => {
        if (serviceFilter && order.concept?.uuid !== serviceFilter) {
          return false;
        }
        if (locationFilter && order.encounter?.location?.uuid !== locationFilter) {
          return false;
        }
        if (lowerSearch) {
          return (
            normalizeSearchText(order.patient?.display).includes(lowerSearch) ||
            normalizeSearchText(order.orderNumber).includes(lowerSearch) ||
            normalizeSearchText(order.orderer?.display).includes(lowerSearch) ||
            normalizeSearchText(getInterconsultaDestinationDisplay(order)).includes(lowerSearch) ||
            normalizeSearchText(getInterconsultaReason(order)).includes(lowerSearch) ||
            normalizeSearchText(order.encounter?.location?.display).includes(lowerSearch)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const urgency = Number(b.urgency === 'STAT') - Number(a.urgency === 'STAT');
        if (urgency) return urgency;
        const activated = (Date.parse(a.dateActivated) || Infinity) - (Date.parse(b.dateActivated) || Infinity);
        return activated || a.uuid.localeCompare(b.uuid);
      });
  }, [interconsultas, serviceFilter, locationFilter, searchString]);

  const {
    goTo,
    results: paginatedOrders,
    currentPage,
    totalPages,
  } = usePagination(filteredInterconsultas, currentPageSize);

  useEffect(() => {
    if (currentPage > totalPages) goTo(totalPages);
  }, [currentPage, totalPages, goTo]);

  const clearFilters = () => {
    setSearchString('');
    setServiceFilter('');
    setLocationFilter('');
    goTo(1);
  };

  const openModal = useCallback((modalName: string, order: InterconsultaOrder) => {
    const dispose = showModal(modalName, {
      closeModal: () => dispose(),
      order,
    });
  }, []);

  const headers = useMemo(
    () => [
      {
        id: 'dateActivated',
        key: 'dateActivated',
        header: t('requestDate', 'Fecha solicitud'),
      },
      {
        id: 'orderNumber',
        key: 'orderNumber',
        header: t('orderNumber', 'N° orden'),
      },
      { id: 'patient', key: 'patient', header: t('patient', 'Paciente') },
      {
        id: 'service',
        key: 'service',
        header: t('destinationService', 'Servicio destino'),
      },
      { id: 'urgency', key: 'urgency', header: t('priority', 'Prioridad') },
      {
        id: 'orderer',
        key: 'orderer',
        header: t('requestedBy', 'Solicitante'),
      },
      {
        id: 'location',
        key: 'location',
        header: t('originLocation', 'Origin UPSS'),
      },
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
          aria-label={t('actionsForPatient', 'Acciones para {{patient}}', {
            patient: order.patient?.display ?? '',
          })}
          iconDescription={t('actionsForPatient', 'Acciones para {{patient}}', {
            patient: order.patient?.display ?? '',
          })}
          flipped
          size="sm"
        >
          <OverflowMenuItem
            itemText={t('viewDetail', 'Ver detalle')}
            onClick={() => openModal('home-interconsulta-detail-modal', order)}
          />
          {canEdit && status === 'REQUESTED' && (
            <OverflowMenuItem
              itemText={t('receiveInterconsulta', 'Recibir')}
              onClick={() => openModal('home-receive-interconsulta-modal', order)}
            />
          )}
          {canEdit &&
            (status === 'REQUESTED' || status === 'RECEIVED' || status === 'ON_HOLD' || status === 'EXCEPTION') && (
              <OverflowMenuItem
                itemText={t('pickupInterconsulta', 'Atender (recoger)')}
                onClick={() => openModal('home-pickup-interconsulta-modal', order)}
              />
            )}
          {canEdit && status === 'IN_PROGRESS' && (
            <OverflowMenuItem
              itemText={t('respondInterconsulta', 'Responder')}
              onClick={() => openModal('home-respond-interconsulta-modal', order)}
            />
          )}
          {canEdit && status !== 'COMPLETED' && status !== 'DECLINED' && status !== 'CANCELLED' && (
            <OverflowMenuItem
              hasDivider
              isDelete
              itemText={t('rejectInterconsulta', 'Rechazar')}
              onClick={() => openModal('home-reject-interconsulta-modal', order)}
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
          service: getInterconsultaDestinationDisplay(order),
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
      <ActionableNotification
        actionButtonLabel={t('retry', 'Reintentar')}
        inline
        kind="error"
        lowContrast
        onActionButtonClick={() => mutate()}
        role="alert"
        subtitle={t('errorLoadingInterconsultas', 'No se pudieron cargar las interconsultas.')}
        title={t('error', 'Error')}
      />
    );
  }

  return (
    <DataTable rows={tableRows} headers={headers} useZebraStyles>
      {({ getHeaderProps, getRowProps, getTableProps, headers: tableHeaders, rows }) => (
        <TableContainer className={styles.tableContainer}>
          <TableToolbar>
            <TableToolbarContent className={styles.tableToolbar}>
              <Layer className={styles.filterGroup}>
                <Dropdown
                  id={`service-filter-${filter}`}
                  items={serviceOptions}
                  itemToString={(item: FilterOption) => item?.display ?? ''}
                  label={t('allFilterOption', 'Todos')}
                  onChange={({ selectedItem }: { selectedItem: FilterOption }) => {
                    setServiceFilter(selectedItem?.uuid ?? '');
                    goTo(1);
                  }}
                  selectedItem={serviceOptions.find((option) => option.uuid === serviceFilter) ?? allOption}
                  titleText={t('filterByService', 'Servicio destino')}
                />
                <Dropdown
                  id={`location-filter-${filter}`}
                  items={locationOptions}
                  itemToString={(item: FilterOption) => item?.display ?? ''}
                  label={t('allFilterOption', 'Todos')}
                  onChange={({ selectedItem }: { selectedItem: FilterOption }) => {
                    setLocationFilter(selectedItem?.uuid ?? '');
                    goTo(1);
                  }}
                  selectedItem={locationOptions.find((option) => option.uuid === locationFilter) ?? allOption}
                  titleText={t('filterByOriginLocation', 'UPSS de origen')}
                />
              </Layer>
              <Layer className={styles.searchGroup}>
                <TableToolbarSearch
                  expanded
                  persistent
                  labelText={t('searchThisList', 'Paciente, orden, solicitante o motivo')}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSearchString(e.target.value ?? '');
                    goTo(1);
                  }}
                  placeholder={t('searchThisList', 'Paciente, orden, solicitante o motivo')}
                  size="lg"
                  value={searchString}
                />
                {hasActiveFilters && (
                  <Button kind="ghost" onClick={clearFilters} size="sm">
                    {t('clearFilters', 'Limpiar filtros')}
                  </Button>
                )}
              </Layer>
            </TableToolbarContent>
          </TableToolbar>
          <p className={styles.resultCount} role="status">
            {t('trayResultsCount', 'Resultados: {{visible}} de {{total}}', {
              visible: filteredInterconsultas.length,
              total: interconsultas.length,
            })}
          </p>
          <div className={styles.tableScroll}>
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
          </div>
          {filteredInterconsultas.length === 0 ? (
            <InterconsultasEmptyState
              title={
                hasActiveFilters
                  ? t('noMatchingInterconsultas', 'Ninguna interconsulta coincide con los filtros')
                  : t('noInterconsultasInTray', 'Esta bandeja no tiene interconsultas')
              }
              helperText={
                hasActiveFilters
                  ? t(
                      'adjustInterconsultaFilters',
                      'Cambie la búsqueda o limpie los filtros para ver todas las solicitudes.',
                    )
                  : t('noInterconsultasInTrayHelper', 'Las solicitudes aparecerán aquí cuando alcancen este estado.')
              }
            />
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
                  goTo(1);
                } else if (page !== currentPage) {
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
