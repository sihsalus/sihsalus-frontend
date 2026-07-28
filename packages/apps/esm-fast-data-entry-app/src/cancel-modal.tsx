import { Button, ComposedModal, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { useTranslation } from 'react-i18next';

type CancelModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  context: {
    destroySession: () => void | Promise<void>;
    closeSession: () => void | Promise<void>;
  };
};

const CancelModal = ({ open, setOpen, context }: CancelModalProps) => {
  const { t } = useTranslation();

  const onCancel = () => setOpen(false);

  const onDiscard = async () => {
    await context.destroySession();
  };

  const onSaveAndClose = async () => {
    await context.closeSession();
  };

  return (
    <ComposedModal open={open} preventCloseOnClickOutside={true} onClose={onCancel}>
      <ModalHeader>{t('areYouSure', 'Are you sure?')}</ModalHeader>
      <ModalBody>
        {t(
          'cancelExplanation',
          'You will lose any unsaved changes on the current form. Do you want to discard the current session?',
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onCancel}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={onDiscard}>
          {t('discard', 'Discard')}
        </Button>
        <Button kind="primary" onClick={onSaveAndClose}>
          {t('saveSession', 'Save Session')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
};

export default CancelModal;
