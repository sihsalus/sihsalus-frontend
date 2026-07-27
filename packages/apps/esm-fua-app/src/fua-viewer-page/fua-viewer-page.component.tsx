import { InlineLoading } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import { fuaReadPrivilege, resolveFuaGeneratorEndpoint } from '../constant';
import { prepareSafeFuaHtml } from '../utils/safe-fua-html';

import styles from './fua-viewer-page.scss';

const FuaViewerPageContent: React.FC = () => {
  const config = useConfig<Config>();
  const { t } = useTranslation();
  const endpoint = resolveFuaGeneratorEndpoint(config.fuaGeneratorEndpoint);
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
        const errorMessage = getUserFacingErrorMessage(
          err,
          t('errorLoadingFuaMessage', 'No se pudo cargar el FUA. Intente nuevamente.'),
          { logContext: 'Load FUA viewer content' },
        );
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
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <iframe
        srcDoc={prepareSafeFuaHtml(htmlContent)}
        title={t('fuaViewer', 'FUA Viewer')}
        className={styles.fullIframe}
        sandbox=""
        referrerPolicy="no-referrer"
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
