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
import styles from './modal.scss';

interface DeleteStudyModalProps {
  closeDeleteModal: () => void;
  studyId: number;
  patientUuid: string;
}

const DeleteStudyModal: React.FC<DeleteStudyModalProps> = ({ closeDeleteModal, studyId, patientUuid }) => {
  const { t } = useTranslation();
  const { mutate } = useStudiesByPatient(patientUuid);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOption, setSelectedOption] = useState('openmrs');

  const handleOptionChange = (valueOrEvent) => {
    setSelectedOption(valueOrEvent?.target?.value || valueOrEvent);
  };

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await deleteStudy(studyId, selectedOption, new AbortController());
      if (response.ok) {
        mutate();
        closeDeleteModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('studyDeleted', 'Study is deleted'),
        });
      }
    } catch (error) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingStudy', 'An error occurred while deleting the study'),
        subtitle: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [closeDeleteModal, studyId, mutate, t, selectedOption]);

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

export default DeleteStudyModal;
