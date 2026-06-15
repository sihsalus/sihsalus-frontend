import { Button, ModalBody, ModalFooter, ModalHeader, TextArea } from '@carbon/react';
import { showSnackbar, useAbortController } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setInterconsultaFulfillerStatus, useInvalidateInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder } from '../types';

interface RejectInterconsultaModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
}

const RejectInterconsultaModal: React.FC<RejectInterconsultaModalProps> = ({ closeModal, order }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const invalidateInterconsultas = useInvalidateInterconsultas();

  const handleReject = () => {
    setIsSubmitting(true);
    setInterconsultaFulfillerStatus(order.uuid, 'DECLINED', reason.trim(), abortController).then(
      () => {
        invalidateInterconsultas();
        setIsSubmitting(false);
        closeModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('interconsultaRejected', 'Interconsulta rechazada'),
          subtitle: `${order.concept?.display ?? ''} — ${order.patient?.display ?? ''}`,
        });
      },
      (error: Error) => {
        setIsSubmitting(false);
        showSnackbar({
          kind: 'error',
          title: t('errorRejectingInterconsulta', 'Error al rechazar la interconsulta'),
          subtitle: error?.message,
        });
      },
    );
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('rejectInterconsultaTitle', 'Rechazar interconsulta')} />
      <ModalBody hasForm>
        <p>
          {t(
            'rejectInterconsultaConfirmation',
            'Indique el motivo del rechazo. La interconsulta pasará al estado "Rechazada" y el motivo quedará registrado para auditoría.',
          )}
        </p>
        <TextArea
          id="reject-reason"
          labelText={t('rejectionReason', 'Motivo del rechazo')}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)}
          rows={3}
          value={reason}
        />
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind="danger" type="submit" onClick={handleReject} disabled={isSubmitting || !reason.trim()}>
          {t('rejectInterconsulta', 'Rechazar')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default RejectInterconsultaModal;
