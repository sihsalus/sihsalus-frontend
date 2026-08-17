import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
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
  restBaseUrl,
  showModal,
  showSnackbar,
  usePagination,
} from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@openmrs/esm-utils';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { ModuleFuaRestURL } from '../constant';
import useFuaRequests, { type FuaRequest } from '../hooks/useFuaRequests';
import type { VisitPatientInfo } from '../hooks/useVisit';
import { exportFuasToExcel } from '../utils/fua-export';
import { loadSafeFuaHtmlInWindow } from '../utils/safe-fua-html';

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

interface FuaRequestPatientInfo {
  display: string;
  identifier: string | null;
  searchableText: string;
}

interface FuaActionsCellProps {
  fuaRequest: FuaRequest;
  onView: (fuaRequest: FuaRequest) => void;
  onViewHistory: (fuaRequest: FuaRequest) => void;
  onDownload: (fuaRequest: FuaRequest) => void;
  isDownloading: boolean;
  t: (key: string, defaultValue: string) => string;
}

const FuaActionsCell: React.FC<FuaActionsCellProps> = ({
  fuaRequest,
  onView,
  onViewHistory,
  onDownload,
  isDownloading,
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
  </div>
);

async function fetchFuaRequestPatients(_key: string, visitUuids: Array<string>) {
  const patientEntries = await Promise.all(
    visitUuids.map(async (visitUuid) => {
      const response = await openmrsFetch<{ patient: VisitPatientInfo }>(
        `${restBaseUrl}/visit/${visitUuid}?v=custom:(patient:(display,identifiers:(identifier,identifierType:(display))))`,
      );
      const patient = response.data?.patient;
      const identifier = getPreferredIdentifier(patient?.identifiers ?? [])?.identifier ?? null;
      const searchableText = [patient?.display, identifier].filter(Boolean).join(' ').toLowerCase();

      return [
        visitUuid,
        {
          display: patient?.display ?? '',
          identifier,
          searchableText,
        },
      ] as const;
    }),
  );

  return new Map<string, FuaRequestPatientInfo>(patientEntries);
}

const PatientCell: React.FC<{ visitUuid: string; patientInfo?: FuaRequestPatientInfo }> = ({ visitUuid, patientInfo }) => {
  if (!patientInfo) {
    return <span>—</span>;
  }

  if (!patientInfo.display) {
    return <span title={visitUuid}>—</span>;
  }

  return (
    <div>
      <div>{patientInfo.display}</div>
      {patientInfo.identifier ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>{patientInfo.identifier}</div>
      ) : null}
    </div>
  );
};

function getFuaRequestRowId(request: FuaRequest, index: number) {
  return request.uuid || request.visitUuid || String(index);
}

function getPatientCellValue(patientInfo?: FuaRequestPatientInfo) {
  return [patientInfo?.display, patientInfo?.identifier].filter(Boolean).join(' ') || '—';
}

const FuaRequestTable: React.FC<FuaRequestTableProps> = ({ statusFilter = 'all' }) => {
  const { t } = useTranslation();

  const { fuaOrders, isLoading, isValidating, mutate } = useFuaRequests({
    status: statusFilter !== 'all' ? statusFilter : null,
    excludeCanceled: true,
  });

  const [searchString, setSearchString] = useState('');
  const [downloadingVisitUuids, setDownloadingVisitUuids] = useState<ReadonlySet<string>>(new Set());
  const visitUuids = useMemo(
    () => Array.from(new Set((fuaOrders ?? []).map((request) => request.visitUuid).filter(Boolean))).sort(),
    [fuaOrders],
  );
  const { data: patientInfoByVisitUuid } = useSWR(
    visitUuids.length > 0 ? ['fua-request-patients', visitUuids] : null,
    ([key, uuids]) => fetchFuaRequestPatients(key, uuids),
  );

  const filteredData = useMemo(() => {
    if (!fuaOrders) return [];
    if (!searchString) return fuaOrders;
    if (!patientInfoByVisitUuid) return fuaOrders;
    const search = searchString.toLowerCase().trim();
    return fuaOrders.filter((req) => patientInfoByVisitUuid.get(req.visitUuid)?.searchableText.includes(search));
  }, [fuaOrders, patientInfoByVisitUuid, searchString]);

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
        loadSafeFuaHtmlInWindow(fuaWindow, html);
      } catch (error) {
        const errorMessage = getUserFacingErrorMessage(
          error,
          t('errorLoadingFuaMessage', 'No se pudo cargar el FUA. Intente nuevamente.'),
          { logContext: `Load FUA request ${fuaRequest.uuid}` },
        );
        fuaWindow.document.body.textContent = errorMessage;
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: errorMessage,
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
      } catch (error) {
        const errorMessage = getUserFacingErrorMessage(
          error,
          t('errorDownloadingFuaMessage', 'No se pudo descargar el FUA. Intente nuevamente.'),
          { logContext: `Download FUA request ${fuaRequest.uuid}` },
        );
        showSnackbar({
          kind: 'error',
          title: t('errorDownloadingFua', 'Error al descargar FUA'),
          subtitle: errorMessage,
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

  const handleViewHistorial = useCallback((fuaRequest: FuaRequest) => {
    const dispose = showModal('fua-historial-modal', {
      fuaRequest,
      closeModal: () => dispose(),
    });
  }, []);

  const handleExport = useCallback(() => {
    void exportFuasToExcel(filteredData);
  }, [filteredData]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const headers = [
    { key: 'requestId', header: t('id', 'ID') },
    { key: 'patient', header: t('patient', 'Paciente') },
    { key: 'estado', header: t('status', 'Estado') },
    { key: 'fechaCreacion', header: t('creationDate', 'Fecha de Creación') },
    { key: 'fechaActualizacion', header: t('fuaUpdatedAt', 'Fecha de Actualización') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows =
    results?.map((request: FuaRequest, index: number) => ({
      id: getFuaRequestRowId(request, index),
      requestId: request.id,
      patient: getPatientCellValue(patientInfoByVisitUuid?.get(request.visitUuid)),
      fechaActualizacion: request.fechaActualizacion
        ? formatDate(new Date(request.fechaActualizacion), { mode: 'standard' })
        : 'N/A',
      estado: request.fuaEstado?.nombre || t('noStatus', 'Sin estado'),
      fechaCreacion: formatDate(new Date(request.fechaCreacion), { mode: 'standard' }),
      actions: request,
    })) ?? [];

  const requestByRowId = useMemo(
    () => new Map(results?.map((request, index) => [getFuaRequestRowId(request, index), request]) ?? []),
    [results],
  );

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
                {rows.map((row) => {
                  const fuaRequest = requestByRowId.get(row.id);
                  if (!fuaRequest) {
                    return null;
                  }

                  return (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.tableCell}>
                          {cell.info.header === 'patient' ? (
                            <PatientCell
                              visitUuid={fuaRequest.visitUuid}
                              patientInfo={patientInfoByVisitUuid?.get(fuaRequest.visitUuid)}
                            />
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
