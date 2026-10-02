import { InlineLoading, InlineNotification, Tile } from '@carbon/react';
import { FormPreview, type FormSchema } from '@sihsalus/esm-form-engine-lib';
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import styles from './form-renderer.scss';

interface FormRendererProps {
  isLoading: boolean;
  onSchemaChange?: (schema: FormSchema) => void;
  schema: FormSchema | null;
}

const FormRenderer: React.FC<FormRendererProps> = ({ isLoading, schema }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <InlineLoading className={styles.loader} description={t('loading', 'Loading') + '...'} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!schema && (
        <Tile className={styles.emptyStateTile}>
          <h4 className={styles.heading}>{t('noSchemaLoaded', 'No schema loaded')}</h4>
          <p className={styles.helperText}>
            {t(
              'formRendererHelperText',
              'Load a form schema in the Schema Editor to the left to see it rendered here by the Form Engine.',
            )}
          </p>
        </Tile>
      )}
      {schema && (
        <>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('schemaPreviewTitle', 'Form preview')}
            subtitle={t(
              'schemaPreviewDescription',
              'Try sample values here. They are not saved; actions requiring a patient encounter are unavailable.',
            )}
          />
          <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[schema]}>
            <FormPreview formJson={schema} />
          </ErrorBoundary>
        </>
      )}
    </div>
  );
};

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <Tile className={styles.errorStateTile}>
      <h4 className={styles.heading}>{t('problemLoadingPreview', 'There was a problem loading the form preview')}</h4>
      <p className={styles.helperText}>
        {t('schemaPreviewValidationHint', 'Check the questions and the Validation tab for schema errors.')}
      </p>
      <p className={styles.helperText}>
        {t('fixSchemaAndRender', 'Fix the error in the Schema Editor and click "Render changes" to retry.')}
      </p>
    </Tile>
  );
}

export default FormRenderer;
