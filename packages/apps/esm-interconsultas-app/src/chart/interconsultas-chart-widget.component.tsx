import { Accordion, AccordionItem, Button, DataTableSkeleton, InlineLoading, Tag } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, formatDatetime, parseDate } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
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
  const headerTitle = t('interconsultas', 'Interconsultas');
  const displayText = t('interconsultationsLower', 'interconsultations');

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} rowCount={3} zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!interconsultas.length) {
    return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchRequestWorkspace} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Button
          kind="ghost"
          renderIcon={Add}
          iconDescription={t('requestInterconsulta', 'Solicitar interconsulta')}
          onClick={() => launchRequestWorkspace()}
        >
          {t('requestInterconsulta', 'Solicitar interconsulta')}
        </Button>
      </CardHeader>
      <Accordion>
        {interconsultas.map((order) => (
          <InterconsultaAccordionItem key={order.uuid} order={order} />
        ))}
      </Accordion>
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
