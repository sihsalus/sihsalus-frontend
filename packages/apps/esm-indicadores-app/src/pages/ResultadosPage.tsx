import {
  Button,
  ContentSwitcher,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  InlineNotification,
  Modal,
  NumberInput,
  Pagination,
  Select,
  SelectItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BatchCalcularNowResponse, Granularity, RecalcularAnioResponse } from '../api/types';
import MetaProgressCard from '../components/MetaProgressCard';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useCalcularAhora, useRecalcularAnio, useResultados, useResultadosSeries } from '../features/resultados/hooks';
import styles from '../indicators-dashboard.module.scss';

type SummaryState =
  | { kind: 'calcular'; result: BatchCalcularNowResponse }
  | { kind: 'recalcular'; result: RecalcularAnioResponse; anio: number }
  | null;

const currentYear = () => new Date().getFullYear();

const ResultadosPage: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ indicador_id: '', periodo_inicio: '', periodo_fin: '' });
  const [granularity, setGranularity] = useState<Granularity>('mensual');
  const [viewMode, setViewMode] = useState<'historical' | 'series'>('series');
  const [isCalcularRunning, setCalcularRunning] = useState(false);
  const [isRecalcularRunning, setRecalcularRunning] = useState(false);
  const [summary, setSummary] = useState<SummaryState>(null);
  const [isRecalcModalOpen, setRecalcModalOpen] = useState(false);
  const [recalcAnio, setRecalcAnio] = useState<number>(currentYear());
  const [recalcAnioError, setRecalcAnioError] = useState<string | null>(null);
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
            anio: currentYear(),
            granularity,
            include_meta: true,
          }
        : null,
    [filters.indicador_id, granularity],
  );

  const { data: seriesData, isLoading: seriesLoading, error: seriesError } = useResultadosSeries(seriesParams);

  const { calcularAhora } = useCalcularAhora();
  const { recalcularAnio } = useRecalcularAnio();

  const anyActionRunning = isCalcularRunning || isRecalcularRunning;

  const handleCalcular = async () => {
    setCalcularRunning(true);
    try {
      const result = await calcularAhora();
      setSummary({ kind: 'calcular', result });
      const failed = result.errores.length;
      // Classify as total failure when no items succeeded AND there is at
      // least one error AND the backend actually attempted at least one
      // item. This is safer than requiring `failed >= total` because the
      // backend's `total` may exceed the number of reported errors (e.g.
      // it represents attempted recalculations/months).
      const isTotalFailure = result.calculados === 0 && failed > 0 && result.total > 0;
      const baseMessage = t('indicatorsCalculated', '{{count}} indicadores calculados', {
        count: result.calculados,
      });
      if (isTotalFailure) {
        notifyError(`${baseMessage} (${t('recalcPartialErrors', '{{count}} con error', { count: failed })})`);
      } else if (failed > 0) {
        notifySuccess(`${baseMessage} (${t('recalcPartialErrors', '{{count}} con error', { count: failed })})`);
      } else {
        notifySuccess(baseMessage);
      }
    } catch (calculationError) {
      notifyError(calculationError instanceof Error ? calculationError.message : 'No se pudo calcular los indicadores');
    } finally {
      setCalcularRunning(false);
    }
  };

  const validateAnio = (value: number): string | null => {
    if (!Number.isInteger(value)) {
      return t('recalcAnioInvalid', 'El año debe ser un número entero.');
    }
    if (value > currentYear()) {
      return t('recalcAnioFuture', 'El año no puede ser futuro.');
    }
    if (value < 1900) {
      return t('recalcAnioTooOld', 'El año debe ser mayor o igual a 1900.');
    }
    return null;
  };

  const openRecalcularModal = () => {
    setRecalcAnio(currentYear());
    setRecalcAnioError(null);
    setRecalcModalOpen(true);
  };

  const handleRecalcularConfirm = async () => {
    const validationError = validateAnio(recalcAnio);
    if (validationError) {
      setRecalcAnioError(validationError);
      return;
    }
    setRecalcAnioError(null);
    setRecalcularRunning(true);
    try {
      const payload = filters.indicador_id
        ? { anio: recalcAnio, indicador_id: filters.indicador_id }
        : { anio: recalcAnio };
      const result = await recalcularAnio(payload);
      setSummary({ kind: 'recalcular', result, anio: recalcAnio });
      setRecalcModalOpen(false);
      const failed = result.errores.length;
      // Classify as total failure when no items were recalculated AND there
      // is at least one error AND the backend attempted at least one item.
      // Safer than `failed >= total` because the backend's `total` may be
      // greater than the reported `errores.length` for the annual batch
      // (e.g. total = attempted months/indicators combinations).
      const isTotalFailure = result.recalculados === 0 && failed > 0 && result.total > 0;
      const baseMessage = t('recalcDone', '{{count}} resultados recalculados para el año {{anio}}', {
        count: result.recalculados,
        anio: recalcAnio,
      });
      if (isTotalFailure) {
        notifyError(`${baseMessage} (${t('recalcPartialErrors', '{{count}} con error', { count: failed })})`);
      } else if (failed > 0) {
        notifySuccess(`${baseMessage} (${t('recalcPartialErrors', '{{count}} con error', { count: failed })})`);
      } else {
        notifySuccess(baseMessage);
      }
    } catch (recalcError) {
      notifyError(
        recalcError instanceof Error ? recalcError.message : t('recalcFailed', 'No se pudo recalcular el año'),
      );
    } finally {
      setRecalcularRunning(false);
    }
  };

  const renderSummary = () => {
    if (!summary) {
      return null;
    }
    if (summary.kind === 'calcular') {
      const { result } = summary;
      const hasErrors = result.errores.length > 0;
      // Mirrors handleCalcular: total failure means 0 successes with at
      // least one error on a non-empty batch. Do NOT require
      // `errores.length >= total` since `total` may exceed the reported
      // error count.
      const isTotalFailure = result.calculados === 0 && hasErrors && result.total > 0;
      const kind: 'success' | 'warning' | 'error' = isTotalFailure ? 'error' : hasErrors ? 'warning' : 'success';
      const subtitle = isTotalFailure
        ? t('recalcSummaryTotalError', '{{calculados}} de {{total}} calculados, todos con error', {
            calculados: result.calculados,
            total: result.total,
          })
        : hasErrors
          ? t('recalcSummaryPartial', '{{calculados}} de {{total}} calculados, {{errores}} con error', {
              calculados: result.calculados,
              total: result.total,
              errores: result.errores.length,
            })
          : t('recalcSummaryOk', '{{calculados}} de {{total}} calculados correctamente', {
              calculados: result.calculados,
              total: result.total,
            });
      return (
        <div className={styles.summaryBlock}>
          <InlineNotification
            kind={kind}
            lowContrast
            hideCloseButton={false}
            onCloseButtonClick={() => setSummary(null)}
            title={
              isTotalFailure
                ? t('recalcSummaryErrorTitle', 'Cálculo de lote con errores')
                : t('recalcSummaryTitle', 'Cálculo de lote finalizado')
            }
            subtitle={subtitle}
          />
          {hasErrors ? (
            <ul className={styles.failedList} aria-label={t('recalcSummaryFailedAria', 'Indicadores con error')}>
              {result.errores.map((err) => (
                <li key={err.indicador_id}>
                  <strong>{err.indicador_nombre}</strong>
                  {' ('}
                  {err.indicador_id}
                  {'): '}
                  {err.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    const { result, anio } = summary;
    const hasErrors = result.errores.length > 0;
    // Mirrors handleRecalcularConfirm: total failure means 0 recalculated
    // with at least one error on a non-empty batch. Do NOT require
    // `errores.length >= total` since the backend may report fewer
    // errors than the total attempted (months × indicators).
    const isTotalFailure = result.recalculados === 0 && hasErrors && result.total > 0;
    const kind: 'success' | 'warning' | 'error' = isTotalFailure ? 'error' : hasErrors ? 'warning' : 'success';
    const subtitle = isTotalFailure
      ? t('recalcSummaryRecalcTotalError', '{{anio}}: {{recalculados}} recalculados, todos con error', {
          anio,
          recalculados: result.recalculados,
        })
      : hasErrors
        ? t('recalcSummaryRecalcPartial', '{{anio}}: {{recalculados}} recalculados, {{errores}} con error', {
            anio,
            recalculados: result.recalculados,
            errores: result.errores.length,
          })
        : t('recalcSummaryRecalcOk', '{{anio}}: {{recalculados}} recalculados correctamente', {
            anio,
            recalculados: result.recalculados,
          });
    return (
      <div className={styles.summaryBlock}>
        <InlineNotification
          kind={kind}
          lowContrast
          hideCloseButton={false}
          onCloseButtonClick={() => setSummary(null)}
          title={
            isTotalFailure
              ? t('recalcSummaryRecalcErrorTitle', 'Recálculo anual con errores')
              : t('recalcSummaryRecalcTitle', 'Recálculo anual finalizado')
          }
          subtitle={subtitle}
        />
        {hasErrors ? (
          <ul className={styles.failedList} aria-label={t('recalcSummaryFailedAria', 'Indicadores con error')}>
            {result.errores.map((err) => (
              <li key={`${err.indicador_id}-${err.mes}`}>
                <strong>{err.indicador_nombre}</strong>
                {' ('}
                {err.indicador_id}
                {err.mes ? `, ${err.mes}` : ''}
                {'): '}
                {err.error}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  };

  const isLoading = viewMode === 'historical' ? historicalLoading : seriesLoading;
  const error = viewMode === 'historical' ? historicalError : seriesError;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>{t('results', 'Resultados')}</h2>
          <p className={styles.subtitle}>
            {t('resultsSubtitle', 'Consulta resultados calculados y ejecutá el cálculo manual del lote.')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button kind="tertiary" onClick={openRecalcularModal} disabled={anyActionRunning}>
            {t('recalculateYear', 'Recalcular año')}
          </Button>
          <Button onClick={handleCalcular} disabled={anyActionRunning}>
            {isCalcularRunning ? (
              <InlineLoading description={t('calculating', 'Calculando...')} />
            ) : (
              t('calculateNow', 'Calcular ahora')
            )}
          </Button>
        </div>
      </div>

      {renderSummary()}

      <div className={styles.filtersPanel}>
        <Select
          id="resultado-indicador"
          labelText={t('indicator', 'Indicador')}
          value={filters.indicador_id}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, indicador_id: event.target.value }));
          }}
        >
          <SelectItem value="" text={t('allIndicators', 'Todos los indicadores')} />
          {(indicadoresData?.items ?? []).map((indicador) => (
            <SelectItem key={indicador.id} value={indicador.id} text={indicador.nombre} />
          ))}
        </Select>
        <DatePicker datePickerType="single" dateFormat="Y-m-d"
          value={filters.periodo_inicio}
          onChange={(dates: Date[]) => {
            setPage(1);
            const d = dates[0];
            setFilters((current) => ({ ...current, periodo_inicio: d ? d.toISOString().slice(0, 10) : '' }));
          }}>
          <DatePickerInput
            id="resultado-desde"
            labelText={t('from', 'Desde')}
          />
        </DatePicker>
        <DatePicker datePickerType="single" dateFormat="Y-m-d"
          value={filters.periodo_fin}
          onChange={(dates: Date[]) => {
            setPage(1);
            const d = dates[0];
            setFilters((current) => ({ ...current, periodo_fin: d ? d.toISOString().slice(0, 10) : '' }));
          }}>
          <DatePickerInput
            id="resultado-hasta"
            labelText={t('to', 'Hasta')}
          />
        </DatePicker>
      </div>

      {/* View mode switcher + granularity */}
      <div className={`${styles.headerActions} ${styles.contentSwitcherRow}`}>
        <ContentSwitcher
          onChange={({ name }) => setViewMode(name as 'historical' | 'series')}
          selectedIndex={viewMode === 'series' ? 0 : 1}
        >
          <Switch name="series" text={t('timeSeries', 'Series temporales')} />
          <Switch name="historical" text={t('historical', 'Histórico')} />
        </ContentSwitcher>

        {viewMode === 'series' && filters.indicador_id ? (
          <Select
            id="granularity"
            labelText={t('granularity', 'Granularidad')}
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
            size="sm"
          >
            <SelectItem value="mensual" text={t('monthly', 'Mensual')} />
            <SelectItem value="trimestral" text={t('quarterly', 'Trimestral')} />
            <SelectItem value="semestral" text={t('semiannual', 'Semestral')} />
            <SelectItem value="anual" text={t('annual', 'Anual')} />
          </Select>
        ) : null}
      </div>

      {isLoading ? <InlineLoading description={t('loadingResults', 'Cargando resultados...')} /> : null}
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

      {/* ── Meta progress card (series view only) ── */}
      {!isLoading && !error && viewMode === 'series' && filters.indicador_id && seriesData?.items.length ? (
        (() => {
          // Find first row with a non-null meta
          const metaRow = seriesData.items.find((item) => item.meta != null);
          if (metaRow?.meta == null) {
            return null;
          }
          // Calculate accumulated value from all rows
          const accumulatedValue = seriesData.items.reduce((sum, item) => sum + (item.valor ?? 0), 0);
          return <MetaProgressCard meta={metaRow.meta} currentValue={accumulatedValue} />;
        })()
      ) : null}

      {/* ── Series view ── */}
      {!isLoading && !error && viewMode === 'series' ? (
        filters.indicador_id ? (
          seriesData?.items.length ? (
            <div className={styles.tableSurface}>
              <Table aria-label={`Serie temporal — ${granularity}`}>
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('period', 'Periodo')}</TableHeader>
                    <TableHeader>{t('value', 'Valor')}</TableHeader>
                    <TableHeader>{t('monthsAvailable', 'Meses disponibles')}</TableHeader>
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
              {t('noSeriesData', 'No hay datos de serie para el indicador y año seleccionados.')}
            </Tile>
          )
        ) : (
          <Tile className={styles.empty}>
            {t('selectIndicatorForSeries', 'Seleccioná un indicador para ver su serie temporal.')}
          </Tile>
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
                    <TableHeader>{t('indicator', 'Indicador')}</TableHeader>
                    <TableHeader>{t('version', 'Versión')}</TableHeader>
                    <TableHeader>{t('period', 'Periodo')}</TableHeader>
                    <TableHeader>{t('value', 'Valor')}</TableHeader>
                    <TableHeader>{t('canonical', 'Canónico')}</TableHeader>
                    <TableHeader>{t('calculatedAtFull', 'Calculado en')}</TableHeader>
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
                      <TableCell>{item.es_canonico ? t('yes', 'Sí') : t('no', 'No')}</TableCell>
                      <TableCell>{new Date(item.calculado_en).toLocaleString('es-PE')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={historicalData.page}
              pageSize={historicalData.size}
              pageSizes={[10]}
              totalItems={historicalData.total}
              onChange={({ page }: { page: number }) => setPage(page)}
              size="sm"
            />
          </>
        ) : (
          <Tile className={styles.empty}>{t('noResults', 'No hay resultados para los filtros seleccionados.')}</Tile>
        )
      ) : null}

      <Modal
        open={isRecalcModalOpen}
        modalHeading={t('recalculateYear', 'Recalcular año')}
        primaryButtonText={
          isRecalcularRunning ? (
            <InlineLoading description={t('recalculating', 'Recalculando...')} />
          ) : (
            t('confirm', 'Confirmar')
          )
        }
        primaryButtonDisabled={isRecalcularRunning}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => {
          if (!isRecalcularRunning) {
            setRecalcModalOpen(false);
          }
        }}
        onRequestSubmit={handleRecalcularConfirm}
      >
        <p className={styles.modalBodyText}>
          {t(
            'recalcModalBody',
            'Esta acción recalcula todos los meses del año seleccionado para los indicadores activos. Si hay un indicador seleccionado en los filtros, sólo se recalcula ese indicador.',
          )}
        </p>
        <NumberInput
          id="recalc-anio"
          label={t('year', 'Año')}
          min={1900}
          max={currentYear()}
          value={recalcAnio}
          onChange={(_event, { value }) => {
            const numeric = typeof value === 'number' ? value : Number(value);
            setRecalcAnio(numeric);
            if (recalcAnioError) {
              setRecalcAnioError(null);
            }
          }}
          invalid={Boolean(recalcAnioError)}
          invalidText={recalcAnioError ?? undefined}
          allowEmpty={false}
        />
        {filters.indicador_id ? (
          <p className={styles.scopeHint}>
            {t('recalcModalScopeHint', 'Se recalculará solo el indicador seleccionado: {{nombre}}.', {
              nombre: indicadoresData?.items.find((i) => i.id === filters.indicador_id)?.nombre ?? filters.indicador_id,
            })}
          </p>
        ) : null}
      </Modal>
    </div>
  );
};

export default ResultadosPage;
