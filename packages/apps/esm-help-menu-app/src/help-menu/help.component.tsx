import { Button } from '@carbon/react';
import { Help } from '@carbon/react/icons';
import { useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './help.styles.scss';
import HelpMenuPopup from './help-popup.component';

export default function HelpMenu() {
  const { t } = useTranslation();
  const { authenticated, user } = useSession();
  const helpMenuLabel = t('helpMenu', 'Help menu');
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const helpMenuButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const helpMenuItems = useAssignedExtensions('help-menu-slot');
  const canShowHelp = Boolean(authenticated && user && helpMenuItems.length > 0);

  const toggleHelpMenu = () => {
    setHelpMenuOpen((prevState) => !prevState);
  };

  useEffect(() => {
    if (!canShowHelp) {
      setHelpMenuOpen(false);
    }
  }, [canShowHelp]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        event.target instanceof Node &&
        helpMenuButtonRef.current &&
        !helpMenuButtonRef.current.contains(event.target) &&
        popupRef.current &&
        !popupRef.current.contains(event.target)
      ) {
        setHelpMenuOpen(false);
      }
    };

    globalThis.addEventListener(`mousedown`, handleClickOutside);
    globalThis.addEventListener(`touchstart`, handleClickOutside);
    return () => {
      globalThis.removeEventListener(`mousedown`, handleClickOutside);
      globalThis.removeEventListener(`touchstart`, handleClickOutside);
    };
  }, []);

  if (!canShowHelp) {
    return null;
  }

  return (
    <>
      <Button
        aria-label={helpMenuLabel}
        className={styles.helpMenuButton}
        kind="ghost"
        onClick={toggleHelpMenu}
        ref={helpMenuButtonRef}
        size="md"
        title={helpMenuLabel}
      >
        <Help size={20} />
      </Button>
      {helpMenuOpen && (
        <div id="help-menu-popup" ref={popupRef} className={styles.helpMenuPopup}>
          <HelpMenuPopup />
        </div>
      )}
    </>
  );
}
