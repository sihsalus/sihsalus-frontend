import { InlineLoading, Tile } from '@carbon/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { GetSeriesParams, Indicador } from '../api/types';
import { useResultadosSeries } from '../features/resultados/hooks';
import { type MetaStatus, calculateProgress, getMetaStatus } from '../features/resultados/progress';
import { currentYear } from '../features/resultados/years';
import MetaProgressBar from './MetaProgressBar';
import styles from '../indicators-dashboard.module.scss';

interface IndicadorResumenCardProps {
  indicador: Indicador;
  anio: number;
}

const STATUS_CLASS: Record<MetaStatus, string> = {
  low: styles.summaryStatusLow,
  medium: styles.summaryStatusMedium,
  high: styles.summaryStatusHigh,
};

const STATUS_LABEL: Record<MetaStatus, { key: string; defaultValue: string }> = {
  low: { key: 'progressStatusLow', defaultValue: 'Bajo' },
  medium: { key: 'progressStatusMedium', defaultValue: 'Medio' },
  high: { key: 'progressStatusHigh', defaultValue: 'Alto' },
};

const IndicadorResumenCard: React.FC<IndicadorResumenCardProps> = ({ indicador, anio }) => {
  const { t } = useTranslation();

  const params = useMemo<GetSeriesParams>(
    () => ({ indicador_id: indicador.id, anio, granularity: 'mensual', include_meta: true }),
    [indicador.id, anio],
  );

  const { data, error, isLoading } = useResultadosSeries(params);

  const summary = useMemo(() => {
    const items = data?.items ?? [];
    if (items.length === 0) {
      return null;
    }
    const metaRow = items.find((item) => item.meta != null && Number.isFinite(item.meta));
    const meta = metaRow?.meta ?? null;
    const accumulated = items.reduce((sum, item) => sum + (Number.isFinite(item.valor) ? item.valor : 0), 0);
    const last = items[items.length - 1];
    return {
      meta,
      accumulated,
      periodos: items.length,
      ultimoPeriodo: last?.periodo_label ?? null,
    };
  }, [data]);

  const expectedMonths = anio === currentYear() ? new Date().getMonth() + 1 : 12;
  const hasTarget = summary?.meta != null && Number.isFinite(summary.meta) && summary.meta > 0;
  const percentage = hasTarget ? calculateProgress(summary.meta as number, summary.accumulated) : 0;
  const status = hasTarget ? getMetaStatus(percentage) : null;

  const statusLabel = status ? t(STATUS_LABEL[status].key, STATUS_LABEL[status].defaultValue) : null;

  return (
    <Tile className={styles.summaryCard}>
      <Link
        to={`/resultados?indicador=${encodeURIComponent(String(indicador.id))}&anio=${anio}`}
        className={`${styles.inlineLink} ${styles.summaryCardTitle}`}
      >
        {indicador.nombre}
      </Link>

      {isLoading && !summary ? (
        <InlineLoading description={t('loadingIndicator', 'Cargando indicador...')} />
      ) : error && !summary ? (
        <p className={styles.mutedText}>{t('panelCardUnavailable', 'No disponible')}</p>
      ) : !summary ? (
        <p className={styles.mutedText}>{t('panelCardNoData', 'Sin datos para este año.')}</p>
      ) : (
        <>
          <div className={styles.summaryCardValues}>
            <span className={styles.summaryCardValue}>{summary.accumulated}</span>
            <span className={styles.summaryCardMeta}>
              {hasTarget ? `/ ${summary.meta}` : t('noTarget', 'Sin meta')}
            </span>
          </div>

          {hasTarget ? (
            <>
              <MetaProgressBar
                percentage={percentage}
                status={status ?? undefined}
                ariaLabel={t('panelProgressBarAria', '{{name}}: {{percentage}}% de la meta anual', {
                  name: indicador.nombre,
                  percentage,
                })}
              />
              <div className={styles.summaryCardFooter}>
                <span className={styles.summaryStatus}>
                  <span className={`${styles.summaryStatusDot} ${STATUS_CLASS[status as MetaStatus]}`} aria-hidden />
                  {statusLabel}
                </span>
                <span className={styles.summaryCardPercent}>{percentage}%</span>
              </div>
            </>
          ) : null}

          <p className={styles.summaryCardCoverage}>
            {t('panelCoverage', '{{count}} de {{total}} meses calculados', {
              count: summary.periodos,
              total: expectedMonths,
            })}
            {summary.ultimoPeriodo
              ? ` · ${t('panelLastPeriod', 'Último: {{period}}', { period: summary.ultimoPeriodo })}`
              : ''}
          </p>
        </>
      )}
    </Tile>
  );
};

export default IndicadorResumenCard;
