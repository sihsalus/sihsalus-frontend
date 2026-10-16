import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader, TextArea } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { procedureVoidReasonMaxLength } from '../../constants';
import { deleteProcedure, useMutatePatientProcedures } from '../../procedures.resource';
import styles from './delete-procedure.modal.scss';

type DeleteProcedureModalProps = {
  closeDeleteModal: () => void;
  procedureUuid: string;
  patientUuid: string;
};

const DeleteProcedureModal: React.FC<DeleteProcedureModalProps> = ({
  closeDeleteModal,
  procedureUuid,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const mutate = useMutatePatientProcedures(patientUuid);
  const reasonId = useId();
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const count = Array.from(reason).length;
  const invalidReason = !reason.trim() || count > procedureVoidReasonMaxLength;

  const handleDelete = useCallback(async () => {
    setAttempted(true);
    if (invalidReason || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteProcedure(procedureUuid, reason);
    } catch (error) {
      setIsDeleting(false);
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingProcedure', 'Could not confirm procedure voiding'),
        subtitle: getCompatibleUserFacingErrorMessage(
          error,
          t('checkProcedureBeforeRetry', 'Check the procedure before trying again.'),
          { log: false },
          getUserFacingErrorMessage,
        ),
      });
      return;
    }
    try {
      await mutate();
      showSnackbar({ isLowContrast: true, kind: 'success', title: t('procedureDeleted', 'Procedure voided') });
    } catch {
      showSnackbar({
        kind: 'warning',
        title: t('procedureDeleted', 'Procedure voided'),
        subtitle: t(
          'procedureVoidedRefreshFailed',
          'The procedure was voided, but the list could not refresh. Reload the page; do not repeat the action.',
        ),
      });
    }
    closeDeleteModal();
  }, [closeDeleteModal, procedureUuid, mutate, t, reason, invalidReason, isDeleting]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deleteProcedure', 'Void procedure')} />
      <ModalBody>
        <p>{t('deleteModalConfirmationText', 'Are you sure you want to void this procedure?')}</p>
        <TextArea
          id={reasonId}
          labelText={t('voidReason', 'Reason for voiding (required)')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isDeleting}
          helperText={t('voidReasonCount', '{{count}} / {{max}} characters', {
            count,
            max: procedureVoidReasonMaxLength,
          })}
          invalid={(attempted || count > procedureVoidReasonMaxLength) && invalidReason}
          invalidText={
            !reason.trim()
              ? t('voidReasonRequired', 'A reason for voiding is required')
              : t('voidReasonTooLong', 'Reason for voiding exceeds {{max}} characters', {
                  max: procedureVoidReasonMaxLength,
                })
          }
        />
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeDeleteModal} disabled={isDeleting}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button className={styles.deleteButton} kind="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? (
            <InlineLoading description={t('deleting', 'Voiding') + '...'} />
          ) : (
            <span>{t('delete', 'Void')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default DeleteProcedureModal;
