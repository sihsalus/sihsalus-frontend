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
} from '@carbon/react';
import React, { useState } from 'react';

import PaginationBar from '../components/PaginationBar';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useCalcularAhora, useResultados } from '../features/resultados/hooks';
import styles from '../indicators-dashboard.module.scss';

const ResultadosPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ indicador_id: '', periodo_inicio: '', periodo_fin: '' });
  const pageSize = 10;

  const { data: indicadoresData } = useIndicadores(1, 100);
  const { data, isLoading, error } = useResultados({
    page,
    size: pageSize,
    indicador_id: filters.indicador_id || undefined,
    periodo_inicio: filters.periodo_inicio || undefined,
    periodo_fin: filters.periodo_fin || undefined,
  });
  const { calcularAhora } = useCalcularAhora();

  const handleCalcular = async () => {
    try {
      const result = await calcularAhora();
      notifySuccess(`${result.calculados} indicadores calculados`);
    } catch (calculationError) {
      notifyError(calculationError instanceof Error ? calculationError.message : 'No se pudo calcular los indicadores');
    }
  };

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

      {isLoading ? <InlineLoading description="Cargando resultados..." /> : null}
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

      {!isLoading && !error ? (
        data?.items.length ? (
          <>
            <div className={styles.tableSurface}>
              <Table aria-label="Resultados de indicadores">
                <TableHead>
                  <TableRow>
                    <TableHeader>Indicador</TableHeader>
                    <TableHeader>Versión</TableHeader>
                    <TableHeader>Periodo</TableHeader>
                    <TableHeader>Valor</TableHeader>
                    <TableHeader>Calculado en</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.indicador_nombre ?? '-'}</TableCell>
                      <TableCell>{item.indicador_version_num ?? '-'}</TableCell>
                      <TableCell>
                        {item.periodo_inicio} - {item.periodo_fin}
                      </TableCell>
                      <TableCell>{item.valor}</TableCell>
                      <TableCell>{new Date(item.calculado_en).toLocaleString('es-PE')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              entityLabel="resultados"
              page={data.page}
              pageSize={data.size}
              total={data.total}
              totalPages={data.pages}
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
