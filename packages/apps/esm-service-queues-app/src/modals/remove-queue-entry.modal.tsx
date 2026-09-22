import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type QueueEntry } from '../types';
import { endQueueEntry } from './queue-entry-actions.resource';
import QueueEntryConfirmActionModal from './queue-entry-confirm-action.modal';

interface RemoveQueueEntryModalProps {
  queueEntry: QueueEntry;
  closeModal: () => void;
  completeCare?: boolean;
}

const RemoveQueueEntryModal: React.FC<RemoveQueueEntryModalProps> = ({
  queueEntry,
  closeModal,
  completeCare = false,
}) => {
  const { t } = useTranslation();
  const patient = queueEntry.display;
  const queue = queueEntry.queue.display;
  const modalInstruction = completeCare ? (
    <p>
      {t(
        'confirmCompleteQueueCare',
        'Se finalizará el paso de {{patient}} por esta cola. La consulta, la cita y el egreso clínico se gestionan por separado.',
        { patient },
      )}
    </p>
  ) : (
    <Trans i18nKey="confirmRemovePatientFromQueue">
      Are you sure you want to remove <strong>{{ patient } as any}</strong> from {{ queue }}?
    </Trans>
  );

  return (
    <QueueEntryConfirmActionModal
      queueEntry={queueEntry}
      closeModal={closeModal}
      modalParams={{
        modalTitle: completeCare
          ? t('completeQueueCare', 'Finalizar en cola')
          : t('removePatientFromQueue', 'Remove {{patient}} from queue?', { patient }),
        modalInstruction,
        submitButtonText: completeCare ? t('completeQueueCare', 'Finalizar en cola') : t('remove', 'Remove'),
        submitSuccessTitle: t('patientRemoved', 'Patient removed'),
        submitSuccessText: t('patientRemovedSuccessfully', 'Patient removed from queue successfully'),
        submitFailureTitle: t('patientRemovedFailed', 'Error removing patient from queue'),
        submitAction: (queueEntry) => endQueueEntry(queueEntry.uuid),
      }}
      showPatientName={false}
    />
  );
};

export default RemoveQueueEntryModal;
