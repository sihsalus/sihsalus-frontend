import {
  Button,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { ConfigurableLink, formatDatetime, parseDate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { deriveStatus, useInterconsultaResponse } from '../interconsultas.resource';
import type { InterconsultaOrder } from '../types';
import { getStatusDisplay, getStatusTagType, getUrgencyDisplay } from '../utils/status';

interface InterconsultaDetailModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
}

/**
 * Vista detalle de la interconsulta. El paciente, profesional y location se
 * muestran a partir de las referencias de la orden (display) y se enlaza al
 * chart para el resto de datos clínicos — no se duplica información.
 */
const InterconsultaDetailModal: React.FC<InterconsultaDetailModalProps> = ({ closeModal, order }) => {
  const { t } = useTranslation();
  const status = deriveStatus(order);
  const { responseObs, isLoading: isLoadingResponse } = useInterconsultaResponse(order);

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: t('patient', 'Paciente'),
      value: (
        <ConfigurableLink to={`${globalThis.spaBase}/patient/${order.patient?.uuid}/chart`}>
          {order.patient?.display}
        </ConfigurableLink>
      ),
    },
    { label: t('orderNumber', 'N° orden'), value: order.orderNumber },
    {
      label: t('status', 'Estado'),
      value: <Tag type={getStatusTagType(status)}>{getStatusDisplay(status, t)}</Tag>,
    },
    { label: t('destinationService', 'Servicio destino'), value: order.concept?.display ?? '—' },
    { label: t('priority', 'Prioridad'), value: getUrgencyDisplay(order.urgency, t) },
    {
      label: t('requestDate', 'Fecha solicitud'),
      value: order.dateActivated ? formatDatetime(parseDate(order.dateActivated)) : '—',
    },
    ...(order.scheduledDate
      ? [
          {
            label: t('scheduledDate', 'Fecha programada'),
            value: formatDatetime(parseDate(order.scheduledDate)),
          },
        ]
      : []),
    { label: t('requestedBy', 'Solicitante'), value: order.orderer?.display ?? '—' },
    { label: t('originLocation', 'Origin UPSS'), value: order.encounter?.location?.display ?? '—' },
    { label: t('reasonForRequest', 'Motivo'), value: order.instructions || '—' },
    ...(order.fulfillerComment
      ? [
          {
            label:
              status === 'DECLINED'
                ? t('rejectionReason', 'Motivo del rechazo')
                : t('managementNote', 'Nota de gestión'),
            value: order.fulfillerComment,
          },
        ]
      : []),
    ...(order.dateStopped
      ? [
          {
            label: t('cancelledDate', 'Fecha de cancelación'),
            value: formatDatetime(parseDate(order.dateStopped)),
          },
        ]
      : []),
  ];

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('interconsultaDetailTitle', 'Detalle de interconsulta')} />
      <ModalBody>
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            {rows.map((row) => (
              <StructuredListRow key={row.label}>
                <StructuredListCell noWrap>
                  <strong>{row.label}</strong>
                </StructuredListCell>
                <StructuredListCell>{row.value}</StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>

        {isLoadingResponse && <InlineLoading description={t('loadingResponse', 'Cargando respuesta...')} />}
        {!isLoadingResponse && responseObs.length > 0 && (
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
              {responseObs.map((obs) => (
                <StructuredListRow key={obs.uuid}>
                  <StructuredListCell noWrap>
                    <strong>{obs.concept?.display}</strong>
                    <br />
                    <span>{formatDatetime(parseDate(obs.obsDatetime))}</span>
                    {obs.auditInfo?.creator?.display && (
                      <>
                        <br />
                        <span>{obs.auditInfo.creator.display}</span>
                      </>
                    )}
                  </StructuredListCell>
                  <StructuredListCell className="responseText">
                    {typeof obs.value === 'string' ? obs.value : (obs.value?.display ?? '—')}
                  </StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('close', 'Cerrar')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default InterconsultaDetailModal;
