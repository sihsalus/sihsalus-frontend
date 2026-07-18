import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './fua-modals.scss';

interface AccreditationWarningModalProps {
  closeModal: () => void;
  /** Estado de acreditación en minúsculas para intercalar en el mensaje (p. ej. «no vigente»). */
  accreditationStatusLabel: string;
  patientName?: string;
  onConfirm: () => void;
}

/**
 * Confirmación explícita antes de generar un FUA cuya acreditación SIS no está
 * vigente (declaración jurada: un error de afiliación es causal de rechazo de
 * pago). El override existe como contingencia (FUA papel) y queda auditado con
 * un console.warn estructurado en el llamador.
 */
const AccreditationWarningModal: React.FC<AccreditationWarningModalProps> = ({
  closeModal,
  accreditationStatusLabel,
  patientName,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('accreditationWarningTitle', 'Acreditación SIS no vigente')} />
      <ModalBody>
        <div className={styles.modalContent}>
          {patientName ? (
            <p>
              <strong>{t('patient', 'Paciente')}:</strong> {patientName}
            </p>
          ) : null}
          <div className={styles.warningMessage}>
            <p>
              {t(
                'accreditationWarningBody',
                'La acreditación SIS de esta visita está {{estado}}. El FUA es declaración jurada y un error de afiliación es causal de rechazo de pago. ¿Generar de todos modos?',
                { estado: accreditationStatusLabel },
              )}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind="danger" onClick={onConfirm}>
          {t('generateFuaAnyway', 'Generar de todos modos')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default AccreditationWarningModal;
