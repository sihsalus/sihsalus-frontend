import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { markPatientAlive } from '../data.resource';

interface MarkPatientAliveProps {
  closeModal: () => void;
  patientUuid: string;
}

const MarkPatientAlive: React.FC<MarkPatientAliveProps> = ({ closeModal, patientUuid }) => {
  const { t } = useTranslation();

  const handleSubmit = useCallback(() => {
    closeModal();

    markPatientAlive(patientUuid)
      .then(() => {
        closeModal();
        showSnackbar({
          title: t('markAliveSuccessfully', 'Patient marked alive succesfully'),
        });
        globalThis.location.reload();
      })
      .catch((error) => {
        showSnackbar({
          title: t('errorMarkingPatientAlive', 'Error marking patient alive'),
          kind: 'error',
          isLowContrast: false,
          subtitle: getUserFacingErrorMessage(
            error,
            t('errorMarkingPatientAliveMessage', 'No se pudo actualizar el estado vital. Intente nuevamente.'),
            { logContext: 'Mark patient alive' },
          ),
        });
      });
  }, [closeModal, patientUuid, t]);

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('markPatientAlive', 'Mark patient alive')} />
      <ModalBody>{t('markPatientAliveConfirmation', 'Are you sure you want to mark this patient alive?')}</ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('no', 'No')}
        </Button>
        <Button onClick={handleSubmit}>{t('yes', 'Yes')}</Button>
      </ModalFooter>
    </div>
  );
};

export default MarkPatientAlive;
