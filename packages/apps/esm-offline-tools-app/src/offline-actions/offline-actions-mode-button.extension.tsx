import { SwitcherItem, Toggle } from '@carbon/react';
import { Network_3 } from '@carbon/react/icons';
import { getCurrentOfflineMode, setCurrentOfflineMode } from '@openmrs/esm-framework/src/internal';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './offline-actions-mode-button.scss';

function doNotCloseMenu(ev: React.SyntheticEvent) {
  ev.stopPropagation();
}

const OfflineActionsModeButton: React.FC = () => {
  const { t } = useTranslation();
  const [active, setActive] = React.useState(() => getCurrentOfflineMode().active);
  const toggle = React.useCallback(() => {
    setActive((value) => {
      const active = !value;
      setCurrentOfflineMode(active ? 'on' : 'off');
      return active;
    });
  }, []);

  return (
    <SwitcherItem className={styles.panelItemContainer} aria-label={t('enableOfflineUse', 'Enable offline use')}>
      <div>
        <Network_3 size={20} />
        <p onClick={doNotCloseMenu} role="none">
          {t('enableOfflineUse', 'Enable offline use')}
        </p>
      </div>
      <Toggle
        className={styles.toggle}
        id="offlineModeSwitch"
        labelText={t('enableOfflineUse', 'Enable offline use')}
        hideLabel
        toggled={active}
        onToggle={toggle}
      />
    </SwitcherItem>
  );
};

export default OfflineActionsModeButton;
