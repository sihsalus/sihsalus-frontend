import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { type FetchResponse, getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type EmergencyQueueEntry } from '../resources/emergency.resource';

interface ModalParams {
  modalTitle: string;
  modalInstruction: ReactNode;
  submitButtonText: string;
  submitSuccessTitle: string;
  submitSuccessText: string;
  submitFailureTitle: string;
  submitAction: (queueEntry: EmergencyQueueEntry) => Promise<FetchResponse<unknown>>;
  isDanger?: boolean;
}

interface EmergencyQueueConfirmActionModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
  modalParams: ModalParams;
}

const EmergencyQueueConfirmActionModal: React.FC<EmergencyQueueConfirmActionModalProps> = ({
  queueEntry,
  closeModal,
  modalParams,
}) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const {
    modalTitle,
    modalInstruction,
    submitButtonText,
    submitSuccessTitle,
    submitSuccessText,
    submitFailureTitle,
    submitAction,
    isDanger = false,
  } = modalParams;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitForm = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    submitAction(queueEntry)
      .then(({ status }) => {
        const success = status >= 200 && status < 300;
        if (success) {
          showSnackbar({
            isLowContrast: true,
            title: submitSuccessTitle,
            kind: 'success',
            subtitle: submitSuccessText,
          });
          mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
          closeModal();
        } else {
          throw new Error('The emergency queue action returned an unsuccessful response.');
        }
      })
      .catch((error: unknown) => {
        showSnackbar({
          title: submitFailureTitle,
          kind: 'error',
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              'queueActionFailureSubtitle',
              'No se pudo confirmar la acción sobre la cola. Actualice y verifique su estado antes de intentarlo nuevamente.',
            ),
            { logContext: 'Execute emergency queue action' },
          ),
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <>
      <ModalHeader closeModal={closeModal} title={modalTitle} />
      <ModalBody>
        <p>{modalInstruction}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind={isDanger ? 'danger' : 'primary'} disabled={isSubmitting} onClick={submitForm}>
          {submitButtonText}
        </Button>
      </ModalFooter>
    </>
  );
};

export default EmergencyQueueConfirmActionModal;
