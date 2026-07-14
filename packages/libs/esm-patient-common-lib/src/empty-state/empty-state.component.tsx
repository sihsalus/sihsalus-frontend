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

const normalizeDisplayText = (displayText: string) =>
  displayText.replace(/\S+/gu, (word) => {
    const uppercaseLetters = word.match(/\p{Lu}/gu)?.length ?? 0;
    return uppercaseLetters > 1 ? word : word.toLocaleLowerCase();
  });

export const EmptyState: React.FC<EmptyStateProps> = (props) => {
  const { t } = useTranslation('@sihsalus/esm-patient-chart-app');
  const isTablet = useLayoutType() === 'tablet';
  const displayText = normalizeDisplayText(props.displayText);

  return (
    <Layer className={styles.layer}>
      <Tile className={styles.tile}>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{props.headerTitle}</h4>
        </div>
        <EmptyDataIllustration />
        <p className={styles.content}>
          {t('emptyStateText', 'There are no {{displayText}} to display for this patient', {
            displayText,
            // React escapes text children. Disabling i18next's HTML escaping here
            // prevents safe punctuation such as "/" from being rendered as an entity.
            interpolation: { escapeValue: false },
          })}
        </p>
        <p className={styles.action}>
          {props.launchForm && (
            <Button onClick={() => props.launchForm()} kind="ghost" size={isTablet ? 'lg' : 'sm'}>
              {t('record', 'Record')} {displayText}
            </Button>
          )}
        </p>
      </Tile>
    </Layer>
  );
};
