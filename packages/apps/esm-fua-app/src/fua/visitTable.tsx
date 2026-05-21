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
  Tile,
} from '@carbon/react';
import { Add, Renew } from '@carbon/react/icons';
import { showSnackbar, usePagination } from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { generateFuaFromVisit, generateFuasFromVisits, useVisits, type VisitSummary } from '../hooks/useVisit';

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

const VisitTable: React.FC = () => {
  const { t } = useTranslation();
  const { visits, isLoading, isValidating, mutate } = useVisits();
  const [searchString, setSearchString] = useState('');
  const [generatingVisitUuid, setGeneratingVisitUuid] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkSelectionMode, setIsBulkSelectionMode] = useState(false);
  const [dataTableKey, setDataTableKey] = useState(0);

  const filteredData = useMemo(() => {
    if (!searchString) {
      return visits;
    }

    const search = searchString.toLowerCase();
    return visits.filter((visit) =>
      [getPatientName(visit), getArea(visit), formatVisitDate(visit.startDatetime)].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }, [visits, searchString]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { results, goTo, currentPage } = usePagination(filteredData, currentPageSize);

  const headers = [
    { key: 'patient', header: t('patient', 'Paciente') },
    { key: 'area', header: t('area', 'Area') },
    { key: 'fechaCreacion', header: t('creationDate', 'Fecha de Creación') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows = results.map((visit, index) => ({
    id: visit.uuid ?? `${visit.startDatetime ?? 'visit'}-${index}`,
    patient: getPatientName(visit),
    area: getArea(visit),
    fechaCreacion: formatVisitDate(visit.startDatetime),
    actions: visit.uuid ?? '',
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
          title: t('error', 'Error'),
          subtitle:
            error instanceof Error ? error.message : t('errorGeneratingFua', 'Ocurrio un error al generar el FUA'),
        });
      } finally {
        setGeneratingVisitUuid(null);
      }
    },
    [mutate, t],
  );

  const handleBulkGenerateFuas = useCallback(
    async (visitUuids: Array<string>) => {
      const selectedVisitUuids = visitUuids.filter(Boolean);

      if (selectedVisitUuids.length === 0) {
        return;
      }

      setIsBulkGenerating(true);

      try {
        const { successful, failed } = await generateFuasFromVisits(selectedVisitUuids);

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
    [mutate, t],
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
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={handleRefresh} disabled={isValidating}>
                  {isValidating ? t('refreshing', 'Actualizando...') : t('refresh', 'Actualizar')}
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} className={styles.table} aria-label={t('visits', 'Visitas')}>
              <TableHead>
                <TableRow>
                  {isBulkSelectionMode ? <TableSelectAll {...getSelectionProps()} disabled={isBulkGenerating} /> : null}
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })} className={styles.tableHeader}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {isBulkSelectionMode ? (
                      <TableSelectRow {...getSelectionProps({ row })} disabled={isBulkGenerating} />
                    ) : null}
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id} className={styles.tableCell}>
                        {cell.info.header === 'actions' ? (
                          <Button
                            kind="ghost"
                            size="sm"
                            renderIcon={Add}
                            iconDescription={t('generateFua', 'Generar FUA')}
                            disabled={!cell.value || generatingVisitUuid === cell.value || isBulkGenerating}
                            onClick={() => handleGenerateFua(cell.value)}
                          >
                            {generatingVisitUuid === cell.value
                              ? t('generatingFua', 'Generando FUA...')
                              : t('generateFua', 'Generar FUA')}
                          </Button>
                        ) : (
                          cell.value
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noVisitsFound', 'No se encontraron visitas')}</p>
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
          page={currentPage}
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
