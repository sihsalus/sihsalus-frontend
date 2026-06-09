import {
  Accordion,
  AccordionItem,
  Button,
  DataTableSkeleton,
  InlineLoading,
  InlineNotification,
  Tag,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, formatDatetime, parseDate } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { deriveStatus, useInterconsultaResponse, usePatientInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder } from '../types';
import { getStatusDisplay, getStatusTagType, getUrgencyDisplay } from '../utils/status';
import styles from './interconsultas-chart-widget.scss';

interface InterconsultasChartWidgetProps {
  patientUuid: string;
}

/**
 * Resumen de interconsultas en el chart del paciente: solicitudes con su
 * estado y, al expandir, motivo y respuesta. Los datos clínicos del paciente
 * no se repiten — ya están en el chart que envuelve este widget.
 */
const InterconsultasChartWidget: React.FC<InterconsultasChartWidgetProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { interconsultas, isLoading, error } = usePatientInterconsultas(patientUuid);
  const launchRequestWorkspace = useLaunchWorkspaceRequiringVisit('request-interconsulta-workspace');

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} rowCount={3} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <h4 className={styles.widgetTitle}>{t('interconsultas', 'Interconsultas')}</h4>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => launchRequestWorkspace()}>
          {t('requestInterconsulta', 'Solicitar interconsulta')}
        </Button>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          lowContrast
          title={t('error', 'Error')}
          subtitle={t('errorLoadingInterconsultas', 'No se pudieron cargar las interconsultas.')}
        />
      )}

      {!error && interconsultas.length === 0 && (
        <Tile className={styles.emptyState}>
          <p>{t('noPatientInterconsultas', 'El paciente no tiene interconsultas registradas.')}</p>
        </Tile>
      )}

      {interconsultas.length > 0 && (
        <Accordion>
          {interconsultas.map((order) => (
            <InterconsultaAccordionItem key={order.uuid} order={order} />
          ))}
        </Accordion>
      )}
    </div>
  );
};

function InterconsultaAccordionItem({ order }: { order: InterconsultaOrder }) {
  const { t } = useTranslation();
  const status = deriveStatus(order);
  const { responseObs, isLoading } = useInterconsultaResponse(order);

  return (
    <AccordionItem
      title={
        <span className={styles.accordionTitle}>
          {order.dateActivated ? formatDate(parseDate(order.dateActivated)) : '—'}
          {' — '}
          {order.concept?.display}
          {'  '}
          <Tag type={getStatusTagType(status)} size="sm">
            {getStatusDisplay(status, t)}
          </Tag>
        </span>
      }
    >
      <dl className={styles.detailList}>
        <dt>{t('priority', 'Prioridad')}</dt>
        <dd>{getUrgencyDisplay(order.urgency, t)}</dd>
        <dt>{t('requestedBy', 'Solicitante')}</dt>
        <dd>{order.orderer?.display ?? '—'}</dd>
        <dt>{t('reasonForRequest', 'Motivo')}</dt>
        <dd>{order.instructions || '—'}</dd>
        {order.fulfillerComment && status === 'DECLINED' && (
          <>
            <dt>{t('rejectionReason', 'Motivo del rechazo')}</dt>
            <dd>{order.fulfillerComment}</dd>
          </>
        )}
      </dl>
      {isLoading && <InlineLoading description={t('loadingResponse', 'Cargando respuesta...')} />}
      {!isLoading && responseObs.length > 0 && (
        <dl className={styles.detailList}>
          {responseObs.map((obs) => (
            <React.Fragment key={obs.uuid}>
              <dt>
                {obs.concept?.display} ({formatDatetime(parseDate(obs.obsDatetime))})
              </dt>
              <dd className={styles.responseText}>
                {typeof obs.value === 'string' ? obs.value : (obs.value?.display ?? '—')}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </AccordionItem>
  );
}

export default InterconsultasChartWidget;
