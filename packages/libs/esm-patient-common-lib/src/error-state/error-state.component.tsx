import { Layer, Tile } from '@carbon/react';
import { getCoreTranslation, getUserFacingErrorMessage, logError, useLayoutType } from '@openmrs/esm-framework';
import React, { useEffect, useRef } from 'react';

import styles from './error-state.scss';

export interface ErrorStateProps {
  readonly error: unknown;
  readonly headerTitle: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, headerTitle }) => {
  const isTablet = useLayoutType() === 'tablet';
  const lastLoggedError = useRef<unknown>(undefined);
  const errorMessage = getUserFacingErrorMessage(error, getCoreTranslation('errorLoadingInformation'), { log: false });

  useEffect(() => {
    if (error !== lastLoggedError.current) {
      logError(error, 'Patient error state');
      lastLoggedError.current = error;
    }
  }, [error]);

  return (
    <Layer>
      <Tile className={styles.tile}>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{headerTitle}</h4>
        </div>
        <p className={styles.errorMessage}>{errorMessage}</p>
      </Tile>
    </Layer>
  );
};
