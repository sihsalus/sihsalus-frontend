import {
  Button,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
} from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteStudy, useStudiesByPatient } from '../../api';
import { useImagingOperation } from '../utils/use-imaging-operation';
import styles from './modal.scss';

interface DeleteStudyModalProps {
  closeDeleteModal: () => void;
  studyId: number;
  patientUuid: string;
}

const DeleteStudyModal: React.FC<DeleteStudyModalProps> = ({ closeDeleteModal, studyId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useStudiesByPatient(patientUuid);
  const {
    start,
    isCurrent,
    finish,
    isPending: isDeleting,
    canWrite,
  } = useImagingOperation(`${patientUuid}:${studyId}`);
  const [selectedOption, setSelectedOption] = useState('openmrs');

  const handleOptionChange = (valueOrEvent) => {
    setSelectedOption(valueOrEvent?.target?.value || valueOrEvent);
  };

  const handleDelete = useCallback(async () => {
    const controller = start();
    if (!controller) return;
    try {
      const response = await deleteStudy(studyId, selectedOption, controller);
      if (response.ok && isCurrent(controller)) {
        void Promise.resolve()
          .then(() => mutate())
          .catch(() => {
            /* The patient study list exposes refresh errors. */
          });
        closeDeleteModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('studyDeleted', 'Study is deleted'),
        });
      }
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingStudy', 'An error occurred while deleting the study'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeDeleteModal, studyId, mutate, t, selectedOption, start, isCurrent, finish]);

  return (
    <div>
      <ModalHeader closeModal={closeDeleteModal} title={t('deletePatientStudy', 'Delete the image study')} />
      <ModalBody>
        <p>{t('deleteModalConfirmationTextStudy', 'Are you sure you want to delete this study?')}</p>
        <RadioButtonGroup
          name="delete-study-option"
          className={styles.radioButtonGroup}
          onChange={(value) => handleOptionChange(value)}
          valueSelected={selectedOption}
        >
          <RadioButton value="openmrs" id="openmrs" labelText={t('deleteFromOpenMRS', 'From SIHSALUS')} />
          <RadioButton
            value="openmrsOrthanc"
            id="openmrsOrthanc"
            labelText={t('deleteFromOrthancOpenMRS', 'From Orthanc & SIHSALUS')}
          />
        </RadioButtonGroup>
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

export default DeleteStudyModal;
