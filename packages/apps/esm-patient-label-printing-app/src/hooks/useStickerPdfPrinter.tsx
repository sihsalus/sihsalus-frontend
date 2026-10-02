import { useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useStickerPdfPrinter = (contextKey = '') => {
  const { t } = useTranslation();
  const session = useSession();
  const printContext = JSON.stringify([
    contextKey,
    session?.user?.uuid,
    session?.sessionLocation?.uuid,
    session?.authenticated,
  ]);
  const activeContext = useRef(printContext);
  const [isPrinting, setIsPrinting] = useState(false);
  const mounted = useRef(true);
  const cancelPending = useRef<(() => void) | null>(null);

  const printPdf = useCallback(
    (url: string) => {
      if (!mounted.current || activeContext.current !== printContext) {
        return Promise.reject(new DOMException('Printing cancelled', 'AbortError'));
      }
      // The ref also blocks two clicks before React commits the loading state.
      if (cancelPending.current) {
        return Promise.reject(new Error(t('printInProgress', 'Print already in progress')));
      }
      return new Promise<void>((resolve, reject) => {
        setIsPrinting(true);
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
        let settled = false;
        let loadHandled = false;
        let timeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval> | undefined;
        let printWindow: Window | null = null;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (interval) clearInterval(interval);
          iframe.onload = null;
          iframe.onerror = null;
          try {
            printWindow?.removeEventListener('afterprint', afterPrint);
          } catch {
            /* The frame may be unavailable. */
          }
          iframe.remove();
          cancelPending.current = null;
          if (mounted.current) setIsPrinting(false);
          if (error) reject(error);
          else resolve();
        };
        const afterPrint = () => finish();
        const fail = () =>
          finish(
            new Error(
              t(
                'patientIdentityPrintFailed',
                'The identification document could not be printed. Retry or contact support if the problem continues.',
              ),
            ),
          );
        cancelPending.current = () => finish();
        iframe.onload = () => {
          if (settled || loadHandled || !mounted.current) return;
          loadHandled = true;
          clearTimeout(timeout);
          try {
            printWindow = iframe.contentWindow;
            if (!printWindow) {
              fail();
              return;
            }
            try {
              printWindow.addEventListener('afterprint', afterPrint, { once: true });
            } catch {
              /* Use focus/timeout fallback. */
            }
            printWindow.focus();
            printWindow.print();
            if (settled) return;
            let lostFocus = false;
            interval = setInterval(() => {
              const focused = document.hasFocus();
              if (focused && lostFocus) finish();
              if (!focused) lostFocus = true;
            }, 250);
            // Completion is not a claim that paper was physically printed.
            timeout = setTimeout(() => finish(), 30000);
          } catch {
            fail();
          }
        };
        iframe.onerror = fail;
        timeout = setTimeout(fail, 30000);
        try {
          iframe.src = url;
          document.body.appendChild(iframe);
        } catch {
          fail();
        }
      });
    },
    [t, printContext],
  );

  useEffect(() => {
    activeContext.current = printContext;
    mounted.current = true;
    setIsPrinting(false);
    return () => {
      mounted.current = false;
      cancelPending.current?.();
    };
  }, [printContext]);

  return { printPdf, isPrinting };
};
