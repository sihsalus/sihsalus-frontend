import { HeaderGlobalAction } from '@carbon/react';
import { CloseIcon, SwitcherIcon, useOnClickOutside } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import AppModuleSwitcher from '../app-module-switcher/app-module-switcher.component';

import styles from './navbar.scss';
import { type MenuButtonProps } from './types';

const AppMenuButton: React.FC<MenuButtonProps> = ({ isActivePanel, togglePanel, hidePanel }) => {
  const { t } = useTranslation();
  const appMenuRef = useOnClickOutside<HTMLDivElement>(hidePanel('appMenu'), isActivePanel('appMenu'));

  return (
    <div ref={appMenuRef} className={styles.panelWrapper}>
      <HeaderGlobalAction
        aria-label={t('AppMenuTooltip', 'App Menu')}
        aria-labelledby="App Menu"
        className={classNames({
          [styles.headerGlobalBarButton]: isActivePanel('appMenu'),
          [styles.activePanel]: !isActivePanel('appMenu'),
        })}
        isActive={isActivePanel('appMenu')}
        onClick={() => togglePanel('appMenu')}
        tooltipAlignment="end"
      >
        {isActivePanel('appMenu') ? <CloseIcon size={20} /> : <SwitcherIcon size={20} />}
      </HeaderGlobalAction>
      {isActivePanel('appMenu') && <AppModuleSwitcher />}
    </div>
  );
};

export default AppMenuButton;
