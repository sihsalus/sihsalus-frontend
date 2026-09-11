import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useImagingOperation } from '../utils/use-imaging-operation';
import { assignStudy, useStudiesByPatient } from '../../api';

interface UnlinkStudyModalProps {
  closeUnlinkModal: () => void;
  studyId: number;
  patientUuid: string;
}

const UnlinkStudyModal: React.FC<UnlinkStudyModalProps> = ({ closeUnlinkModal, studyId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useStudiesByPatient(patientUuid);
  const {
    start,
    isCurrent,
    finish,
    isPending: isDeleting,
    canWrite,
  } = useImagingOperation(`${patientUuid}:${studyId}`);

  const handleUnlink = useCallback(async () => {
    const controller = start();
    if (!controller) return;
    try {
      await assignStudy(studyId, patientUuid, false, controller);
      if (!isCurrent(controller)) return;
      void Promise.resolve()
        .then(() => mutate())
        .catch(() => {
          /* The read hook displays revalidation errors. */
        });
      closeUnlinkModal();
      showSnackbar({ isLowContrast: true, kind: 'success', title: t('studyUnlinked', 'Study is unlinked') });
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorUnlinkingStudy', 'An error occurred while unlinking the study'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeUnlinkModal, studyId, patientUuid, mutate, t, start, isCurrent, finish]);

  return (
    <div>
      <ModalHeader closeModal={closeUnlinkModal} title={t('unlinkPatientStudy', 'Unlink the image study')} />
      <ModalBody>
        <p>
          {t(
            'unlinkModalConfirmationTextStudy',
            'Are you sure you want to unlink this study from the patient? If you proceed, the study will not appear anymore in the patient chart. You can link it again to this or another patient later.',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeUnlinkModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleUnlink} disabled={isDeleting || !canWrite}>
          {isDeleting ? (
            <InlineLoading description={t('unlinking', 'Unlinking') + '...'} />
          ) : (
            <span>{t('unlink', 'Unlink')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default UnlinkStudyModal;
