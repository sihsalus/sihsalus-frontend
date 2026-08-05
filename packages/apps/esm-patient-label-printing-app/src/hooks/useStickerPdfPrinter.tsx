/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useStickerPdfPrinter = () => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const isMountedRef = useRef(true);
  const timerIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const intervalIdsRef = useRef<Array<ReturnType<typeof setInterval>>>([]);

  const printPdf = useCallback(
    (url: string) => {
      if (isPrinting) {
        return Promise.reject(new Error(t('printInProgress', 'Print already in progress')));
      }

      return new Promise<void>((resolve) => {
        setIsPrinting(true);

        if (!iframeRef.current) {
          const iframe = document.createElement('iframe');
          iframe.name = 'pdfPrinterFrame';
          iframe.setAttribute('aria-hidden', 'true');
          Object.assign(iframe.style, {
            position: 'fixed',
            width: '0',
            height: '0',
            border: 'none',
            visibility: 'hidden',
            pointerEvents: 'none',
          });
          iframeRef.current = iframe;
          document.body.appendChild(iframe);
        }

        const iframe = iframeRef.current;
        let hasClosed = false;
        let loadHandled = false;

        const handleLoad = () => {
          // load can fire more than once for the same src; a second run would
          // create a duplicate poll interval that nothing ever clears.
          if (loadHandled) {
            return;
          }
          loadHandled = true;

          try {
            const contentWindow = iframe.contentWindow;
            if (!contentWindow) throw new Error('No content window');

            let pollInterval: ReturnType<typeof setInterval> | null = null;

            const cleanup = () => {
              if (hasClosed) return;
              hasClosed = true;
              if (pollInterval !== null) {
                clearInterval(pollInterval);
              }
              if (isMountedRef.current) {
                setIsPrinting(false);
              }
              resolve();
            };

            try {
              contentWindow.addEventListener('afterprint', cleanup, { once: true });
            } catch (e) {
              // Cross-origin, use polling fallback
            }

            contentWindow.focus();
            contentWindow.print();

            let wasFocused = false;
            pollInterval = setInterval(() => {
              const hasFocus = document.hasFocus();
              if (hasFocus && wasFocused) cleanup();
              if (!hasFocus) wasFocused = true;
            }, 250);
            intervalIdsRef.current.push(pollInterval);

            timerIdsRef.current.push(setTimeout(cleanup, 30000));
          } catch (error) {
            if (isMountedRef.current) {
              setIsPrinting(false);
            }
            resolve();
          }
        };

        iframe.onload = handleLoad;
        iframe.onerror = () => {
          if (isMountedRef.current) {
            setIsPrinting(false);
          }
          resolve();
        };
        iframe.src = url;
      });
    },
    [t, isPrinting],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timerIdsRef.current.forEach((id) => {
        clearTimeout(id);
      });
      timerIdsRef.current = [];
      intervalIdsRef.current.forEach((id) => {
        clearInterval(id);
      });
      intervalIdsRef.current = [];
      if (iframeRef.current?.parentNode) {
        iframeRef.current.parentNode.removeChild(iframeRef.current);
      }
    };
  }, []);

  return { printPdf, isPrinting };
};
