import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assignStudy, useStudiesByPatient } from '../../api';

interface UnlinkStudyModalProps {
  closeUnlinkModal: () => void;
  studyId: number;
  patientUuid: string;
}

const UnlinkStudyModal: React.FC<UnlinkStudyModalProps> = ({ closeUnlinkModal, studyId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useStudiesByPatient(patientUuid);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUnlink = useCallback(async () => {
    setIsDeleting(true);
    assignStudy(studyId, patientUuid, false, new AbortController())
      .then(() => {
        mutate();
        closeUnlinkModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('studyUnlinked', 'Study is unlinked'),
        });
      })
      .catch((error) => {
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: t('errorUnlinkingStudy', 'An error occurred while unlinking the study'),
          subtitle: error?.message,
        });
      });
  }, [closeUnlinkModal, studyId, patientUuid, mutate, t]);

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
        <Button kind="danger" onClick={handleUnlink} disabled={isDeleting}>
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
