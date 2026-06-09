import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar, useAbortController } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setInterconsultaFulfillerStatus, useInvalidateInterconsultas } from '../interconsultas.resource';
import type { FulfillerStatus, InterconsultaOrder } from '../types';

interface StatusChangeModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
  targetStatus: FulfillerStatus;
  title: string;
  body: string;
  confirmLabel: string;
  successTitle: string;
}

/**
 * Modal genérico de confirmación para transiciones simples de estado
 * (Recibir → RECEIVED, Atender → IN_PROGRESS).
 */
const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  closeModal,
  order,
  targetStatus,
  title,
  body,
  confirmLabel,
  successTitle,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const invalidateInterconsultas = useInvalidateInterconsultas();

  const handleConfirm = () => {
    setIsSubmitting(true);
    setInterconsultaFulfillerStatus(order.uuid, targetStatus, undefined, abortController).then(
      () => {
        invalidateInterconsultas();
        setIsSubmitting(false);
        closeModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: successTitle,
          subtitle: `${order.concept?.display ?? ''} — ${order.patient?.display ?? ''}`,
        });
      },
      (error: Error) => {
        setIsSubmitting(false);
        showSnackbar({
          kind: 'error',
          title: t('errorUpdatingInterconsulta', 'Error al actualizar la interconsulta'),
          subtitle: error?.message,
        });
      },
    );
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={title} />
      <ModalBody>
        <p>{body}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button type="submit" onClick={handleConfirm} disabled={isSubmitting}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default StatusChangeModal;
