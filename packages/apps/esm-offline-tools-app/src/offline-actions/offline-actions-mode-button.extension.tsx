import { Toggle } from '@carbon/react';
import { Network_3 } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import { getCurrentOfflineMode, setCurrentOfflineMode } from '@openmrs/esm-framework/src/internal';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './offline-actions-mode-button.scss';

const OfflineActionsModeButton: React.FC = () => {
  const { t } = useTranslation();
  const toggleId = React.useId();
  const labelId = `${toggleId}-label`;
  const [active, setActive] = React.useState(() => getCurrentOfflineMode().active);
  const toggle = React.useCallback(
    (nextActive: boolean) => {
      if (getCurrentOfflineMode().notAvailable) {
        showSnackbar({
          kind: 'error',
          title: t('offlineModeUnavailable', 'Offline use is not available in this session.'),
        });
        return;
      }

      try {
        setCurrentOfflineMode(nextActive ? 'on' : 'off');
        setActive(getCurrentOfflineMode().active);
      } catch {
        showSnackbar({
          kind: 'error',
          title: t('offlineModeChangeFailed', 'Could not change offline use. Please try again.'),
        });
      }
    },
    [t],
  );

  return (
    <li className={`${styles.panelItemContainer} cds--switcher__item`}>
      <label className={styles.label} id={labelId} htmlFor={toggleId}>
        <Network_3 size={20} aria-hidden />
        <span>{t('enableOfflineUse', 'Enable offline use')}</span>
      </label>
      <Toggle
        className={styles.toggle}
        id={toggleId}
        aria-labelledby={labelId}
        hideLabel
        toggled={active}
        onToggle={toggle}
      />
    </li>
  );
};

export default OfflineActionsModeButton;
