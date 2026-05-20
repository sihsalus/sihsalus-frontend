import { HeaderPanel } from '@carbon/react';
import { Launch } from '@carbon/react/icons';
import { ExtensionSlot, useConfig } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-panel.scss';

interface AppMenuProps {
  expanded: boolean;
  hidePanel: () => void;
}

const AppMenuPanel: React.FC<AppMenuProps> = ({ expanded, hidePanel }) => {
  const config = useConfig();
  const { t } = useTranslation();

  useEffect(() => {
    globalThis.addEventListener('popstate', hidePanel);
    return () => globalThis.removeEventListener('popstate', hidePanel);
  }, [hidePanel]);

  return (
    expanded && (
      <div style={{ display: 'inline' }}>
        <HeaderPanel
          className={classNames({ [styles.headerPanel]: expanded })}
          aria-label="App Menu Panel"
          expanded={expanded}
        >
          <ExtensionSlot className={styles.menuLink} name="app-menu-slot" />
          {config?.externalRefLinks?.length > 0 && (
            <div className={classNames(styles.menuLink, styles.externalLinks)}>
              {config?.externalRefLinks?.map((link) => (
                <a
                  key={`${link?.title}-${link?.redirect}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={link?.redirect}
                >
                  {t(link?.title)}
                  <Launch size={16} className={styles.launchIcon} />
                </a>
              ))}
            </div>
          )}
        </HeaderPanel>
      </div>
    )
  );
};

export default AppMenuPanel;
