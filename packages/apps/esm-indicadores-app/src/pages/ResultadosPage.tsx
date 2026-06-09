import {
  Button,
  InlineLoading,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
  ContentSwitcher,
  Switch,
} from '@carbon/react';
import React, { useMemo, useState } from 'react';

import PaginationBar from '../components/PaginationBar';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useCalcularAhora, useResultados, useResultadosSeries } from '../features/resultados/hooks';
import type { Granularity } from '../api/types';
import styles from '../indicators-dashboard.module.scss';

const ResultadosPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ indicador_id: '', periodo_inicio: '', periodo_fin: '' });
  const [granularity, setGranularity] = useState<Granularity>('mensual');
  const [viewMode, setViewMode] = useState<'historical' | 'series'>('series');
  const pageSize = 10;

  const { data: indicadoresData } = useIndicadores(1, 100);

  // Historical paginated results
  const {
    data: historicalData,
    isLoading: historicalLoading,
    error: historicalError,
  } = useResultados({
    page,
    size: pageSize,
    indicador_id: filters.indicador_id || undefined,
    periodo_inicio: filters.periodo_inicio || undefined,
    periodo_fin: filters.periodo_fin || undefined,
  });

  // Time-series rollup data
  const seriesParams = useMemo(
    () =>
      filters.indicador_id
        ? {
            indicador_id: filters.indicador_id,
            anio: new Date().getFullYear(),
            granularity,
          }
        : null,
    [filters.indicador_id, granularity],
  );

  const {
    data: seriesData,
    isLoading: seriesLoading,
    error: seriesError,
  } = useResultadosSeries(seriesParams);

  const { calcularAhora } = useCalcularAhora();

  const handleCalcular = async () => {
    try {
      const result = await calcularAhora();
      notifySuccess(`${result.calculados} indicadores calculados`);
    } catch (calculationError) {
      notifyError(calculationError instanceof Error ? calculationError.message : 'No se pudo calcular los indicadores');
    }
  };

  const isLoading = viewMode === 'historical' ? historicalLoading : seriesLoading;
  const error = viewMode === 'historical' ? historicalError : seriesError;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Resultados</h2>
          <p className={styles.subtitle}>Consulta resultados calculados y ejecutá el cálculo manual del lote.</p>
        </div>
        <Button onClick={handleCalcular}>Calcular ahora</Button>
      </div>

      <div className={styles.filtersPanel}>
        <Select
          id="resultado-indicador"
          labelText="Indicador"
          value={filters.indicador_id}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, indicador_id: event.target.value }));
          }}
        >
          <SelectItem value="" text="Todos" />
          {(indicadoresData?.items ?? []).map((indicador) => (
            <SelectItem key={indicador.id} value={indicador.id} text={indicador.nombre} />
          ))}
        </Select>
        <label className={styles.fieldGroup}>
          <span>Desde</span>
          <input
            className={styles.nativeInput}
            type="date"
            value={filters.periodo_inicio}
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, periodo_inicio: event.target.value }));
            }}
          />
        </label>
        <label className={styles.fieldGroup}>
          <span>Hasta</span>
          <input
            className={styles.nativeInput}
            type="date"
            value={filters.periodo_fin}
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, periodo_fin: event.target.value }));
            }}
          />
        </label>
      </div>

      {/* View mode switcher + granularity */}
      <div className={styles.headerActions} style={{ marginBottom: '0.75rem' }}>
        <ContentSwitcher
          onChange={({ name }) => setViewMode(name as 'historical' | 'series')}
          selectedIndex={viewMode === 'series' ? 0 : 1}
        >
          <Switch name="series" text="Series temporales" />
          <Switch name="historical" text="Histórico" />
        </ContentSwitcher>

        {viewMode === 'series' && filters.indicador_id ? (
          <Select
            id="granularity"
            labelText="Granularidad"
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
            size="sm"
          >
            <SelectItem value="mensual" text="Mensual" />
            <SelectItem value="trimestral" text="Trimestral" />
            <SelectItem value="semestral" text="Semestral" />
            <SelectItem value="anual" text="Anual" />
          </Select>
        ) : null}
      </div>

      {isLoading ? <InlineLoading description="Cargando resultados..." /> : null}
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

      {/* ── Series view ── */}
      {!isLoading && !error && viewMode === 'series' ? (
        filters.indicador_id ? (
          seriesData?.items.length ? (
            <div className={styles.tableSurface}>
              <Table aria-label={`Serie temporal — ${granularity}`}>
                <TableHead>
                  <TableRow>
                    <TableHeader>Periodo</TableHeader>
                    <TableHeader>Valor</TableHeader>
                    <TableHeader>Meses disponibles</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seriesData.items.map((item, idx) => (
                    <TableRow key={`${item.periodo_label}-${idx}`}>
                      <TableCell>{item.periodo_label}</TableCell>
                      <TableCell>{item.valor}</TableCell>
                      <TableCell>{item.meses_disponibles}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Tile className={styles.empty}>
              No hay datos de serie para el indicador y año seleccionados.
            </Tile>
          )
        ) : (
          <Tile className={styles.empty}>Seleccioná un indicador para ver su serie temporal.</Tile>
        )
      ) : null}

      {/* ── Historical paginated view ── */}
      {!isLoading && !error && viewMode === 'historical' ? (
        historicalData?.items.length ? (
          <>
            <div className={styles.tableSurface}>
              <Table aria-label="Resultados de indicadores">
                <TableHead>
                  <TableRow>
                    <TableHeader>Indicador</TableHeader>
                    <TableHeader>Versión</TableHeader>
                    <TableHeader>Periodo</TableHeader>
                    <TableHeader>Valor</TableHeader>
                    <TableHeader>Canónico</TableHeader>
                    <TableHeader>Calculado en</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historicalData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.indicador_nombre ?? '-'}</TableCell>
                      <TableCell>{item.indicador_version_num ?? '-'}</TableCell>
                      <TableCell>
                        {item.periodo_inicio} - {item.periodo_fin}
                      </TableCell>
                      <TableCell>{item.valor}</TableCell>
                      <TableCell>{item.es_canonico ? 'Sí' : 'No'}</TableCell>
                      <TableCell>{new Date(item.calculado_en).toLocaleString('es-PE')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              entityLabel="resultados"
              page={historicalData.page}
              pageSize={historicalData.size}
              total={historicalData.total}
              totalPages={historicalData.pages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <Tile className={styles.empty}>No hay resultados para los filtros seleccionados.</Tile>
        )
      ) : null}
    </div>
  );
};

export default ResultadosPage;
