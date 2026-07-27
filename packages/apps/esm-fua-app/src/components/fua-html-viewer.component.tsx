import { InlineLoading } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import { ModuleFuaRestURL, resolveFuaGeneratorEndpoint } from '../constant';
import { prepareSafeFuaHtml } from '../utils/safe-fua-html';

import styles from './fua-html-viewer.scss';

interface FuaHtmlViewerProps {
  fuaId?: string;
  visitUuid?: string;
  endpoint?: string;
}

const FuaHtmlViewer: React.FC<FuaHtmlViewerProps> = ({ fuaId, visitUuid, endpoint }) => {
  const config = useConfig<Config>();
  const { t } = useTranslation();
  const fuaEndpoint = endpoint || resolveFuaGeneratorEndpoint(config.fuaGeneratorEndpoint);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchFuaHtml = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const url = visitUuid
          ? `${ModuleFuaRestURL}/RenderFUA/${encodeURIComponent(visitUuid)}`
          : fuaId
            ? `${fuaEndpoint}?fuaId=${encodeURIComponent(fuaId)}`
            : fuaEndpoint;

        const response = await fetch(url, {
          method: visitUuid ? 'POST' : 'GET',
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`${t('errorLoadingFua', 'Error loading FUA')}: ${response.status}`);
        }

        const html = await response.text();
        setHtmlContent(html);
      } catch (err) {
        if (abortController.signal.aborted) return;
        const errorMessage = getUserFacingErrorMessage(
          err,
          t('errorLoadingFuaMessage', 'No se pudo cargar el FUA. Intente nuevamente.'),
          { logContext: 'Load FUA HTML document' },
        );
        setError(errorMessage);
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: errorMessage,
          kind: 'error',
        });
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchFuaHtml();

    return () => abortController.abort();
  }, [fuaId, fuaEndpoint, t, visitUuid]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <InlineLoading description={t('loadingFuaDocument', 'Loading FUA document...')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{t('couldNotLoadFuaDocument', 'Could not load FUA document')}</p>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <iframe
        srcDoc={prepareSafeFuaHtml(htmlContent)}
        title={t('fuaDocument', 'FUA Document')}
        className={styles.iframe}
        sandbox=""
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default FuaHtmlViewer;
