import { InlineLoading } from '@carbon/react';
import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import { fuaReadPrivilege } from '../constant';

import styles from './fua-viewer-page.scss';

const FuaViewerPageContent: React.FC = () => {
  const config = useConfig<Config>();
  const { t } = useTranslation();
  const endpoint = config.fuaGeneratorEndpoint;
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchHtml = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(endpoint, { signal: abortController.signal });

        if (!response.ok) {
          throw new Error(
            `${t('errorLoadingContent', 'Error loading content')}: ${response.status} ${response.statusText}`,
          );
        }

        const html = await response.text();
        setHtmlContent(html);
      } catch (err) {
        if (abortController.signal.aborted) return;
        const errorMessage =
          err instanceof Error ? err.message : t('unknownErrorLoadingContent', 'Unknown error loading content');
        setError(errorMessage);
        showSnackbar({
          title: t('errorLoadingFua', 'Error loading FUA'),
          subtitle: errorMessage,
          kind: 'error',
        });
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchHtml();

    return () => abortController.abort();
  }, [endpoint, t]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <InlineLoading description={t('loadingFuaViewer', 'Loading FUA viewer...')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h3>{t('errorLoadingFuaViewer', 'Error loading FUA viewer')}</h3>
        <p>{error}</p>
        <details>
          <summary>{t('technicalInfo', 'Technical information')}</summary>
          <p>
            <strong>{t('endpoint', 'Endpoint')}:</strong> {endpoint}
          </p>
          <p>
            <strong>{t('possibleCauses', 'Possible causes')}:</strong>
          </p>
          <ul>
            <li>{t('serverNotResponding', 'The server is not responding')}</li>
            <li>{t('corsBlocking', 'CORS policies blocking the connection')}</li>
            <li>{t('incorrectEndpoint', 'The configured endpoint is incorrect')}</li>
          </ul>
          <p>
            <strong>{t('solutions', 'Solutions')}:</strong>
          </p>
          <ul>
            <li>{t('verifyServer', 'Verify that the server is running')}</li>
            <li>{t('testEndpoint', 'Test the endpoint directly in your browser')}</li>
            <li>{t('contactAdmin', 'Contact the system administrator')}</li>
          </ul>
        </details>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <iframe
        srcDoc={htmlContent}
        title={t('fuaViewer', 'FUA Viewer')}
        className={styles.fullIframe}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
      />
    </div>
  );
};

const FuaViewerPage: React.FC = () => (
  <RequirePrivilege privilege={fuaReadPrivilege}>
    <FuaViewerPageContent />
  </RequirePrivilege>
);

export default FuaViewerPage;
