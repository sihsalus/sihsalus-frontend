import { Tag, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import type { BloodBankApi } from '../../api';
import { useApiData } from '../../api/use-api-data';
import { moduleName } from '../../constants';
import { DataErrorState, EmptyState } from '../../shared/data-state.component';
import { LoadingState } from '../../shared/loading-state.component';
import { PageHeader } from '../../shared/page-header.component';
import styles from '../../styles/app.scss';
import type { WorkItemStatus } from '../../types/blood-bank.types';

const statusType: Record<WorkItemStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  Pendiente: 'gray',
  'En proceso': 'blue',
  Completado: 'green',
  Alerta: 'red',
};

export function DashboardPage({ api }: { api: BloodBankApi }) {
  const { t } = useTranslation(moduleName);
  const { data, error, isLoading } = useApiData(api.getDashboard);
  const statusLabels: Record<WorkItemStatus, string> = {
    Pendiente: t('statusPending', 'Pendiente'),
    'En proceso': t('statusInProgress', 'En proceso'),
    Completado: t('statusCompleted', 'Completado'),
    Alerta: t('statusAlert', 'Alerta'),
  };

  if (isLoading) return <LoadingState />;
  if (error || !data) return <DataErrorState />;

  return (
    <div className={styles.page}>
      <PageHeader description={t('dashboardDescription', 'Resumen operativo y actividades que requieren atención.')} title={t('home', 'Inicio')} />
      <section className={styles.metricGrid} aria-label={t('operationalSummary', 'Resumen operativo')}>
        {data.metrics.map((metric) => (
          <Tile className={styles.metric} key={metric.id}>
            <span>{t(metric.labelKey, metric.defaultLabel)}</span>
            <strong>{metric.value}</strong>
          </Tile>
        ))}
      </section>
      <section className={styles.panel}>
        <h2>{t('operationalWorklist', 'Bandeja operativa')}</h2>
        {data.workItems.length === 0 ? (
          <EmptyState message={t('emptyWorklist', 'No hay actividades pendientes.')} />
        ) : <div className={styles.workList}>
          {data.workItems.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.id}</strong>
                <span>{item.section} · {item.description}</span>
              </div>
              <Tag type={statusType[item.status]}>{statusLabels[item.status]}</Tag>
            </article>
          ))}
        </div>}
      </section>
    </div>
  );
}
