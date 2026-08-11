import { Button, Layer, Tile } from '@carbon/react';
import { useLayoutType } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyDataIllustration } from './empty-data-illustration.component';
import styles from './empty-state.scss';

export interface EmptyStateProps {
  readonly displayText: string;
  readonly headerTitle: string;
  readonly launchForm?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = (props) => {
  const { t } = useTranslation('@sihsalus/esm-patient-chart-app');
  const isTablet = useLayoutType() === 'tablet';

  return (
    <Layer className={styles.layer}>
      <Tile className={styles.tile}>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{props.headerTitle}</h4>
        </div>
        <EmptyDataIllustration />
        <p className={styles.content}>
          {t('emptyStateText', 'There are no {{displayText}} to display for this patient', {
            displayText: props.displayText.toLowerCase(),
            // React escapes interpolated text when rendering it. Disabling the
            // i18next HTML escaping here prevents safe characters such as "/"
            // from being displayed as literal entities (for example &#x2F;).
            interpolation: { escapeValue: false },
          })}
        </p>
        <p className={styles.action}>
          {props.launchForm && (
            <Button onClick={() => props.launchForm()} kind="ghost" size={isTablet ? 'lg' : 'sm'}>
              {t('record', 'Record')} {props.displayText.toLowerCase()}
            </Button>
          )}
        </p>
      </Tile>
    </Layer>
  );
};
