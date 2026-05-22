import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface DeleteStockRuleModalProps {
  uuid?: string;
  close: () => void;
  onConfirmation: () => void;
}

const DeleteStockRuleModal: React.FC<DeleteStockRuleModalProps> = ({ close, onConfirmation, uuid }) => {
  const { t } = useTranslation();
  const handleCancel = () => close();
  const handleDelete = () => onConfirmation?.();

  return (
    <>
      <ModalHeader closeModal={close}>{t('deleteStockRule', 'Delete Stock Rule')}?</ModalHeader>
      <ModalBody>
        <p>
          {t(
            'deleteRuleConfirmationText',
            `Are you sure you want to delete this stock rule? This action can't be undone.`,
            { encounter: uuid },
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button size="lg" kind="secondary" onClick={handleCancel}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button autoFocus kind="danger" onClick={handleDelete} size="lg">
          {t('delete', 'Delete')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default DeleteStockRuleModal;
