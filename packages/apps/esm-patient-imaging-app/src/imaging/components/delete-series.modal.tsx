import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImagingOperation } from '../utils/use-imaging-operation';
import { deleteSeries, useStudySeries } from '../../api';

interface DeleteSeriesModalProps {
  closeDeleteModal: () => void;
  studyId: number;
  orthancSeriesUID: string;
  patientUuid: string;
}

const DeleteSeriesModal: React.FC<DeleteSeriesModalProps> = ({
  closeDeleteModal,
  studyId,
  orthancSeriesUID,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const { mutate } = useStudySeries(studyId);
  const {
    start,
    isCurrent,
    finish,
    isPending: isDeleting,
    canWrite,
  } = useImagingOperation(`${patientUuid}:${studyId}:${orthancSeriesUID}`);

  const handleDelete = useCallback(async () => {
    const controller = start();
    if (!controller) return;
    try {
      await deleteSeries(orthancSeriesUID, studyId, controller);
      if (!isCurrent(controller)) return;
      void Promise.resolve()
        .then(() => mutate())
        .catch(() => {
          /* The read hook displays revalidation errors. */
        });
      closeDeleteModal();
      showSnackbar({ isLowContrast: true, kind: 'success', title: t('studySeries', 'Study Series is deleted') });
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingSeries', 'An error occurred while deleting the study series'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeDeleteModal, studyId, orthancSeriesUID, mutate, t, start, isCurrent, finish]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deleteStudySeries', 'Delete study series')} />
      <ModalBody>
        <p>{t('deleteModalConfirmationTextStudySeries', 'Are you sure you want to delete this study series?')}</p>
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

export default DeleteSeriesModal;
