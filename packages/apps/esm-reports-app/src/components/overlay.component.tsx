import { IconButton } from '@carbon/react';
import { ArrowLeftIcon, CloseIcon, getCoreTranslation, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { closeOverlay, useOverlay } from '../hooks/use-overlay';

import styles from './overlay.scss';

const Overlay: React.FC = () => {
  const { header, component, isOverlayOpen } = useOverlay();
  const layout = useLayoutType();
  const { t } = useTranslation();

  return (
    <>
      {isOverlayOpen && (
        <div
          className={classNames({
            [styles.desktopOverlay]: layout !== 'tablet',
            [styles.tabletOverlay]: layout === 'tablet',
          })}
        >
          {layout === 'tablet' && (
            <header className={styles.tabletOverlayHeader}>
              <IconButton label={t('back', 'Back')} onClick={closeOverlay}>
                <ArrowLeftIcon size={16} />
              </IconButton>
              <div className={styles.headerContent}>{header}</div>
            </header>
          )}

          {layout !== 'tablet' && (
            <div className={styles.desktopHeader}>
              <div className={styles.headerContent}>{header}</div>
              <IconButton
                className={styles.closePanelButton}
                kind="ghost"
                label={getCoreTranslation('close')}
                onClick={closeOverlay}
              >
                <CloseIcon size={16} />
              </IconButton>
            </div>
          )}
          {component}
        </div>
      )}
    </>
  );
};

export default Overlay;
