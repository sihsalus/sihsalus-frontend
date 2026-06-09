import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InterconsultaOrder } from '../types';
import StatusChangeModal from './status-change.modal';

interface PickupInterconsultaModalProps {
  closeModal: () => void;
  order: InterconsultaOrder;
}

const PickupInterconsultaModal: React.FC<PickupInterconsultaModalProps> = ({ closeModal, order }) => {
  const { t } = useTranslation();
  return (
    <StatusChangeModal
      closeModal={closeModal}
      order={order}
      targetStatus="IN_PROGRESS"
      title={t('pickupInterconsultaTitle', 'Atender interconsulta')}
      body={t(
        'pickupInterconsultaConfirmation',
        'La interconsulta pasará al estado "En atención" y quedará asignada a usted como profesional que la atiende. ¿Desea continuar?',
      )}
      confirmLabel={t('pickupInterconsulta', 'Atender (recoger)')}
      successTitle={t('interconsultaPickedUp', 'Interconsulta en atención')}
    />
  );
};

export default PickupInterconsultaModal;
