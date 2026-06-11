import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InterconsultaOrder } from '../types';
import StatusChangeModal from './status-change.modal';

interface ReceiveInterconsultaModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
}

const ReceiveInterconsultaModal: React.FC<ReceiveInterconsultaModalProps> = ({ closeModal, order }) => {
  const { t } = useTranslation();
  return (
    <StatusChangeModal
      closeModal={closeModal}
      order={order}
      targetStatus="RECEIVED"
      title={t('receiveInterconsultaTitle', 'Recibir interconsulta')}
      body={t(
        'receiveInterconsultaConfirmation',
        'La interconsulta pasará al estado "Recibida / Pendiente" en el servicio destino. ¿Desea continuar?',
      )}
      confirmLabel={t('receiveInterconsulta', 'Recibir')}
      successTitle={t('interconsultaReceived', 'Interconsulta recibida')}
    />
  );
};

export default ReceiveInterconsultaModal;
