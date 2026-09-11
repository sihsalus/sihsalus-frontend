import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImagingOperation } from '../utils/use-imaging-operation';
import { deleteRequest, useRequestsByPatient } from '../../api';

interface DeleteRequestModalProps {
  closeDeleteModal: () => void;
  requestId: number;
  patientUuid: string;
}

const DeleteRequestModal: React.FC<DeleteRequestModalProps> = ({ closeDeleteModal, requestId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useRequestsByPatient(patientUuid);
  const {
    start,
    isCurrent,
    finish,
    isPending: isDeleting,
    canWrite,
  } = useImagingOperation(`${patientUuid}:${requestId}`);

  const handleDelete = useCallback(async () => {
    const controller = start();
    if (!controller) return;
    try {
      await deleteRequest(requestId, controller);
      if (!isCurrent(controller)) return;
      void Promise.resolve()
        .then(() => mutate())
        .catch(() => {
          /* The read hook displays revalidation errors. */
        });
      closeDeleteModal();
      showSnackbar({ isLowContrast: true, kind: 'success', title: t('requestDeleted', 'Request deleted') });
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingRequest', 'An error occurred while deleting the requested procedure'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeDeleteModal, requestId, mutate, t, start, isCurrent, finish]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deletePatientRequest', 'Delete requested procedure')} />
      <ModalBody>
        <p>{t('deleteModalConfirmationTextRequest', 'Are you sure you want to delete this requested procdure?')}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeDeleteModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleDelete} disabled={isDeleting || !canWrite}>
          {isDeleting ? (
            <InlineLoading description={t('deleting', 'Deleting') + '...'} />
          ) : (
            <span>{t('delete', 'Delete')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default DeleteRequestModal;
