import { Button, SwitcherItem } from '@carbon/react';
import { Help } from '@carbon/react/icons';
import { showModal, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './help.styles.scss';

export default function HelpMenu() {
  const { t } = useTranslation();
  const { authenticated, user } = useSession();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const helpMenuLabel = t('helpMenu', 'Help menu');
  const helpMenuItems = useAssignedExtensions('help-menu-slot');

  if (!authenticated || !user || helpMenuItems.length === 0) {
    return null;
  }

  return (
    <SwitcherItem aria-label={helpMenuLabel}>
      <Button
        className={styles.helpMenuButton}
        kind="ghost"
        ref={buttonRef}
        onClick={() => showModal('help-menu-modal', { size: 'sm' }, () => buttonRef.current?.focus())}
      >
        <Help size={20} />
        {helpMenuLabel}
      </Button>
    </SwitcherItem>
  );
}
