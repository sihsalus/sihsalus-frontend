import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeleteQueryModalProps {
  closeModal: () => void;
  onDelete: (queryId: string) => Promise<void>;
  queryName: string;
  queryId: string;
}

const DeleteQueryModal: React.FC<DeleteQueryModalProps> = ({ closeModal, queryName, queryId, onDelete }) => {
  const { t } = useTranslation();
  const [isDeletingQuery, setIsDeletingQuery] = useState(false);

  const handleDeleteQuery = async () => {
    setIsDeletingQuery(true);
    try {
      await onDelete(queryId);
    } catch (error) {
      showSnackbar({
        title: t('QueryDeleteError', 'Something went wrong'),
        kind: 'error',
        isLowContrast: true,
        subtitle: error?.message,
      });
    } finally {
      setIsDeletingQuery(false);
    }
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('deleteSavedQuery', 'Delete saved query')} />
      <ModalBody>
        <p>{t('deleteSavedQueryConfirmation', 'Are you sure you want to delete this saved query?')}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button kind="danger" onClick={handleDeleteQuery} disabled={isDeletingQuery}>
          {isDeletingQuery ? (
            <InlineLoading description={t('deleting', 'Deleting') + '...'} />
          ) : (
            <span>{getCoreTranslation('delete')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default DeleteQueryModal;
