import { Layer, Tile } from '@carbon/react';
import { getCoreTranslation, getUserFacingErrorMessage, logError, useLayoutType } from '@openmrs/esm-framework';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './error-state.scss';

interface ErrorStateProps {
  error: Error;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const lastLoggedError = useRef<unknown>(undefined);
  const errorMessage = getUserFacingErrorMessage(error, getCoreTranslation('errorLoadingInformation'), { log: false });

  useEffect(() => {
    if (error !== lastLoggedError.current) {
      logError(error, 'Form Builder error state');
      lastLoggedError.current = error;
    }
  }, [error]);

  return (
    <Layer>
      <Tile className={styles.tile}>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{t('forms', 'Forms')}</h4>
        </div>
        <p className={styles.errorMessage}>{errorMessage}</p>
      </Tile>
    </Layer>
  );
};

export default ErrorState;
