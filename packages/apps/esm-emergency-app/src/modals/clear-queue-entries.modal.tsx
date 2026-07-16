import { Button, ButtonSkeleton, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type EmergencyQueueEntry,
  endEmergencyQueueEntry,
  useMutateEmergencyQueueEntries,
} from '../resources/emergency.resource';

interface ClearQueueEntriesModalProps {
  queueEntries: Array<EmergencyQueueEntry>;
  closeModal: () => void;
}

const ClearQueueEntriesModal: React.FC<ClearQueueEntriesModalProps> = ({ queueEntries, closeModal }) => {
  const { t } = useTranslation();
  const { mutateEmergencyQueueEntries } = useMutateEmergencyQueueEntries();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClearAll = useCallback(async () => {
    setIsSubmitting(true);
    // allSettled: one failure must not hide that the other entries were already ended
    const results = await Promise.allSettled(queueEntries.map((entry) => endEmergencyQueueEntry(entry.uuid)));
    const failedCount = results.filter((result) => result.status === 'rejected').length;

    void mutateEmergencyQueueEntries();

    if (failedCount === 0) {
      showSnackbar({
        isLowContrast: true,
        title: t('clearQueue', 'Limpiar cola'),
        kind: 'success',
        subtitle: t('queuesClearedSuccessfully', 'Cola limpiada exitosamente'),
      });
    } else {
      showSnackbar({
        title: t('errorClearingQueues', 'Error al limpiar cola'),
        kind: failedCount === queueEntries.length ? 'error' : 'warning',
        subtitle: t(
          'queuesPartiallyCleared',
          'Se finalizaron {{succeeded}} de {{total}} registros; {{failed}} fallaron. Intente nuevamente.',
          { succeeded: queueEntries.length - failedCount, failed: failedCount, total: queueEntries.length },
        ),
      });
    }
    closeModal();
  }, [queueEntries, closeModal, mutateEmergencyQueueEntries, t]);

  return (
    <>
      <ModalHeader
        closeModal={closeModal}
        label={t('emergencyQueue', 'Cola de emergencias')}
        title={t('clearAllQueueEntries', 'Limpiar todos los registros de la cola?')}
      />
      <ModalBody>
        <p>
          {t(
            'clearAllQueueEntriesWarningMessage',
            'Esto eliminará a todos los pacientes ({{count}}) de la cola. Esta acción no se puede deshacer.',
            { count: queueEntries.length },
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        {isSubmitting ? (
          <ButtonSkeleton />
        ) : (
          <Button kind="danger" onClick={handleClearAll}>
            {t('clearQueueEntries', 'Limpiar cola')}
          </Button>
        )}
      </ModalFooter>
    </>
  );
};

export default ClearQueueEntriesModal;
