import {
  Button,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
} from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, userHasAccess, useSession } from '@openmrs/esm-framework';
import { CONDITION_TEXT_MAX_LENGTH, useConditionDeletion } from '@openmrs/esm-patient-common-lib';
import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { prenatalCareEditPrivilege } from '../../constants';
import { deleteCondition, useConditions } from './conditions.resource';
import styles from './delete-condition.scss';

interface DeleteConditionModalProps {
  closeDeleteModal: () => void;
  conditionId: string;
  patientUuid: string;
}

const DeleteConditionModal: React.FC<DeleteConditionModalProps> = ({ closeDeleteModal, conditionId, patientUuid }) => {
  const { t } = useTranslation();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const trimmedReason = reason.trim();
  const reasonInvalid = !trimmedReason || trimmedReason.length > CONDITION_TEXT_MAX_LENGTH;
  const { mutate } = useConditions(patientUuid);
  const session = useSession();
  const canEdit = userHasAccess(prenatalCareEditPrivilege, session?.user);

  const { isDeleting, isDeleted, isUncertain, handleDelete, handleClose } = useConditionDeletion({
    onDelete: () => deleteCondition(conditionId, patientUuid, trimmedReason),
    refresh: mutate,
    onClose: closeDeleteModal,
    canDelete: canEdit && !reasonInvalid,
    onSuccess: () =>
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('conditionDeleted', 'Condition deleted'),
      }),
    onDeleteError: (error) =>
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingCondition', 'Error deleting condition'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('conditionDeleteFailed', 'The condition could not be deleted. Please try again.'),
          { logContext: 'Delete maternal health condition' },
        ),
      }),
    onRefreshError: (error) =>
      showSnackbar({
        isLowContrast: false,
        kind: 'warning',
        title: t('conditionDeletedRefreshFailedTitle', 'Antecedent deleted; refresh needed'),
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'conditionDeletedRefreshFailed',
            'The antecedent was deleted, but the history could not be refreshed. Reload the page before making further changes.',
          ),
          { logContext: 'Delete maternal health condition refresh' },
        ),
      }),
  });

  useEffect(() => {
    if (!canEdit) {
      closeDeleteModal();
    }
  }, [canEdit, closeDeleteModal]);

  if (!canEdit) {
    return null;
  }

  return (
    <div>
      <ModalHeader closeModal={handleClose} title={t('deleteCondition', 'Delete condition')} />
      <ModalBody>
        {isUncertain && (
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            role="alert"
            title={t('conditionDeletionUnconfirmedTitle', 'Removal could not be confirmed')}
            subtitle={t(
              'conditionDeletionUnconfirmed',
              'The request may have been applied. Close this dialog and reload the history before making further changes.',
            )}
          />
        )}
        <p>{t('deleteModalConfirmationText', 'Are you sure you want to delete this condition?')}</p>
        <p>
          {t(
            'antecedentVoidingNotice',
            'This removes the antecedent from the current history while retaining the original record.',
          )}
        </p>
        <TextArea
          id={reasonId}
          labelText={t('antecedentVoidReason', 'Reason for removal')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setReasonTouched(true)}
          invalid={reasonTouched && reasonInvalid}
          invalidText={
            !trimmedReason
              ? t('antecedentVoidReasonRequired', 'Enter a reason for removing this antecedent.')
              : t('antecedentVoidReasonTooLong', 'The reason must contain at most 255 characters.')
          }
          required
          rows={3}
          maxLength={CONDITION_TEXT_MAX_LENGTH}
          maxCount={CONDITION_TEXT_MAX_LENGTH}
          enableCounter
          disabled={isDeleting || isDeleted || isUncertain}
        />
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={handleClose} disabled={isDeleting}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          className={styles.deleteButton}
          kind="danger"
          onClick={handleDelete}
          disabled={isDeleting || isDeleted || isUncertain || reasonInvalid}
        >
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
