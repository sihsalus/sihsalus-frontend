import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './help-popup.styles.scss';

export default function HelpMenuPopup({ close }: { close: () => void }) {
  const { t } = useTranslation();
  const { authenticated, user } = useSession();
  const helpMenuItems = useAssignedExtensions('help-menu-slot');
  const canShowHelp = Boolean(authenticated && user && helpMenuItems.length > 0);

  useEffect(() => {
    if (!canShowHelp) {
      close();
    }
  }, [canShowHelp, close]);

  if (!canShowHelp) {
    return null;
  }

  return (
    <>
      <ModalHeader closeModal={close} title={t('helpMenu', 'Help menu')} />
      <ModalBody>
        <ExtensionSlot className={styles.helpextension} name="help-menu-slot" />
      </ModalBody>
      <ModalFooter>
        <Button autoFocus kind="secondary" onClick={close}>
          {t('close', 'Close')}
        </Button>
      </ModalFooter>
    </>
  );
}
