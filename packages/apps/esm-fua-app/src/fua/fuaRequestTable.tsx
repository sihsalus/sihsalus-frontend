import {
  Button,
  DataTable,
  DataTableSkeleton,
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
  Tooltip,
} from '@carbon/react';
import { Download, EventSchedule, Renew, View } from '@carbon/react/icons';
import {
  formatDate,
  getUserFacingErrorMessage,
  openmrsFetch,
  showModal,
  showSnackbar,
  usePagination,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const loadHtmlInWindow = (targetWindow: Window, html: string) => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  targetWindow.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  targetWindow.location.href = url;
};

import { fuaUpdatePrivilege, ModuleFuaRestURL } from '../constant';
import useFuaRequests, { type FuaRequest, revalidateFuaRequestCaches, setFuaEstado } from '../hooks/useFuaRequests';
import { useVisit } from '../hooks/useVisit';
import { FUA_ESTADOS } from '../modals/change-fua-status.modal';
import { exportFuasToExcel } from '../utils/fua-export';
import { createInertFuaHtml } from '../utils/fua-html-security';

import { FuaDateRangePicker } from './fua-date-range-picker.component';
import styles from './fua-request-table.scss';

interface FuaRequestTableProps {
  statusFilter?: string;
}

type TagType =
  | 'blue'
  | 'cyan'
  | 'gray'
  | 'green'
  | 'magenta'
  | 'red'
  | 'teal'
  | 'warm-gray'
  | 'cool-gray'
  | 'high-contrast'
  | 'outline';

const estadoTagType: Record<string, TagType> = {
  Pendiente: 'gray',
  'En Proceso': 'blue',
  Completado: 'green',
  'Enviado a SETI-SIS': 'cyan',
  Rechazado: 'red',
  Cancelado: 'magenta',
};

interface FuaActionsCellProps {
  fuaRequest: FuaRequest;
  onView: (fuaRequest: FuaRequest) => void;
  onViewHistory: (fuaRequest: FuaRequest) => void;
  onDownload: (fuaRequest: FuaRequest) => void;
  isDownloading: boolean;
  onChangeStatus: (fuaRequest: FuaRequest) => void;
  onResend: (fuaRequest: FuaRequest) => void;
  onCancel: (fuaRequest: FuaRequest) => void;
  t: (key: string, defaultValue: string) => string;
}

const FuaActionsCell: React.FC<FuaActionsCellProps> = ({
  fuaRequest,
  onView,
  onViewHistory,
  onDownload,
  isDownloading,
  onChangeStatus,
  onResend,
  onCancel,
  t,
}) => (
  <div className={styles.actionsCell}>
    <Button
      kind="ghost"
      size="sm"
      renderIcon={View}
      iconDescription={t('viewFua', 'Ver FUA')}
      hasIconOnly
      onClick={() => onView(fuaRequest)}
      tooltipPosition="left"
    />
    <Button
      kind="ghost"
      size="sm"
      renderIcon={EventSchedule}
      iconDescription={t('viewHistory', 'Ver historial')}
      hasIconOnly
      onClick={() => onViewHistory(fuaRequest)}
      tooltipPosition="left"
    />
    <Button
      kind="ghost"
      size="sm"
      renderIcon={Download}
      iconDescription={t('downloadFua', 'Descargar FUA')}
      hasIconOnly
      className={isDownloading ? styles.downloadingAction : undefined}
      disabled={isDownloading}
      onClick={() => onDownload(fuaRequest)}
      tooltipPosition="left"
    />
    <RequirePrivilege privilege={fuaUpdatePrivilege} hideUnauthorized>
      <OverflowMenu size="sm" flipped ariaLabel={t('actions', 'Acciones')}>
        <OverflowMenuItem itemText={t('changeStatus', 'Cambiar Estado')} onClick={() => onChangeStatus(fuaRequest)} />
        {fuaRequest?.fuaEstado?.nombre === FUA_ESTADOS.RECHAZADO.nombre && (
          <OverflowMenuItem itemText={t('resend', 'Reenviar a SETI-SIS')} onClick={() => onResend(fuaRequest)} />
        )}
        <OverflowMenuItem
          itemText={t('cancelFua', 'Cancelar FUA')}
          onClick={() => onCancel(fuaRequest)}
          isDelete
          hasDivider
        />
      </OverflowMenu>
    </RequirePrivilege>
  </div>
);

/** Resolves visitUuid -> patient name + preferred identity document inline with SWR */
const PatientCell: React.FC<{ visitUuid: string }> = ({ visitUuid }) => {
  const { patient, patientIdentifier, isLoading } = useVisit(visitUuid);
  if (isLoading) return <span>—</span>;
  if (!patient) return <span title={visitUuid}>—</span>;
  return (
    <div>
      <div>{patient.display}</div>
      {patientIdentifier && (
        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>{patientIdentifier}</div>
      )}
    </div>
  );
};

