import { Layer, Tile } from '@carbon/react';
import { getUserFacingErrorMessage, logError } from '@openmrs/esm-error-handling';
import { useLayoutType } from '@openmrs/esm-react-utils';
import { getCoreTranslation } from '@openmrs/esm-translations';
import React, { useEffect, useRef } from 'react';
import styles from './error-state.module.scss';

export interface ErrorStateProps {
  /** The error that caused this error card to be rendered. Expected to be a failed fetch result. */
  error: unknown;
  /** The title to use for this empty component. This must be a pre-translated string. */
  headerTitle: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, headerTitle }) => {
  const isTablet = useLayoutType() === 'tablet';
  const lastLoggedError = useRef<unknown>(undefined);
  const errorMessage = getUserFacingErrorMessage(error, getCoreTranslation('errorLoadingInformation'), {
    log: false,
  });

  useEffect(() => {
    if (error !== lastLoggedError.current) {
      logError(error, 'Styleguide error state');
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

export const ErrorCard = ErrorState;
export type ErrorCardProps = ErrorStateProps;
