import { InlineLoading } from '@carbon/react';
import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import { fuaReadPrivilege } from '../constant';
import { createInertFuaHtml, resolveTrustedFuaEndpoint } from '../utils/fua-html-security';

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

        const trustedEndpoint = resolveTrustedFuaEndpoint(endpoint, window.location.origin);
        if (!trustedEndpoint) {
          throw new Error(
            t(
              'fuaEndpointUnavailable',
              'The FUA viewer requires a secure same-origin endpoint configured by an administrator.',
            ),
          );
        }

        const response = await fetch(trustedEndpoint, {
          credentials: 'same-origin',
          referrerPolicy: 'no-referrer',
          signal: abortController.signal,
        });

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
          err instanceof Error && err.message === t('fuaEndpointUnavailable')
            ? err.message
            : t('errorLoadingFuaViewer', 'Error loading FUA viewer');
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
        srcDoc={createInertFuaHtml(htmlContent)}
        title={t('fuaViewer', 'FUA Viewer')}
        className={styles.fullIframe}
        referrerPolicy="no-referrer"
        sandbox=""
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
