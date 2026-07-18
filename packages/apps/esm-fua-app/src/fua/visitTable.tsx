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
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
  Toggle,
} from '@carbon/react';
import { Add, Renew } from '@carbon/react/icons';
import { showModal, showSnackbar, useConfig, usePagination } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
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
  getVisitAccreditationStatusUuid,
  getVisitFinanciadorDisplay,
  getVisitFinanciadorUuid,
  isSisFinanciador,
  useVisits,
  type VisitSummary,
} from '../hooks/useVisit';

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

function getAccreditationInfo(statusUuid: string | null, t: TFunction): AccreditationInfo {
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
  accreditation: AccreditationInfo;
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
  const { visits, isLoading, isValidating, mutate } = useVisits();
  const [searchString, setSearchString] = useState('');
  const [showAllVisits, setShowAllVisits] = useState(false);
  const [generatingVisitUuid, setGeneratingVisitUuid] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkSelectionMode, setIsBulkSelectionMode] = useState(false);
  const [dataTableKey, setDataTableKey] = useState(0);

  const visitInfos = useMemo<Array<VisitRowInfo>>(
    () =>
      visits.map((visit, index) => {
        const financiadorUuid = getVisitFinanciadorUuid(visit);
        const accreditationStatusUuid = getVisitAccreditationStatusUuid(visit);

        return {
          visit,
          rowId: visit.uuid ?? `${visit.startDatetime ?? 'visit'}-${index}`,
          financiadorDisplay: getVisitFinanciadorDisplay(visit) ?? t('noFinanciador', 'Sin financiador'),
          isSis: isSisFinanciador(financiadorUuid, sisInsuranceConceptUuid, legacySisProductConceptUuids ?? []),
          accreditationStatusUuid,
          accreditation: getAccreditationInfo(accreditationStatusUuid, t),
        };
      }),
    [visits, sisInsuranceConceptUuid, legacySisProductConceptUuids, t],
  );

  const filteredData = useMemo(() => {
    const financiadorFiltered = showAllVisits ? visitInfos : visitInfos.filter((info) => info.isSis);

    if (!searchString) {
      return financiadorFiltered;
    }

    const search = searchString.toLowerCase();
    return financiadorFiltered.filter((info) =>
      [
        getPatientName(info.visit),
        getArea(info.visit),
        formatVisitDate(info.visit.startDatetime),
        info.financiadorDisplay,
        info.accreditation.label,
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [visitInfos, showAllVisits, searchString]);

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
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows = results.map((info) => ({
    id: info.rowId,
    patient: getPatientName(info.visit),
    area: getArea(info.visit),
    financiador: info.financiadorDisplay,
    acreditacion: info.accreditation.label,
    fechaCreacion: formatVisitDate(info.visit.startDatetime),
    actions: info.visit.uuid ?? '',
  }));

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

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
          subtitle: getFuaGenerationErrorMessage(error, t),
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

      if (!info?.isSis) {
        return;
      }

      if (info.accreditation.isVigente) {
        void handleGenerateFua(visitUuid);
        return;
      }

      const dispose = showModal('fua-accreditation-warning-modal', {
        accreditationStatusLabel: info.accreditation.label.toLocaleLowerCase(),
        patientName: getPatientName(info.visit),
        closeModal: () => dispose(),
        onConfirm: () => {
          // Auditoría del override (contingencia FUA papel): el FUA es
          // declaración jurada y un error de afiliación es causal de rechazo.
          console.warn('[esm-fua-app] Override de acreditación SIS no vigente al generar FUA', {
            visitUuid,
            accreditationStatusUuid: info.accreditationStatusUuid,
            accreditationStatus: info.accreditation.label,
            timestamp: new Date().toISOString(),
          });
          dispose();
          void handleGenerateFua(visitUuid);
        },
      });
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
          subtitle:
            error instanceof Error ? error.message : t('errorGeneratingFua', 'Ocurrio un error al generar el FUA'),
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

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  return (
    <div className={styles.tableContainer}>
      <DataTable key={dataTableKey} rows={rows} headers={headers} isSortable useZebraStyles size="sm">
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, getSelectionProps, selectedRows }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar>
              <TableToolbarContent className={styles.toolbarContent}>
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
                <Toggle
                  aria-label={t('showAllVisitsToggleLabel', 'Mostrar visitas de todos los financiadores')}
                  id="fua-show-all-visits-toggle"
                  labelA={t('showAllVisits', 'Mostrar todas')}
                  labelB={t('showAllVisits', 'Mostrar todas')}
                  onToggle={(toggled: boolean) => setShowAllVisits(toggled)}
                  size="sm"
                  toggled={showAllVisits}
                />
                <RequirePrivilege privilege={fuaManagePrivilege} hideUnauthorized>
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
                </RequirePrivilege>
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={handleRefresh} disabled={isValidating}>
                  {isValidating ? t('refreshing', 'Actualizando...') : t('refresh', 'Actualizar')}
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
                            disabled={isBulkGenerating || !rowInfo?.isSis}
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
                      {showAllVisits
                        ? t('noVisitsFound', 'No se encontraron visitas')
                        : t('noSisVisitsFound', 'No se encontraron visitas con financiador SIS')}
                    </p>
                    <p className={styles.emptyStateHelperText}>
                      {showAllVisits
                        ? t('checkFilters', 'Por favor revisa los filtros de arriba e intenta de nuevo')
                        : t(
                            'noSisVisitsHelper',
                            'Active «Mostrar todas» para ver las visitas de otros financiadores (sin generación de FUA)',
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
