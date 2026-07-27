import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeleteQueryModalProps {
  closeModal: () => void;
  onDelete: (queryId: string) => Promise<void>;
  queryName: string;
  queryId: string;
}

const DeleteQueryModal: React.FC<DeleteQueryModalProps> = ({ closeModal, queryId, onDelete }) => {
  const { t } = useTranslation();
  const [isDeletingQuery, setIsDeletingQuery] = useState(false);

  const handleDeleteQuery = async () => {
    setIsDeletingQuery(true);
    await onDelete(queryId);
    setIsDeletingQuery(false);
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
