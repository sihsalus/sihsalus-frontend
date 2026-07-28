import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteProcedureStep, useProcedureStep } from '../../api';

interface DeleteProcedureStepModalProps {
  closeDeleteModal: () => void;
  requestId: number;
  stepId: number;
}

const DeleteProcedureStepModal: React.FC<DeleteProcedureStepModalProps> = ({ closeDeleteModal, requestId, stepId }) => {
  const { t } = useTranslation();
  const { mutate } = useProcedureStep(requestId);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);

    deleteProcedureStep(stepId, new AbortController())
      .then((response) => {
        if (response.ok) {
          mutate();
          closeDeleteModal();
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            title: t('procedureStepDeleted', 'Procedure step is deleted'),
          });
        }
      })
      .catch((error) => {
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: t('errorDeletingProcedureStep', 'An error occurred while deleting the procedure step'),
          subtitle: error?.message,
        });
      });
  }, [closeDeleteModal, stepId, mutate, t]);

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
        <Button kind="danger" onClick={handleDelete} disabled={isDeleting}>
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
