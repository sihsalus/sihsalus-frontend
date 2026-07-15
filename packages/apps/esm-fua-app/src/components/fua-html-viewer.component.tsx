import { InlineLoading } from '@carbon/react';
import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Config } from '../config-schema';
import { ModuleFuaRestURL } from '../constant';
import { createInertFuaHtml, resolveTrustedFuaEndpoint } from '../utils/fua-html-security';

import styles from './fua-html-viewer.scss';

interface FuaHtmlViewerProps {
  fuaId?: string;
  visitUuid?: string;
  endpoint?: string;
}

const FuaHtmlViewer: React.FC<FuaHtmlViewerProps> = ({ fuaId, visitUuid, endpoint }) => {
  const config = useConfig<Config>();
  const { t } = useTranslation();
  const fuaEndpoint = endpoint ?? config.fuaGeneratorEndpoint;
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchFuaHtml = async () => {
      try {
        setIsLoading(true);
        setDisplayMessage(null);

        const trustedEndpoint = visitUuid ? null : resolveTrustedFuaEndpoint(fuaEndpoint, window.location.origin);
        if (!visitUuid && !trustedEndpoint) {
          throw new Error(
            t(
              'fuaEndpointUnavailable',
              'The FUA viewer requires a secure same-origin endpoint configured by an administrator.',
            ),
          );
        }

        const url = visitUuid
          ? `${ModuleFuaRestURL}/RenderFUA/${encodeURIComponent(visitUuid)}`
          : fuaId
            ? (() => {
                const target = new URL(trustedEndpoint);
                target.searchParams.set('fuaId', fuaId);
                return target.toString();
              })()
            : trustedEndpoint.toString();

        const response = await fetch(url, {
          credentials: 'same-origin',
          method: visitUuid ? 'POST' : 'GET',
          referrerPolicy: 'no-referrer',
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`${t('errorLoadingFua', 'Error loading FUA')}: ${response.status}`);
        }

        const html = await response.text();
        setHtmlContent(html);
      } catch (err) {
        if (abortController.signal.aborted) return;
        const operatorMessage =
          err instanceof Error && err.message === t('fuaEndpointUnavailable')
            ? t(
                'fuaEndpointUnavailable',
                'The FUA viewer requires a secure same-origin endpoint configured by an administrator.',
              )
            : t('couldNotLoadFuaDocument', 'Could not load FUA document');
        setDisplayMessage(operatorMessage);
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: operatorMessage,
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

  if (displayMessage) {
    return (
      <div className={styles.errorContainer}>
        <p>{t('couldNotLoadFuaDocument', 'Could not load FUA document')}</p>
        <p className={styles.errorMessage}>{displayMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <iframe
        srcDoc={createInertFuaHtml(htmlContent)}
        title={t('fuaDocument', 'FUA Document')}
        className={styles.iframe}
        referrerPolicy="no-referrer"
        sandbox=""
      />
    </div>
  );
};

export default FuaHtmlViewer;
