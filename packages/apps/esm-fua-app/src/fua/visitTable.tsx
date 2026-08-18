import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineNotification,
  Layer,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
} from '@carbon/react';
import { Add, Renew } from '@carbon/react/icons';
import {
  ErrorState,
  getUserFacingErrorMessage,
  showSnackbar,
  useConfig,
  usePagination,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import {
  fuaManagePrivilege,
  sisAccreditationNoConsultadaConceptUuid,
  sisAccreditationNoVigenteConceptUuid,
  sisAccreditationPendienteConceptUuid,
  sisAccreditationVigenteConceptUuid,
} from '../constant';
import {
  FuaGenerationError,
  generateFuaFromVisit,
  generateFuasFromVisits,
  getVisitAccreditationCheckedAt,
  getVisitAccreditationStatusUuid,
  getVisitFinanciadorDisplay,
  getVisitFinanciadorUuid,
  getVisitInsuranceNumber,
  isSisFinanciador,
  useVisits,
  type VisitSummary,
} from '../hooks/useVisit';
import useFuaRequests from '../hooks/useFuaRequests';

import styles from './fua-request-table.scss';

function formatVisitDate(startDatetime?: string) {
  const datePart = startDatetime?.slice(0, 10);
  if (!datePart) {
    return 'N/A';
  }

  const [year, month, day] = datePart.split('-');
  return year && month && day ? `${day}-${month}-${year}` : 'N/A';
}

function getPatientName(visit: VisitSummary) {
  return visit.patient?.person?.names?.[0]?.display?.trim() || 'N/A';
}

function getArea(visit: VisitSummary) {
  return visit.location?.display?.trim() || 'N/A';
}

type AccreditationTagType = 'green' | 'red' | 'magenta' | 'gray';

interface AccreditationInfo {
  isVigente: boolean;
  label: string;
  tagType: AccreditationTagType;
}

function getAccreditationInfo(
  statusUuid: string | null,
  checkedAt: string | null,
  hasRequiredInsuranceNumber: boolean,
  t: TFunction,
): AccreditationInfo {
  const isVerifiedStatus =
    statusUuid === sisAccreditationVigenteConceptUuid || statusUuid === sisAccreditationNoVigenteConceptUuid;

  if (isVerifiedStatus && !hasRequiredInsuranceNumber) {
    return {
      isVigente: false,
      label: t('accreditationMissingInsuranceNumber', 'Sin número de afiliación'),
      tagType: 'red',
    };
  }

  if (!checkedAt && isVerifiedStatus) {
    return {
      isVigente: false,
      label: t('accreditationMissingCheckedAt', 'Sin fecha de acreditación'),
      tagType: 'red',
    };
  }

  switch (statusUuid) {
    case sisAccreditationVigenteConceptUuid:
      return { isVigente: true, label: t('accreditationVigente', 'Vigente'), tagType: 'green' };
    case sisAccreditationNoVigenteConceptUuid:
      return { isVigente: false, label: t('accreditationNoVigente', 'No vigente'), tagType: 'red' };
    case sisAccreditationPendienteConceptUuid:
      return { isVigente: false, label: t('accreditationPendiente', 'Pendiente'), tagType: 'magenta' };
    case sisAccreditationNoConsultadaConceptUuid:
      return { isVigente: false, label: t('accreditationNoConsultada', 'No consultada'), tagType: 'gray' };
    default:
      return { isVigente: false, label: t('accreditationSinRegistrar', 'Sin registrar'), tagType: 'gray' };
  }
}

interface VisitRowInfo {
  visit: VisitSummary;
  rowId: string;
  financiadorDisplay: string;
  isSis: boolean;
  accreditationStatusUuid: string | null;
  accreditationCheckedAt: string | null;
  accreditation: AccreditationInfo;
  hasGeneratedFua: boolean;
}

function getFuaGenerationErrorMessage(error: unknown, t: TFunction) {
  if (!(error instanceof FuaGenerationError)) {
    return t('errorGeneratingFua', 'Ocurrió un error al generar el FUA');
  }

  if (error.status === 401 || error.status === 403) {
    return t(
      'fuaGenerationAuthorizationError',
      'El servidor rechazó la generación del FUA. Su sesión permanece activa; inténtelo nuevamente o contacte al administrador.',
    );
  }

  if ([400, 404, 409, 422].includes(error.status ?? 0)) {
    return t(
      'fuaGenerationDataError',
      'No se pudo generar el FUA con la información actual de la consulta. Revise los datos e inténtelo nuevamente.',
    );
  }

  if (error.status === null || error.status === 0) {
    return t(
      'fuaGenerationNetworkError',
      'No se pudo conectar con el servicio de generación FUA. Inténtelo nuevamente.',
    );
  }

  if (error.status >= 500) {
    return t(
      'fuaGenerationServerError',
      'El servicio de generación FUA no está disponible temporalmente. Inténtelo nuevamente o contacte al administrador.',
    );
  }

  return t('errorGeneratingFua', 'Ocurrió un error al generar el FUA');
}

const VisitTable: React.FC = () => {
  const { t } = useTranslation();
  const { sisInsuranceConceptUuid, legacySisProductConceptUuids } = useConfig<Config>();
  const { visits, hasLoadedVisits, isLoading, isError, isValidating, mutate } = useVisits();
  const { fuaOrders } = useFuaRequests({ status: null, excludeCanceled: true });
  const [searchString, setSearchString] = useState('');
  const [generatingVisitUuid, setGeneratingVisitUuid] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkSelectionMode, setIsBulkSelectionMode] = useState(false);
  const [dataTableKey, setDataTableKey] = useState(0);
  const visitsRefreshInFlight = useRef<Promise<unknown> | null>(null);
  const [isVisitsRefreshPending, setIsVisitsRefreshPending] = useState(false);
  const generatedFuaVisitUuids = useMemo(
    () => new Set((fuaOrders ?? []).map((fuaOrder) => fuaOrder.visitUuid).filter(Boolean)),
    [fuaOrders],
  );

  const visitInfos = useMemo<Array<VisitRowInfo>>(
    () =>
      visits.map((visit, index) => {
        const financiadorUuid = getVisitFinanciadorUuid(visit);
        const isSis = isSisFinanciador(financiadorUuid, sisInsuranceConceptUuid, legacySisProductConceptUuids ?? []);
        const accreditationStatusUuid = getVisitAccreditationStatusUuid(visit);
        const accreditationCheckedAt = getVisitAccreditationCheckedAt(visit);
        const insuranceNumber = getVisitInsuranceNumber(visit);

        return {
          visit,
          rowId: visit.uuid ?? `${visit.startDatetime ?? 'visit'}-${index}`,
          financiadorDisplay: getVisitFinanciadorDisplay(visit) ?? t('noFinanciador', 'Sin financiador'),
          isSis,
          accreditationStatusUuid,
          accreditationCheckedAt,
          hasGeneratedFua: Boolean(visit.uuid && generatedFuaVisitUuids.has(visit.uuid)),
          accreditation: getAccreditationInfo(
            accreditationStatusUuid,
            accreditationCheckedAt,
            !isSis || Boolean(insuranceNumber),
            t,
          ),
        };
      }),
    [visits, sisInsuranceConceptUuid, legacySisProductConceptUuids, generatedFuaVisitUuids, t],
  );

  const filteredData = useMemo(() => {
    const eligibleVisits = visitInfos.filter((info) => info.isSis && info.accreditation.isVigente);

    if (!searchString) {
      return eligibleVisits;
    }

    const search = searchString.toLowerCase();
    return eligibleVisits.filter((info) => getPatientName(info.visit).toLowerCase().includes(search));
  }, [visitInfos, searchString]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { results, goTo, currentPage } = usePagination(filteredData, currentPageSize);

  const infoByRowId = useMemo(() => new Map(results.map((info) => [info.rowId, info])), [results]);

  const headers = [
    { key: 'patient', header: t('patient', 'Paciente') },
    { key: 'area', header: t('area', 'Área') },
    { key: 'financiador', header: t('financiador', 'Financiador') },
    { key: 'acreditacion', header: t('accreditation', 'Acreditación') },
    { key: 'fechaCreacion', header: t('creationDate', 'Fecha de Creación') },
    { key: 'fua', header: t('fua', 'FUA') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows = results.map((info) => ({
    id: info.rowId,
    patient: getPatientName(info.visit),
    area: getArea(info.visit),
    financiador: info.financiadorDisplay,
    acreditacion: info.accreditation.label,
    fechaCreacion: formatVisitDate(info.visit.startDatetime),
    fua: info.hasGeneratedFua ? t('fuaGenerated', 'Generado') : t('fuaPending', 'Pendiente'),
    actions: info.visit.uuid ?? '',
  }));

  const handleVisitsRefresh = useCallback(async () => {
    if (isValidating || visitsRefreshInFlight.current) {
      return;
    }

    setIsVisitsRefreshPending(true);
    const refreshPromise = Promise.resolve().then(() => mutate());
    visitsRefreshInFlight.current = refreshPromise;

    try {
      await refreshPromise;
    } catch (error) {
      // SWR exposes this failure through `isError`; keep the click handler from
      // producing an unhandled rejection while the recoverable UI stays open.
      console.error('[esm-fua-app] No se pudieron actualizar las visitas.', error);
    } finally {
      if (visitsRefreshInFlight.current === refreshPromise) {
        visitsRefreshInFlight.current = null;
        setIsVisitsRefreshPending(false);
      }
    }
  }, [isValidating, mutate]);

  const visitsAreRefreshing = isValidating || isVisitsRefreshPending;

  const handleGenerateFua = useCallback(
    async (visitUuid: string) => {
      if (!visitUuid) {
        return;
      }

      setGeneratingVisitUuid(visitUuid);

      try {
        await generateFuaFromVisit(visitUuid);
        showSnackbar({
          kind: 'success',
          title: t('success', 'Exito'),
          subtitle: t('fuaGeneratedSuccessfully', 'El FUA se genero correctamente'),
        });
        mutate();
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('errorGeneratingFua', 'Ocurrió un error al generar el FUA'),
          subtitle: getUserFacingErrorMessage(error, getFuaGenerationErrorMessage(error, t), {
            logContext: `Generate FUA for visit ${visitUuid}`,
          }),
        });
      } finally {
        setGeneratingVisitUuid(null);
      }
    },
    [mutate, t],
  );

  const requestGenerateFua = useCallback(
    (visitUuid: string) => {
      if (!visitUuid) {
        return;
      }

      const info = infoByRowId.get(visitUuid);

      if (!info?.isSis || !info.accreditation.isVigente) {
        return;
      }

      void handleGenerateFua(visitUuid);
    },
    [infoByRowId, handleGenerateFua],
  );

  const handleBulkGenerateFuas = useCallback(
    async (visitUuids: Array<string>) => {
      const selectedVisitUuids = visitUuids.filter(Boolean);

      if (selectedVisitUuids.length === 0) {
        return;
      }

      const eligibleVisitUuids: Array<string> = [];
      const excludedVisits: Array<{ visitUuid: string; accreditationStatus: string }> = [];

      for (const visitUuid of selectedVisitUuids) {
        const info = infoByRowId.get(visitUuid);

        if (info?.isSis && info.accreditation.isVigente) {
          eligibleVisitUuids.push(visitUuid);
        } else {
          excludedVisits.push({
            visitUuid,
            accreditationStatus: info?.accreditation.label ?? t('accreditationSinRegistrar', 'Sin registrar'),
          });
        }
      }

      if (excludedVisits.length > 0) {
        console.warn('[esm-fua-app] Visitas excluidas de la generación masiva de FUA por acreditación SIS', {
          excludedVisits,
          timestamp: new Date().toISOString(),
        });
        showSnackbar({
          kind: 'warning',
          title: t('bulkVisitsExcludedTitle', 'Visitas excluidas del lote'),
          subtitle: t(
            'bulkVisitsExcludedSubtitle',
            'Se excluyeron {{count}} visitas sin acreditación SIS vigente. Genérelas individualmente si corresponde (contingencia FUA papel).',
            { count: excludedVisits.length },
          ),
        });
      }

      if (eligibleVisitUuids.length === 0) {
        return;
      }

      setIsBulkGenerating(true);

      try {
        const { successful, failed } = await generateFuasFromVisits(eligibleVisitUuids);

        if (successful > 0) {
          showSnackbar({
            kind: 'success',
            title: t('success', 'Exito'),
            subtitle: t('fuasGeneratedSuccessfully', 'Se generaron {{count}} FUAs correctamente', {
              count: successful,
            }),
          });
        }

        if (failed > 0) {
          showSnackbar({
            kind: 'error',
            title: t('error', 'Error'),
            subtitle: t('fuasGenerationFailed', 'No se pudieron generar {{count}} FUAs', {
              count: failed,
            }),
          });
        }

        mutate();
        setIsBulkSelectionMode(false);
        setDataTableKey((key) => key + 1);
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('error', 'Error'),
          // error-exposure-guard-ignore -- the fallback maps only controlled FUA status categories.
          subtitle: getUserFacingErrorMessage(error, getFuaGenerationErrorMessage(error, t), {
            logContext: 'Bulk FUA generation',
          }),
        });
      } finally {
        setIsBulkGenerating(false);
      }
    },
    [infoByRowId, mutate, t],
  );

  const handleCancelBulkSelection = useCallback(() => {
    setIsBulkSelectionMode(false);
    setDataTableKey((key) => key + 1);
  }, []);

  if (isLoading && !hasLoadedVisits) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  if (isError && !hasLoadedVisits) {
    return (
      <div className={styles.tableContainer} aria-busy={visitsAreRefreshing}>
        <div role="alert">
          <ErrorState error={isError} headerTitle={t('visitsLoadError', 'No se pudieron cargar las visitas')} />
        </div>
        <div className={styles.errorActions}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            disabled={visitsAreRefreshing}
            onClick={() => void handleVisitsRefresh()}
          >
            {visitsAreRefreshing ? t('refreshing', 'Actualizando...') : t('retry', 'Reintentar')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer} aria-busy={visitsAreRefreshing}>
      {isError ? (
        <div className={styles.cachedError}>
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            role="alert"
            subtitle={t(
              'visitsRefreshErrorCached',
              'Se muestran los últimos datos disponibles. Intente actualizar nuevamente.',
            )}
            title={t('visitsRefreshError', 'No se pudieron actualizar las visitas')}
          />
          <div className={styles.errorActions}>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Renew}
              disabled={visitsAreRefreshing}
              onClick={() => void handleVisitsRefresh()}
            >
              {visitsAreRefreshing ? t('refreshing', 'Actualizando...') : t('retry', 'Reintentar')}
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable key={dataTableKey} rows={rows} headers={headers} isSortable useZebraStyles size="sm">
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, getSelectionProps, selectedRows }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar>
              <TableToolbarContent className={`${styles.toolbarContent} ${styles.consultasToolbarContent}`}>
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
                <RequirePrivilege privilege={fuaManagePrivilege} hideUnauthorized>
                  <div className={styles.toolbarActions}>
                    {isBulkSelectionMode ? (
                      <>
                        <Button
                          kind="primary"
                          size="sm"
                          renderIcon={Add}
                          disabled={selectedRows.length === 0 || isBulkGenerating}
                          onClick={() => handleBulkGenerateFuas(selectedRows.map((row) => row.id))}
                        >
                          {isBulkGenerating
                            ? t('generatingFuas', 'Generando FUAs...')
                            : t('generateSelectedFuas', 'Generar FUAs seleccionados')}
                        </Button>
                        <Button kind="ghost" size="sm" onClick={handleCancelBulkSelection} disabled={isBulkGenerating}>
                          {t('cancel', 'Cancelar')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        kind="secondary"
                        size="sm"
                        renderIcon={Add}
                        onClick={() => setIsBulkSelectionMode(true)}
                        disabled={isBulkGenerating}
                      >
                        {t('generateFuasInBulk', 'Generar FUAs en masa')}
                      </Button>
                    )}
                  </div>
                </RequirePrivilege>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Renew}
                  onClick={() => void handleVisitsRefresh()}
                  disabled={visitsAreRefreshing}
                >
                  {visitsAreRefreshing ? t('refreshing', 'Actualizando...') : t('refresh', 'Actualizar')}
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} className={styles.table} aria-label={t('visits', 'Visitas')}>
              <TableHead>
                <TableRow>
                  {isBulkSelectionMode ? (
                    <RequirePrivilege privilege={fuaManagePrivilege} hideUnauthorized>
                      <TableSelectAll {...getSelectionProps()} disabled={isBulkGenerating} />
                    </RequirePrivilege>
                  ) : null}
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })} className={styles.tableHeader}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const rowInfo = infoByRowId.get(row.id);

                  return (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {isBulkSelectionMode ? (
                        <RequirePrivilege privilege={fuaManagePrivilege} hideUnauthorized>
                          <TableSelectRow
                            {...getSelectionProps({ row })}
                            disabled={isBulkGenerating || !rowInfo?.isSis || !rowInfo.accreditation.isVigente}
                          />
                        </RequirePrivilege>
                      ) : null}
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.tableCell}>
                          {cell.info.header === 'actions' ? (
                            <RequirePrivilege privilege={fuaManagePrivilege} hideUnauthorized>
                              <span
                                title={
                                  rowInfo && !rowInfo.isSis
                                    ? t(
                                        'fuaOnlyForSisVisits',
                                        'El FUA solo aplica a visitas con financiador SIS. Esta visita tiene otro financiador o no lo tiene registrado.',
                                      )
                                    : undefined
                                }
                              >
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  renderIcon={Add}
                                  iconDescription={t('generateFua', 'Generar FUA')}
                                  disabled={
                                    !cell.value ||
                                    !rowInfo?.isSis ||
                                    !rowInfo.accreditation.isVigente ||
                                    generatingVisitUuid === cell.value ||
                                    isBulkGenerating
                                  }
                                  onClick={() => requestGenerateFua(cell.value)}
                                >
                                  {generatingVisitUuid === cell.value
                                    ? t('generatingFua', 'Generando FUA...')
                                    : t('generateFua', 'Generar FUA')}
                                </Button>
                              </span>
                            </RequirePrivilege>
                          ) : cell.info.header === 'financiador' ? (
                            <Tag size="sm" type={rowInfo?.isSis ? 'blue' : 'gray'}>
                              {cell.value}
                            </Tag>
                          ) : cell.info.header === 'acreditacion' ? (
                            <Tag size="sm" type={rowInfo?.accreditation.tagType ?? 'gray'}>
                              {cell.value}
                            </Tag>
                          ) : cell.info.header === 'fua' ? (
                            <Tag size="sm" type={rowInfo?.hasGeneratedFua ? 'green' : 'gray'}>
                              {cell.value}
                            </Tag>
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
                    <p className={styles.content}>
                      {t('noActiveSisVisitsFound', 'No se encontraron visitas con SIS vigente')}
                    </p>
                    <p className={styles.emptyStateHelperText}>
                      {t(
                        'noActiveSisVisitsHelper',
                        'El FUA solo está disponible para pacientes con financiador SIS y acreditación vigente.',
                      )}
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

export default VisitTable;