const FuaRequestTable: React.FC<FuaRequestTableProps> = ({ statusFilter = 'all' }) => {
  const { t } = useTranslation();

  const { fuaOrders, isLoading, isValidating, mutate } = useFuaRequests({
    status: statusFilter !== 'all' ? statusFilter : null,
    excludeCanceled: true,
  });

  const [searchString, setSearchString] = useState('');
  const [downloadingVisitUuids, setDownloadingVisitUuids] = useState<ReadonlySet<string>>(new Set());

  const filteredData = useMemo(() => {
    if (!fuaOrders) return [];
    if (!searchString) return fuaOrders;
    const search = searchString.toLowerCase();
    return fuaOrders.filter(
      (req) =>
        req.name?.toLowerCase().includes(search) ||
        req.uuid?.toLowerCase().includes(search) ||
        req.numeroFua?.toLowerCase().includes(search) ||
        req.fuaEstado?.nombre?.toLowerCase().includes(search),
    );
  }, [fuaOrders, searchString]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { results, goTo, currentPage } = usePagination(filteredData ?? [], currentPageSize);

  const handleViewFua = useCallback(
    async (fuaRequest: FuaRequest) => {
      if (!fuaRequest.visitUuid) {
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: t('missingVisitUuid', 'No se encontro el identificador de visita para este FUA'),
        });
        return;
      }

      const fuaWindow = window.open('', '_blank');

      if (!fuaWindow) {
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: t('popupBlocked', 'El navegador bloqueo la nueva pestana'),
        });
        return;
      }

      fuaWindow.opener = null;

      fuaWindow.document.body.textContent = t('loadingFuaDocument', 'Cargando documento FUA...');

      try {
        const response = await openmrsFetch(
          `${ModuleFuaRestURL}/RenderFUA/${encodeURIComponent(fuaRequest.visitUuid)}`,
          {
            method: 'POST',
            headers: {
              Accept: 'text/html',
            },
          },
        );

        const html = await response.text();
        loadHtmlInWindow(fuaWindow, createInertFuaHtml(html));
      } catch (error: unknown) {
        const operatorMessage = getUserFacingErrorMessage(
          error,
          t('couldNotLoadFuaDocument', 'No se pudo cargar el documento FUA'),
          { logContext: 'Render FUA request preview' },
        );
        fuaWindow.document.body.textContent = operatorMessage;
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: operatorMessage,
        });
      }
    },
    [t],
  );

  const handleDownloadFua = useCallback(
    async (fuaRequest: FuaRequest) => {
      if (!fuaRequest.visitUuid) {
        showSnackbar({
          kind: 'error',
          title: t('errorDownloadingFua', 'Error al descargar FUA'),
          subtitle: t('missingVisitUuid', 'No se encontro el identificador de visita para este FUA'),
        });
        return;
      }

      setDownloadingVisitUuids((current) => new Set(current).add(fuaRequest.visitUuid));

      try {
        const response = await openmrsFetch(
          `${ModuleFuaRestURL}/generatePDF/${encodeURIComponent(fuaRequest.visitUuid)}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/pdf',
            },
          },
        );
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FUA-${fuaRequest.numeroFua || fuaRequest.visitUuid}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error: unknown) {
        showSnackbar({
          kind: 'error',
          title: t('errorDownloadingFua', 'Error al descargar FUA'),
          subtitle: getUserFacingErrorMessage(
            error,
            t('couldNotDownloadFuaDocument', 'No se pudo descargar el documento FUA'),
            { logContext: 'Download FUA document' },
          ),
        });
      } finally {
        setDownloadingVisitUuids((current) => {
          const next = new Set(current);
          next.delete(fuaRequest.visitUuid);
          return next;
        });
      }
    },
    [t],
  );

  const handleChangeStatus = useCallback((fuaRequest: FuaRequest) => {
    const dispose = showModal('change-fua-status-modal', {
      fuaRequest,
      onStatusChanged: () => revalidateFuaRequestCaches(),
      closeModal: () => dispose(),
    });
  }, []);

  const handleCancelFua = useCallback((fuaRequest: FuaRequest) => {
    const dispose = showModal('cancel-fua-modal', {
      fuaRequest,
      onCancelled: () => revalidateFuaRequestCaches(),
      closeModal: () => dispose(),
    });
  }, []);

  const handleViewHistorial = useCallback((fuaRequest: FuaRequest) => {
    const dispose = showModal('fua-historial-modal', {
      fuaRequest,
      closeModal: () => dispose(),
    });
  }, []);

  const handleReenviar = useCallback(
    async (fuaRequest: FuaRequest) => {
      const abortController = new AbortController();
      try {
        await setFuaEstado(fuaRequest.id, FUA_ESTADOS.PENDIENTE.id, abortController);
        mutate();
        showSnackbar({
          kind: 'success',
          title: t('success', 'Éxito'),
          subtitle: t('fuaReset', 'FUA devuelto a Pendiente para corrección'),
        });
      } catch (error: unknown) {
        showSnackbar({
          kind: 'error',
          title: t('error', 'Error'),
          subtitle: getUserFacingErrorMessage(
            error,
            t('errorChangingStatus', 'Ocurrió un error al cambiar el estado del FUA'),
            { logContext: 'Return rejected FUA to pending' },
          ),
        });
      }
    },
    [mutate, t],
  );

  const handleExport = useCallback(() => {
    void exportFuasToExcel(filteredData);
  }, [filteredData]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const headers = [
    { key: 'patient', header: t('patient', 'Paciente') },
    { key: 'name', header: t('fuaName', 'Nombre del FUA') },
    { key: 'estado', header: t('status', 'Estado') },
    { key: 'fechaCreacion', header: t('creationDate', 'Fecha de Creación') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows =
    results?.map((request: FuaRequest, index: number) => ({
      id: String(index),
      patient: request.visitUuid,
      name: request.numeroFua ? `${request.numeroFua} — ${request.name || ''}` : request.name || 'N/A',
      estado: request.fuaEstado?.nombre || t('noStatus', 'Sin estado'),
      fechaCreacion: formatDate(new Date(request.fechaCreacion), { mode: 'standard' }),
      actions: request,
    })) ?? [];

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  return (
    <div className={styles.tableContainer}>
      <DataTable rows={rows} headers={headers} isSortable useZebraStyles size="sm">
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar>
              <TableToolbarContent className={styles.toolbarContent}>
                <Layer className={styles.toolbarItem}>
                  <FuaDateRangePicker />
                </Layer>
                <Layer className={styles.toolbarItem}>
                  <TableToolbarSearch
                    expanded
                    onChange={(e) => {
                      setSearchString(typeof e === 'string' ? e : e.target.value);
                    }}
                    placeholder={t('searchThisList', 'Buscar en esta lista')}
                    size="sm"
                  />
                </Layer>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Download}
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                >
                  {t('exportExcel', 'Exportar a Excel')}
                </Button>
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={handleRefresh} disabled={isValidating}>
                  {isValidating ? t('refreshing', 'Actualizando...') : t('refresh', 'Actualizar')}
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} className={styles.table} aria-label={t('fuaRequests', 'Solicitudes FUA')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })} className={styles.tableHeader}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, rowIndex) => {
                  const fuaRequest = results[rowIndex];
                  return (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.tableCell}>
                          {cell.info.header === 'patient' ? (
                            <PatientCell visitUuid={cell.value} />
                          ) : cell.info.header === 'estado' ? (
                            <div>
                              <Tag type={estadoTagType[cell.value] || 'gray'} size="sm">
                                {cell.value}
                              </Tag>
                              {fuaRequest?.observacionesSetiSis && (
                                <Tooltip align="bottom" label={fuaRequest.observacionesSetiSis}>
                                  <span
                                    title={t('setiSisObservation', 'Observación SETI-SIS')}
                                    style={{
                                      marginLeft: '4px',
                                      fontSize: '0.75rem',
                                      color: 'var(--cds-text-error)',
                                      cursor: 'help',
                                    }}
                                  >
                                    ⚠ SETI-SIS
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          ) : cell.info.header === 'actions' ? (
                            <FuaActionsCell
                              fuaRequest={fuaRequest}
                              onView={handleViewFua}
                              onViewHistory={handleViewHistorial}
                              onDownload={handleDownloadFua}
                              isDownloading={Boolean(
                                fuaRequest.visitUuid && downloadingVisitUuids.has(fuaRequest.visitUuid),
                              )}
                              onChangeStatus={handleChangeStatus}
                              onResend={handleReenviar}
                              onCancel={handleCancelFua}
                              t={t}
                            />
                          ) : (
                            cell.value
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noFuaRequestsFound', 'No se encontraron solicitudes FUA')}</p>
                    <p className={styles.emptyStateHelperText}>
                      {t('checkFilters', 'Por favor revisa los filtros de arriba e intenta de nuevo')}
                    </p>
                  </div>
                </Tile>
              </div>
            ) : null}
          </TableContainer>
        )}
      </DataTable>
      {filteredData.length > 0 && (
        <Pagination
          backwardText={t('previousPage', 'Página anterior')}
          forwardText={t('nextPage', 'Página siguiente')}
          itemRangeText={(min, max, total) =>
            t('paginationItemRange', '{{min}}–{{max}} de {{total}} elementos', { min, max, total })
          }
          itemText={(min, max) => t('paginationItems', '{{min}}–{{max}} elementos', { min, max })}
          itemsPerPageText={t('itemsPerPage', 'Elementos por página:')}
          page={currentPage}
          pageRangeText={(_current, total) => t('paginationPageRange', 'de {{total}} páginas', { total })}
          pageSelectLabelText={(total) => t('paginationPageSelect', 'Página de {{total}} páginas', { total })}
          pageText={(page) => t('paginationPage', 'página {{page}}', { page })}
          pageSize={currentPageSize}
          pageSizes={pageSizes}
          totalItems={filteredData.length}
          onChange={({ page, pageSize }) => {
            if (pageSize !== currentPageSize) setPageSize(pageSize);
            goTo(page);
          }}
          className={styles.pagination}
        />
      )}
    </div>
  );
};

export default FuaRequestTable;
