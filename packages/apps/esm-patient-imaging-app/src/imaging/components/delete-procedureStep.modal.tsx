import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImagingOperation } from '../utils/use-imaging-operation';
import { deleteProcedureStep, useProcedureStep } from '../../api';

interface DeleteProcedureStepModalProps {
  closeDeleteModal: () => void;
  requestId: number;
  stepId: number;
}

const DeleteProcedureStepModal: React.FC<DeleteProcedureStepModalProps> = ({ closeDeleteModal, requestId, stepId }) => {
  const { t } = useTranslation();
  const { mutate } = useProcedureStep(requestId);
  const { start, isCurrent, finish, isPending: isDeleting, canWrite } = useImagingOperation(`${requestId}:${stepId}`);

  const handleDelete = useCallback(async () => {
    const controller = start();
    if (!controller) return;
    try {
      await deleteProcedureStep(stepId, controller);
      if (!isCurrent(controller)) return;
      void Promise.resolve()
        .then(() => mutate())
        .catch(() => {
          /* The read hook displays revalidation errors. */
        });
      closeDeleteModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('procedureStepDeleted', 'Procedure step is deleted'),
      });
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingProcedureStep', 'An error occurred while deleting the procedure step'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeDeleteModal, stepId, mutate, t, start, isCurrent, finish]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deleteProcedureStep', 'Delete procedure step')} />
      <ModalBody>
        <p>{t('deleteModalConfirmationText', 'Are you sure you want to delete this procedure step?')}</p>
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

export default DeleteProcedureStepModal;
