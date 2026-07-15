import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deleteCondition, useConditions } from './conditions.resource';
import styles from './delete-condition.scss';

interface DeleteConditionModalProps {
  closeDeleteModal: () => void;
  conditionId: string;
  patientUuid?: string;
}

const DeleteConditionModal: React.FC<DeleteConditionModalProps> = ({ closeDeleteModal, conditionId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useConditions(patientUuid);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);

    try {
      await deleteCondition(conditionId);
      await mutate();

      closeDeleteModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('antecedentDeleted', 'Antecedent deleted'),
      });
    } catch (error: unknown) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingAntecedent', 'Error deleting antecedent'),
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'conditionDeleteFailureSafe',
            'No se pudo eliminar el antecedente. Actualice la historia y verifique si aún existe antes de reintentar.',
          ),
          { logContext: 'Delete outpatient condition' },
        ),
      });
    }
  }, [closeDeleteModal, conditionId, mutate, t]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deleteAntecedent', 'Delete antecedent')} />
      <ModalBody>
        <p>{t('deleteAntecedentModalConfirmationText', 'Are you sure you want to delete this antecedent?')}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeDeleteModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button className={styles.deleteButton} kind="danger" onClick={handleDelete} disabled={isDeleting}>
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

export default DeleteConditionModal;
