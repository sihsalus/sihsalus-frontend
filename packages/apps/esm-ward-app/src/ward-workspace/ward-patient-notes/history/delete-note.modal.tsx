import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation, getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteEncounter } from '../../../ward.resource';

interface DeleteEncounterConfirmationProps {
  encounterUuid: string;
  close: () => void;
  onDelete?: () => void;
}

const DeleteEncounterConfirmation: React.FC<DeleteEncounterConfirmationProps> = ({
  close,
  encounterUuid,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const handleCancel = () => close();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteEncounter(encounterUuid);
      showSnackbar({
        kind: 'success',
        title: t('noteDeletedSuccessfully', 'Note deleted successfully'),
      });
      close();
      onDelete?.();
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('errorDeletingNote', 'Error deleting note'),
        subtitle: getUserFacingErrorMessage(
          e,
          t('errorDeletingNoteMessage', 'No se pudo eliminar la nota. Intente nuevamente.'),
          { logContext: `Delete inpatient note encounter ${encounterUuid}` },
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ModalHeader closeModal={close}>{t('deleteNote', 'Delete note')}?</ModalHeader>
      <ModalBody>
        <p>
          {t('deleteNoteConfirmationText', `Are you sure you want to delete this note? This action can't be undone.`)}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button size="lg" kind="secondary" onClick={handleCancel}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button autoFocus kind="danger" disabled={isDeleting} onClick={handleDelete} size="lg">
          {getCoreTranslation('delete')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default DeleteEncounterConfirmation;
