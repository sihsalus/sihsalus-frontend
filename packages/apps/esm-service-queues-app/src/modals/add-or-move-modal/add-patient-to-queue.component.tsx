import { Button, Form, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { type Visit } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QueueFields, { type QueueFieldsCallbacks } from '../../create-queue-entry/queue-fields/queue-fields.component';
import { useMutateQueueEntries } from '../../hooks/useQueueEntries';

interface AddPatientToQueueModalProps {
  modalTitle: string;
  activeVisit: Visit;
  closeModal: () => void;
}

const AddPatientToQueueModal: React.FC<AddPatientToQueueModalProps> = ({ modalTitle, activeVisit, closeModal }) => {
  const { t } = useTranslation();
  const { mutateQueueEntries } = useMutateQueueEntries();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callbacks, setCallbacks] = useState<QueueFieldsCallbacks | null>(null);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!callbacks || !callbacks.onBeforeVisitSave()) {
        return;
      }

      setIsSubmitting(true);

      try {
        await callbacks.onVisitCreatedOrUpdated(activeVisit);
        closeModal();
        mutateQueueEntries();
      } catch {
        // QueueFields reports the contextual error and this modal remains open.
      } finally {
        setIsSubmitting(false);
      }
    },
    [callbacks, activeVisit, closeModal, mutateQueueEntries],
  );

  return (
    <Form onSubmit={handleSubmit}>
      <ModalHeader closeModal={closeModal} title={modalTitle} />
      <ModalBody>
        <QueueFields setCallbacks={setCallbacks} />
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button disabled={isSubmitting || !callbacks} kind="primary" type="submit">
          {isSubmitting
            ? t('addingPatientToQueue', 'Adding patient to queue') + '...'
            : t('addPatientToQueue', 'Add patient to queue')}
        </Button>
      </ModalFooter>
    </Form>
  );
};

export default AddPatientToQueueModal;
