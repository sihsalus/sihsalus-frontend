import { Button, InlineNotification } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ResultsLoadError({
  retry,
  isOffline = false,
}: {
  retry: () => void;
  isOffline?: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div>
      <InlineNotification
        role="alert"
        kind="error"
        lowContrast
        hideCloseButton
        title={t('dataLoadError', 'Data load error')}
        subtitle={
          isOffline
            ? t('testResultsOffline', 'Connect to the network to load current test results.')
            : t('testResultsLoadError', 'Test results could not be loaded. Try again.')
        }
      />
      {!isOffline && (
        <Button kind="ghost" onClick={retry}>
          {t('retry', 'Retry')}
        </Button>
      )}
    </div>
  );
}
